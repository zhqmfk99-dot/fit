// 회복 주간(디로드) 제안 — 웹앱·PWA 공용 로직(UI 아님), 규칙 기반이라 같은 기록이면 항상 같은 결과다.
//
// 최근 기록에서 "쉬어 갈 때가 됐다"는 신호를 찾아 대시보드에 제안만 한다(앱이 목표 무게를 자동으로 바꾸지는 않는다).
// 주 단위는 달력이 아니라 오늘 기준 7일씩 끊은 구간이다(0주 전 = 오늘 포함 최근 7일, 1주 전 = 그 앞 7일 …).
//   A. 무게를 올린 주가 연속 — 같은 운동의 이전 기록보다 최고 무게가 오른 세션이 있는 주가 4주 연속(운동한 주만 센다)
//   B. 추정 피로도가 높은 주가 연속 — 두 주 연속으로 운동이 3개 이상이고 평균 피로도가 4.0 이상(피로도는 앱이 세트 기록으로 추정한 값)
//   C. 목표 횟수 미달이 잦음 — 최근 14일 완료 운동 6개 이상 중 40% 이상이 목표 횟수에 못 미침
//   신호가 2개 이상이면 "recommend", 1개면 "consider".
//   이미 가볍게 한 주는 제안하지 않는다 — 최근 운동 주의 볼륨이 그 앞 3주 평균의 60% 미만이면 이미 쉬는 중으로 본다.
//   최근 14일에 운동한 날이 이틀 미만이면 제안하지 않는다(운동을 안 하고 있는데 쉬라고 하지 않는다).
// ※ 4주·피로도 4.0·40%·60% 같은 기준 숫자는 흔히 쓰는 값으로 정한 가정이다(아래 상수). 의학적 판단이 아니다.

import { exerciseSessions } from './exerciseStats.js'

export const RAISE_WEEKS = 4
export const FATIGUE_HIGH = 4.0
export const FATIGUE_MIN_LOGS = 3
export const MISS_SHARE = 0.4
export const MISS_MIN_LOGS = 6
export const LIGHT_WEEK_RATIO = 0.6
export const SNOOZE_DAYS = 7

const DAY_MS = 86400000
const dayNumber = ymd => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY_MS)
const addDays = (ymd, n) => new Date((dayNumber(ymd) + n) * DAY_MS).toISOString().slice(0, 10)
const weekOf = (today, date) => Math.floor((dayNumber(today) - dayNumber(date)) / 7) // 0 = 최근 7일

const isDone = l => l.isCompleted && l.performedSets?.some(s => (Number(s.reps) || 0) > 0)
const volumeOf = l => l.performedSets.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0)

// logs: 전체 기록, today: 'YYYY-MM-DD'
// 반환: { show, level: 'recommend' | 'consider' | null, signals: [{ kind, text }] }
export function deloadAdvice(logs, today) {
  const none = { show: false, level: null, signals: [] }
  const done = logs.filter(l => isDone(l) && l.date <= today)
  if (new Set(done.filter(l => weekOf(today, l.date) <= 1).map(l => l.date)).size < 2) return none

  const byWeek = new Map()
  for (const l of done) {
    const k = weekOf(today, l.date)
    if (!byWeek.has(k)) byWeek.set(k, [])
    byWeek.get(k).push(l)
  }
  const trained = k => (byWeek.get(k)?.length ?? 0) > 0

  // 이미 가볍게 하는 중인가: 최근 운동 주(0주 전, 없으면 1주 전)의 볼륨이 그 앞 3주 평균의 60% 미만
  const latest = trained(0) ? 0 : 1
  const vol = k => (byWeek.get(k) ?? []).reduce((a, l) => a + volumeOf(l), 0)
  const priors = [1, 2, 3].map(i => vol(latest + i)).filter(v => v > 0)
  if (priors.length >= 2 && vol(latest) < (priors.reduce((a, b) => a + b, 0) / priors.length) * LIGHT_WEEK_RATIO) return none

  const signals = []

  // A. 무게를 올린 주가 연속
  const raisedWeeks = new Set()
  for (const name of new Set(done.map(l => l.exercise))) {
    const sessions = exerciseSessions(done, name)
    for (let i = 1; i < sessions.length; i++) {
      if (!sessions[i].bodyweight && !sessions[i - 1].bodyweight && sessions[i].topWeight > sessions[i - 1].topWeight) raisedWeeks.add(weekOf(today, sessions[i].date))
    }
  }
  let run = 0
  for (let k = trained(0) ? 0 : 1; trained(k) && raisedWeeks.has(k); k++) run++
  if (run >= RAISE_WEEKS) signals.push({ kind: 'raise', text: `${run}주 연속으로 무게를 올렸어요.` })

  // B. 추정 피로도가 높은 주가 연속(0·1주 전, 0주 전이 모자라면 1·2주 전)
  const fatigueAvg = k => {
    const f = (byWeek.get(k) ?? []).map(l => l.fatigue).filter(v => typeof v === 'number')
    return f.length >= FATIGUE_MIN_LOGS ? f.reduce((a, b) => a + b, 0) / f.length : null
  }
  for (const [a, b] of [[0, 1], [1, 2]]) {
    const fa = fatigueAvg(a)
    const fb = fatigueAvg(b)
    if (fa != null && fb != null && fa >= FATIGUE_HIGH && fb >= FATIGUE_HIGH) {
      signals.push({ kind: 'fatigue', text: `추정 피로도가 두 주 연속 높았어요(평균 ${fb.toFixed(1)} → ${fa.toFixed(1)}).` })
      break
    }
  }

  // C. 최근 14일 목표 횟수 미달이 잦음
  const recent = done.filter(l => weekOf(today, l.date) <= 1 && (Number(l.targetReps) || 0) > 0)
  if (recent.length >= MISS_MIN_LOGS) {
    const missed = recent.filter(l => Math.min(...l.performedSets.map(s => Number(s.reps) || 0)) < Number(l.targetReps)).length
    if (missed / recent.length >= MISS_SHARE) signals.push({ kind: 'miss', text: `최근 2주 운동 ${recent.length}개 중 ${missed}개가 목표 횟수에 못 미쳤어요.` })
  }

  if (!signals.length) return none
  return { show: true, level: signals.length >= 2 ? 'recommend' : 'consider', signals }
}

// 숨기기: 저장된 값(숨김이 끝나는 날짜 'YYYY-MM-DD')이 오늘보다 뒤면 숨긴다
export const snoozeUntil = today => addDays(today, SNOOZE_DAYS)
export const isSnoozed = (until, today) => typeof until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(until) && until > today

export const DELOAD_TIP = '이번 주는 가볍게: 평소 무게의 90%쯤으로 낮추고, 세트 수는 그대로 하거나 2/3로 줄여 보세요. 한두 번 더 할 수 있을 때 멈추면 돼요. 한 주 쉬고 나면 원래 무게로 돌아가도 괜찮아요.'
