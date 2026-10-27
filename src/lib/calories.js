// 웨이트 운동 소모 칼로리 추정 — "시간 기반 MET + 강도 보정"을 섞은 방식.
//
//   소모 kcal = MET × 체중(kg) × 시간(h)         (표준 MET 공식, 안정시 대사량 포함한 총 소모)
//   시간      = 세트 수행 시간 + 휴식 시간 + 운동 시작 전 준비 시간   (웨이트는 휴식 중 회복 소비가 커서 휴식을 뺄 수 없다)
//               세트 시간·휴식은 세션 화면의 실측값, 시작 전 준비는 직전 세트 종료~첫 세트 시작의 실측 간격(없으면 60초 가정)
//   MET       = 3.5 ~ 6.0 사이를 강도 점수로 보간       (Compendium of Physical Activities의 웨이트 운동 범위)
//   강도 점수 = 0.6 × 상대강도(들어올린 무게 ÷ 내 최고 무게) + 0.4 × 밀도(체중 대비 분당 볼륨)
//
// 저장: 운동을 완료·수정할 때 이 식으로 구한 값이 workout_logs.kcal에 저장된다(applyKcal). 날짜 합계와 추이 그래프는 저장값을 합산한다.
//       그래서 CALORIE_CALIBRATION이나 식을 바꿔도 "이미 저장된 과거 값"은 바뀌지 않는다 (과거까지 바꾸려면 값을 다시 계산해 덮어써야 한다).
// ※ 어디까지나 추정치다. 웨이트의 에너지 소비는 개인차가 크고, 이 앱에는 정답(호흡·심박)이 없어서 정확도를 검증할 수 없다.
//   그래서 화면에는 "약 N kcal"로 표시하고, 시계·운동 앱 값과 비교해 CALORIE_CALIBRATION 하나로 맞출 수 있게 했다.
// ※ 아래 상수 중 MET 범위(3.5~6.0)만 공개 자료에 근거가 있고, 나머지(0.6/0.4 비율, 밀도 기준, 시간 추정값)는 합리적으로 정한 가정이다.

import { getRecentMaxWeight, sideFactor } from './workoutMetrics.js'

// ── 조정 가능한 값 ─────────────────────────────────────────────
export const CALORIE_CALIBRATION = 1.0 // 기본 보정 계수. 사용자는 설정에서 직접 바꾼다(settings.calorieCalibration) — 아래 함수들의 calibration 인자로 들어온다. 실측과 비교해 맞춘다 (예: 늘 15% 낮게 나오면 1.15)

const MET_MIN = 3.5 // 가벼운 다종목 웨이트
const MET_MAX = 6.0 // 격렬한 웨이트
const INTENSITY_WEIGHTS = { relative: 0.6, density: 0.4 }
const DENSITY_LOW = 0.5 // 체중당 분당 볼륨(kg·회 ÷ 체중kg ÷ 분)이 이 이하면 밀도 점수 0
const DENSITY_HIGH = 6 // 이 이상이면 밀도 점수 1
const NEUTRAL_RELATIVE = 0.7 // 기록이 부족해 상대강도를 모를 때 쓰는 중간값 (피로도 계산과 동일)
const BODYWEIGHT_SCORE = 0.5 // 맨몸 운동은 무게 기준이 없어 중간 강도로 본다

// 시간 추정 — 세션 화면으로 기록한 세트는 실측값을 쓰고, 없으면(직접 입력·완료 처리) 아래로 추정한다
const SECONDS_PER_REP = 4 // 피로도 계산이 쓰는 값과 동일
const DEFAULT_REST_SECONDS = 90
const TRANSITION_SECONDS = 60 // 운동 하나를 시작하기 전 자리 이동·세팅
const MAX_SET_SECONDS = 120 // 실측값이 비정상적으로 길면(자리를 비움 등) 상한을 둔다
const MAX_REST_SECONDS = 300

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// 운동 기록 하나가 차지한 시간(초)
// 운동 시작 전 준비 시간: 같은 날 직전에 끝난 세트와 이 운동 첫 세트 시작 사이의 실측 간격(휴식·이동·세팅 포함).
// 시각이 없거나(직접 입력 등) 직전 기록이 없으면(그날 첫 운동) 가정값을 쓴다.
function leadInSeconds(log, allLogs) {
  const first = log.performedSets?.[0]?.startedAt
  if (first == null || !allLogs) return TRANSITION_SECONDS
  let prevEnd = null
  for (const l of allLogs) {
    if (l.id === log.id || l.date !== log.date || !l.isCompleted) continue
    for (const s of l.performedSets ?? []) {
      if (s.endedAt != null && s.endedAt <= first && (prevEnd == null || s.endedAt > prevEnd)) prevEnd = s.endedAt
    }
  }
  if (prevEnd == null) return TRANSITION_SECONDS
  return clamp((first - prevEnd) / 1000, 0, MAX_REST_SECONDS)
}

// allLogs를 주면 시작 전 준비 시간을 실측으로 계산한다(없으면 가정값)
export function logSeconds(log, allLogs, uni) {
  const sets = log.performedSets ?? []
  if (!sets.length) return 0
  let sec = leadInSeconds(log, allLogs)
  const side = sideFactor(log, uni) // 시간을 재지 않은 세트는 횟수로 추정하는데, 한쪽씩 하는 운동은 양쪽을 모두 한 시간으로 본다
  sets.forEach((s, i) => {
    sec += Math.min(s.durationSeconds ?? (s.reps || 0) * SECONDS_PER_REP * side, MAX_SET_SECONDS)
    if (i > 0) sec += Math.min(s.restBeforeSeconds ?? DEFAULT_REST_SECONDS, MAX_REST_SECONDS)
  })
  return sec
}

// 운동 기록 하나의 강도 점수(0~1)
function intensityScore(log, allLogs, bodyWeightKg, seconds, uni) {
  const sets = log.performedSets
  const avgWeight = sets.reduce((a, s) => a + (s.weight || 0), 0) / sets.length
  if (avgWeight <= 0) return BODYWEIGHT_SCORE

  // 상대강도: 내 최고 무게 대비. 같은 운동 기록이 2건 미만이면 최고 무게가 의미 없으니 중간값.
  const history = allLogs.filter(l => l.exercise === log.exercise && l.isCompleted && l.performedSets?.length)
  const recentMax = history.length >= 2 ? getRecentMaxWeight(allLogs, log.exercise) : null
  const relative = recentMax ? clamp(avgWeight / recentMax, 0, 1) : NEUTRAL_RELATIVE

  // 밀도: 체중 대비 분당 볼륨
  const volume = sets.reduce((a, s) => a + (s.reps || 0) * (s.weight || 0), 0) * sideFactor(log, uni) // 한쪽씩 하는 운동은 양쪽 볼륨
  const density = volume / (bodyWeightKg * (seconds / 60))
  const densityScore = clamp((density - DENSITY_LOW) / (DENSITY_HIGH - DENSITY_LOW), 0, 1)

  return clamp(INTENSITY_WEIGHTS.relative * relative + INTENSITY_WEIGHTS.density * densityScore, 0, 1)
}

// 운동 기록 하나의 MET
export function logMet(log, allLogs, bodyWeightKg, uni) {
  const seconds = logSeconds(log, allLogs, uni)
  if (!seconds) return 0
  return MET_MIN + (MET_MAX - MET_MIN) * intensityScore(log, allLogs, bodyWeightKg, seconds, uni)
}

const isDone = l => l.isCompleted && l.performedSets?.length > 0

// 운동 기록 하나의 소모 칼로리. 완료하지 않았거나 세트 기록이 없거나 체중을 모르면 null. 소수 첫째 자리까지.
// 이 값을 운동 기록(workout_logs.kcal)에 저장한다 — 저장하면 나중에 최고 무게·체중·보정 계수가 바뀌어도 그날 값은 변하지 않는다.
export function estimateLogKcal(log, allLogs, bodyWeightKg, calibration = CALORIE_CALIBRATION, uni) {
  if (!isDone(log) || !bodyWeightKg) return null
  const kcal = logMet(log, allLogs, bodyWeightKg, uni) * bodyWeightKg * (logSeconds(log, allLogs, uni) / 3600) * calibration
  return Math.round(kcal * 10) / 10
}

// 하루(날짜) 소모 칼로리 = 그날 완료한 운동들의 저장된 칼로리 합. 저장값이 없는 기록(이 기능 이전 기록)은 체중으로 즉석 계산한다.
// 하나라도 값을 구할 수 없으면(저장값 없고 체중도 모름) 부분 합계로 오해하지 않게 null. 그날 완료한 운동이 없어도 null.
// 5kcal 단위로 반올림해서 실제 정밀도보다 정확해 보이지 않게 한다.
export function estimateDayKcal(date, allLogs, bodyWeightKg, calibration = CALORIE_CALIBRATION, uni) {
  const dayLogs = allLogs.filter(l => l.date === date && isDone(l))
  if (!dayLogs.length) return null
  let sum = 0
  for (const l of dayLogs) {
    const kcal = l.kcal ?? estimateLogKcal(l, allLogs, bodyWeightKg, calibration, uni)
    if (kcal == null) return null
    sum += kcal
  }
  return Math.round(sum / 5) * 5
}

// 운동을 저장할 때마다 호출: 완료된 기록의 kcal을 채우거나 갱신한다. (WorkoutLogsContext의 setLogs가 쓴다)
//  - 완료가 아니거나 세트 기록이 없으면 kcal 제거(null)
//  - 이미 값이 있고 날짜·세트 기록이 안 바뀌었으면 그대로 둔다 (과거 값이 흔들리지 않게)
//  - 새로 완료했거나 수정했거나 값이 비어 있으면 그 시점의 체중으로 계산
// 체중을 모르면 null로 두고, 체중이 생긴 뒤 다음 저장 때 채워진다.
export function applyKcal(next, prev, { bodyRecords, profileWeightKg, calibration = CALORIE_CALIBRATION, uni }) {
  const prevById = new Map(prev.map(l => [l.id, l]))
  return next.map(l => {
    if (!isDone(l)) return l.kcal == null ? l : { ...l, kcal: null }
    const before = prevById.get(l.id)
    const unchanged = before && isDone(before) && before.date === l.date && JSON.stringify(before.performedSets) === JSON.stringify(l.performedSets)
    if (unchanged && l.kcal != null) return l
    const kcal = estimateLogKcal(l, next, bodyWeightOn(l.date, bodyRecords, profileWeightKg), calibration, uni)
    return kcal === (l.kcal ?? null) ? l : { ...l, kcal }
  })
}

// 날짜별 소모 칼로리 목록(오래된 순) — 추이 그래프용
export function kcalByDate(allLogs, bodyRecords, profileWeightKg, calibration = CALORIE_CALIBRATION, uni) {
  const dates = [...new Set(allLogs.filter(isDone).map(l => l.date))].sort()
  return dates
    .map(date => ({ date, kcal: estimateDayKcal(date, allLogs, bodyWeightOn(date, bodyRecords, profileWeightKg), calibration, uni) }))
    .filter(d => d.kcal != null)
}

// 그날 쓸 체중: 그날 이전(포함)의 가장 최근 신체 기록 → 없으면 가장 오래된 이후 기록 → 없으면 내 정보의 체중
export function bodyWeightOn(date, bodyRecords, profileWeightKg) {
  const withWeight = bodyRecords.filter(r => r.weightKg)
  const before = withWeight.filter(r => r.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (before) return before.weightKg
  const after = withWeight.sort((a, b) => a.date.localeCompare(b.date))[0]
  return after?.weightKg ?? profileWeightKg ?? null
}
