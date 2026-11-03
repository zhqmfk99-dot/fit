// 점진 과부하 — 운동을 끝낼 때 "수행 능력 평가 → 다음 목표(세트/횟수/무게) 추천"을 정한다.
// 웹앱·PWA 공용 로직(UI 아님). AI가 아니라 규칙이라서 같은 기록이면 항상 같은 결과가 나오고, 이유도 설명할 수 있다.
//
// 기본 흐름: 목표 횟수를 모든 세트에서 채우고 수행 품질이 좋으면 → 다음엔 무게 업.
//            채우지 못했거나 품질이 나쁘면 → 유지. 무게를 올린 뒤에도 못 채우는 일이 계속되면 → 무게 소폭 다운.
//   (예전의 반복 범위(최소~최대, 이중 점진)는 없앴다. 목표 횟수는 루틴의 "반복" 하나다.)
//
// 평가 순서(위에서 먼저 걸리는 것):
//   1. 계획한 무게보다 가볍게 했다           → 유지 (그 무게로는 평가하지 않는다)
//   2. 계획한 세트를 다 못 했다              → 유지
//   3. 어떤 세트가 목표 횟수에 못 미쳤다      → 유지. 같은 무게에서 3번 연속 못 채우면 무게 낮추기(10%)
//                                              맨몸은 바로 횟수 낮추기: 다음 목표 = 가장 적게 한 세트의 횟수(이후 채우면 +1씩 다시 올림)
//   4. 피로도 5(매우 힘듦) 또는 체감 "힘들었어요" → 유지. 같은 계획으로 직전에도 "힘들었어요"였다면(두 번 연속) 세트를 1개 줄인다(최소 2세트)
//   5. 목표는 채웠지만 수행 품질이 나쁘다      → 유지 (아래 "수행 품질")
//   6. 그 외(목표 달성 + 품질 좋음)           → 무게 올리기. 맨몸(무게 0)은 횟수를 +1
//
// 체감 난이도(log.feel, 운동을 끝낸 뒤 사용자가 한 번 눌러 고른다 — 고르지 않으면 위 규칙 그대로):
//   hard(힘들었어요) → 목표를 다 채우고 수행이 좋아도 무게를 올리지 않고 유지(④).
//   easy(쉬웠어요)   → 수행 품질 중 "휴식을 길게 썼다·속도가 느려졌다"는 판단을 풀어 준다(그건 쉬웠다는 말과 안 맞을 수 있어서).
//                      "세트가 갈수록 횟수가 크게 줄었다"는 쉬웠다는 말과 모순이라 그대로 유지로 본다. 목표를 못 채웠으면 easy여도 유지(③).
//   ok(적당해요)     → 규칙 그대로.
//   easy가 무게를 더 많이 올리게 하지는 않는다(증량 폭은 그대로) — 한 번의 주관 값으로 큰 점프를 하지 않기 위해서.
//
// 계획 휴식 보정(목표와 별개): 같은 운동을 같은 계획 휴식으로 연속 3번 했고 세 번 모두 실제 휴식(평균)이 계획의 1.3배 이상(+20초 이상)이거나
//   0.7배 이하(−20초 이상)이면, 가운데 값을 15초 단위로 맞춰 계획 휴식으로 정한다(늘릴 때는 한 번에 최대 +60초, 범위 30~300초).
//   시각이 기록된 세트(운동 진행 화면)만 센다. 수퍼세트에 든 운동은 보정하지 않는다. 계획 휴식이 바뀌면 그때부터 다시 센다.
//
// 수행 품질(운동 진행 화면으로 기록한 세트의 측정값을 쓴다. 값이 없으면 그 항목은 판단에서 뺀다):
//   · 세트가 갈수록 횟수가 크게 줄었는가   — 첫 세트보다 마지막 세트가 3회 이상 적으면 "무너짐"
//   · 휴식을 계획보다 많이 썼는가          — 세트 사이의 실제 간격(이전 세트 종료~다음 세트 시작) 평균이 계획의 1.5배 이상이고 30초 넘게 더 쉬었으면 "회복 부족".
//                                           수퍼세트는 짝 운동 시간이 끼어 있어서 이 항목을 뺀다. 10분 넘는 간격은 자리를 비운 것으로 보고 뺀다.
//   · 마지막 세트로 갈수록 느려졌는가       — 마지막 세트의 반복당 시간이 첫 세트의 1.4배 이상이면 "힘에 부침"
//   천천히 하면서 부하를 주는 방식(일부러 느린 템포)을 구분하지는 못한다 — 세트 사이에 속도가 크게 달라질 때만 보므로
//   처음부터 끝까지 일정하게 느린 사람은 걸리지 않는다.
// ※ 증량 폭(바벨 2.5kg 등)·10% 감량·연속 3회·품질 기준 숫자는 흔히 쓰는 값으로 정한 가정이며, 아래 상수에서 조정한다.

const MIN_SETS_AFTER_REDUCE = 2 // "힘들었어요" 연속으로 세트를 줄일 때 이보다 적게는 줄이지 않는다

// 계획 휴식 보정: 같은 운동을 같은 계획 휴식으로 연속 3번 했고, 세 번 모두 실제 휴식(세트 사이 시각 차이의 평균)이 계획과 뚜렷이 다르면 계획 휴식을 실제 쪽으로 맞춘다.
const REST_ADJUST_SESSIONS = 3
const REST_UP_RATIO = 1.3 // 실제 휴식이 계획의 1.3배 이상이고
const REST_DOWN_RATIO = 0.7 // 또는 0.7배 이하이며
const REST_MIN_DIFF = 20 // 초: 차이가 이보다 클 때만
const REST_UP_MAX_EXTRA = 60 // 초: 한 번에 늘리는 폭의 상한
const REST_STEP = 15 // 초 단위로 맞춘다
const REST_FLOOR = 30
const REST_CEIL = 300

const DELOAD_RATIO = 0.9
const DELOAD_AFTER_MISSES = 3 // 같은 무게에서 이 횟수만큼 연속으로 목표를 못 채우면 무게를 낮춘다
const FATIGUE_HARD = 5
const REP_DROP_LIMIT = 3
const REST_EXTEND_RATIO = 1.5
const REST_EXTEND_MIN_EXTRA = 30 // 초
const REST_GAP_MAX = 600 // 초. 이보다 긴 간격은 휴식이 아니라 중단으로 보고 판단에서 뺀다
const TEMPO_SLOW_RATIO = 1.4
const TEMPO_SLOW_MIN_EXTRA = 1 // 반복당 초

const round1 = n => Math.round(n * 10) / 10

export const FEEL_LABELS = { easy: '쉬웠어요', ok: '적당해요', hard: '힘들었어요' }
export const FEEL_KEYS = Object.keys(FEEL_LABELS)

export const VERDICT_LABELS = {
  'weight-up': '무게 올리기',
  'reps-up': '횟수 늘리기',
  'reps-down': '횟수 낮추기',
  'sets-down': '세트 줄이기',
  hold: '유지',
  deload: '무게 낮추기',
}

// 지금 목표 횟수. 무게가 있는 운동은 루틴의 반복 그대로, 맨몸은 앱이 맞춰 둔 값(progressReps)을 쓴다.
// progressReps는 루틴의 반복보다 낮을 수도 있다(못 채워서 낮춘 경우). 루틴 수정 화면에서 반복을 직접 바꾸면 progressReps는 버려진다.
export function targetRepsOf(plan) {
  const reps = Number(plan?.reps) || 0
  const p = Number(plan?.progressReps)
  return Number(plan?.weight) > 0 || !(p > 0) ? reps : p
}

// 화면 표시용 반복 문구
export const repsText = plan => String(targetRepsOf(plan))

// 운동 종류별 증량 폭(kg). meta = 운동 리스트의 { equipment, movementPattern }
export function weightIncrement(meta) {
  if (meta?.equipment === '덤벨') return 2
  if (meta?.equipment === '바벨' && ['스쿼트', '힌지', '런지'].includes(meta?.movementPattern)) return 5
  return 2.5
}

// 이 기록 이전에 한 같은 운동의 완료 기록들(최근 것부터)
export function findPrevLogs(logs, log) {
  return logs
    .filter(l => l.id !== log.id && l.exercise === log.exercise && l.isCompleted && l.performedSets?.length && l.date < log.date)
    .sort((a, b) => b.date.localeCompare(a.date))
}
export const findPrevLog = (logs, log) => findPrevLogs(logs, log)[0] ?? null

// 가장 많이 든 무게(동률이면 더 무거운 쪽)
function workingWeight(sets) {
  const count = new Map()
  sets.forEach(s => count.set(s.weight || 0, (count.get(s.weight || 0) || 0) + 1))
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

// "8·8·7회 × 60kg" 형태의 요약
export function summarizePerformed(sets) {
  if (!sets?.length) return ''
  const w = workingWeight(sets)
  return `${sets.map(s => s.reps || 0).join('·')}회 × ${w ? `${w}kg` : '맨몸'}`
}

// 세트 사이의 실제 휴식(초): 이전 세트 종료 시각과 다음 세트 시작 시각의 차이. 시각이 없는 옛 기록은 저장된 휴식값(타이머 안의 휴식)을 쓴다.
function actualRests(sets) {
  return sets
    .slice(1)
    .map((s, i) => {
      const prev = sets[i]
      if (s.startedAt != null && prev.endedAt != null && s.startedAt >= prev.endedAt) return (s.startedAt - prev.endedAt) / 1000
      return s.restBeforeSeconds ?? null
    })
    .filter(v => v != null && v <= REST_GAP_MAX)
}

const perRep = s => (s?.durationSeconds && s?.reps ? s.durationSeconds / s.reps : null)

// 목표 횟수를 채운 세션의 수행 품질: 문제가 있으면 그 내용을 문장 목록으로 돌려준다(없으면 빈 배열)
//   ignoreSoft: 휴식·속도 판단을 뺀다(체감이 "쉬웠어요"일 때). 세트 무너짐(횟수 급감)은 그대로 본다.
export function qualityProblems(sets, plannedRestSeconds, { skipRest = false, ignoreSoft = false } = {}) {
  const problems = []
  const first = sets[0]
  const last = sets[sets.length - 1]
  if (sets.length >= 2) {
    const drop = (first.reps || 0) - (last.reps || 0)
    if (drop >= REP_DROP_LIMIT) problems.push(`마지막 세트가 첫 세트보다 ${drop}회 줄었어요`)

    const t0 = perRep(first)
    const tn = perRep(last)
    if (!ignoreSoft && t0 && tn && tn >= t0 * TEMPO_SLOW_RATIO && tn - t0 >= TEMPO_SLOW_MIN_EXTRA) problems.push('마지막 세트로 갈수록 속도가 크게 느려졌어요')
  }
  if (plannedRestSeconds > 0 && !skipRest && !ignoreSoft) {
    const rests = actualRests(sets)
    if (rests.length) {
      const avg = rests.reduce((a, b) => a + b, 0) / rests.length
      if (avg >= plannedRestSeconds * REST_EXTEND_RATIO && avg - plannedRestSeconds >= REST_EXTEND_MIN_EXTRA) {
        problems.push(`휴식을 계획(${plannedRestSeconds}초)보다 길게(평균 ${Math.round(avg)}초) 썼어요`)
      }
    }
  }
  return problems
}

// 이번 세션 포함, 같은 무게에서 목표를 못 채운 세션이 연속으로 몇 번인지
function missStreak(ww, prevLogs) {
  let streak = 1
  for (const p of prevLogs) {
    if (Math.abs(workingWeight(p.performedSets) - ww) > 1e-6) break
    const missed = Math.min(...p.performedSets.map(s => s.reps || 0)) < (Number(p.targetReps) || 0)
    if (!missed) break
    streak++
  }
  return streak
}

// 세트 사이 실제 휴식(초)의 평균: 시각(startedAt/endedAt)이 있는 간격만 쓴다. 시각이 없으면 null.
//   (저장된 restBeforeSeconds는 타이머 안의 값이라 계획 휴식을 넘지 못해서 "더 길게 쉰다"를 알아낼 수 없다.)
function timedRestAverage(sets) {
  const gaps = sets
    .slice(1)
    .map((s, i) => (s.startedAt != null && sets[i].endedAt != null && s.startedAt >= sets[i].endedAt ? (s.startedAt - sets[i].endedAt) / 1000 : null))
    .filter(v => v != null && v <= REST_GAP_MAX)
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
}

// 계획 휴식 보정: { from, to, reason } 또는 null. 수퍼세트(skipRest)는 간격에 짝 운동 시간이 끼어 있어 보정하지 않는다.
// 이전 기록은 계획 휴식이 지금과 같은 것만 센다(계획이 바뀌면 그때부터 다시 센다 — 보정이 매번 연달아 일어나지 않게).
function suggestRestAdjust({ log, prevLogs, skipRest }) {
  const planned = Number(log.restSeconds) || 0
  if (!(planned > 0) || skipRest) return null
  const sessions = [log]
  for (const p of prevLogs) {
    if (sessions.length >= REST_ADJUST_SESSIONS || Number(p.restSeconds) !== planned) break
    sessions.push(p)
  }
  if (sessions.length < REST_ADJUST_SESSIONS) return null
  const avgs = sessions.map(s => timedRestAverage(s.performedSets ?? []))
  if (avgs.some(a => a == null)) return null

  const longer = avgs.every(a => a >= planned * REST_UP_RATIO && a - planned >= REST_MIN_DIFF)
  const shorter = avgs.every(a => a <= planned * REST_DOWN_RATIO && planned - a >= REST_MIN_DIFF)
  if (!longer && !shorter) return null
  const median = [...avgs].sort((a, b) => a - b)[Math.floor(avgs.length / 2)]
  const rounded = Math.round(median / REST_STEP) * REST_STEP
  const to = longer ? Math.min(rounded, planned + REST_UP_MAX_EXTRA, REST_CEIL) : Math.max(rounded, REST_FLOOR)
  if (longer ? to <= planned : to >= planned) return null
  return {
    from: planned,
    to,
    reason: `최근 ${REST_ADJUST_SESSIONS}번 모두 휴식을 계획(${planned}초)보다 ${longer ? '길게' : '짧게'}(평균 약 ${Math.round(median)}초) 썼어요. 계획 휴식을 ${to}초로 맞춰요.`,
  }
}

// 완료한 운동 하나를 평가해서 다음 목표를 정한다.
//   log: 완료한 기록(목표·수행 세트·피로도·휴식 계획) / plan: 루틴의 해당 운동(없어도 됨)
//   prevLogs: 이전 같은 운동 기록들(연속 미달 판단용, 최근 것부터) / meta: 운동 리스트 정보(증량 폭)
//   skipRest: 수퍼세트에 든 운동이면 true(세트 사이 간격에 짝 운동 시간이 끼어 있어서 휴식 판단을 뺀다)
// 반환: { verdict, label, reason, next: { sets, reps, weight }, restAdjust? } — 수행 세트가 없으면 null
//   restAdjust: 계획 휴식 보정({ from, to, reason }). 목표(verdict)와 별개로, 조건에 맞을 때만 붙는다.
export function evaluateSession(args) {
  const result = evaluateCore(args)
  if (!result) return null
  const restAdjust = suggestRestAdjust({ log: args.log, prevLogs: args.prevLogs ?? [], skipRest: args.skipRest ?? false })
  return restAdjust ? { ...result, restAdjust } : result
}

function evaluateCore({ log, plan, prevLogs = [], meta, skipRest = false }) {
  const sets = log.performedSets ?? []
  if (!sets.length) return null

  const target = Number(log.targetReps) || Number(plan?.reps) || 0
  const plannedSets = log.targetSets || sets.length
  const plannedWeight = Number(log.targetWeight) || 0
  const fatigue = log.fatigue ?? 3
  const ww = workingWeight(sets)
  const bodyweight = ww === 0 && plannedWeight === 0
  const minReps = Math.min(...sets.map(s => s.reps || 0))

  const make = (verdict, reason, next) => ({ verdict, label: VERDICT_LABELS[verdict], reason, next: { ...next, weight: round1(next.weight) } })
  const hold = reason => make('hold', reason, { sets: plannedSets, reps: target, weight: plannedWeight })

  if (!bodyweight && ww < plannedWeight) return hold(`계획한 ${plannedWeight}kg보다 가볍게 해서 목표를 그대로 둬요.`)
  if (sets.length < plannedSets) return hold(`계획한 ${plannedSets}세트를 다 하지 못해서 목표를 그대로 둬요.`)

  if (minReps < target) {
    // 맨몸은 낮출 무게가 없어서 목표 횟수 자체를 해낸 수준(가장 적게 한 세트)으로 맞춘다. 처음 추천이 높았을 때 같은 목표에 계속 막히지 않게 하려는 것이다.
    // 한 번 낮추면 이후 목표를 채울 때마다 +1씩 다시 올라간다. 연속 미달을 기다리지 않고 바로 맞춘다(무게 운동의 3번 연속 규칙과 다름).
    if (bodyweight) {
      const lowered = Math.max(1, minReps)
      return make('reps-down', `목표 ${target}회에 못 미친 세트가 있었어요(가장 적게 한 세트 ${minReps}회). 다음 목표를 ${lowered}회로 맞춰요. 채우면 다시 하나씩 올려요.`, { sets: plannedSets, reps: lowered, weight: 0 })
    }
    const streak = missStreak(ww, prevLogs)
    if (!bodyweight && streak >= DELOAD_AFTER_MISSES) {
      const lowered = Math.min(ww - 0.5, Math.round(ww * DELOAD_RATIO * 2) / 2)
      return make('deload', `같은 무게에서 ${streak}번 연속 목표 ${target}회를 못 채웠어요. 무게를 낮춰 다시 쌓아요.`, { sets: plannedSets, reps: target, weight: Math.max(0, lowered) })
    }
    const warn = !bodyweight && streak === DELOAD_AFTER_MISSES - 1 ? ' 한 번 더 못 채우면 무게를 낮춰요.' : ''
    return hold(`목표 ${target}회에 못 미친 세트가 있어요${streak > 1 ? ` (${streak}번 연속)` : ''}. 같은 목표로 다시 도전해요.${warn}`)
  }

  if (log.feel === 'hard') {
    // 같은 계획(세트 수)으로 직전에도 "힘들었어요"였다면 두 번 연속이라 부담을 낮춘다: 세트를 1개 줄인다(최소 2세트). 계획이 바뀐 뒤에는 새로 센다.
    const prev = prevLogs[0]
    if (prev?.feel === 'hard' && Number(prev.targetSets) === plannedSets && plannedSets > MIN_SETS_AFTER_REDUCE) {
      return make('sets-down', `"힘들었어요"를 두 번 연속 골랐어요. 세트를 ${plannedSets - 1}개로 줄여서 부담을 낮춰요.`, { sets: plannedSets - 1, reps: target, weight: plannedWeight })
    }
    return hold('목표는 채웠지만 "힘들었어요"라고 골라서 목표를 그대로 두고 한 번 더 익혀요.')
  }
  if (fatigue >= FATIGUE_HARD) return hold('매우 힘들었어요(피로도 5). 목표를 그대로 두고 회복해요.')

  const easy = log.feel === 'easy'
  const problems = qualityProblems(sets, Number(log.restSeconds) || 0, { skipRest, ignoreSoft: easy })
  if (problems.length) return hold(`목표는 채웠지만 ${problems.join(', ')}. 아직 올리기엔 여유가 부족해 보여서 그대로 유지해요.`)

  if (bodyweight) {
    const why = easy ? `모든 세트에서 ${target}회 이상 해냈고 "쉬웠어요"라고 골랐어요.` : `모든 세트에서 ${target}회 이상 해냈고 수행도 안정적이었어요.`
    return make('reps-up', `${why} 횟수를 늘려요.`, { sets: plannedSets, reps: minReps + 1, weight: 0 })
  }

  const why = easy ? `모든 세트에서 목표 ${target}회를 채웠고 "쉬웠어요"라고 골랐어요.` : `모든 세트에서 목표 ${target}회를 채웠고 휴식·속도도 안정적이었어요.`
  return make('weight-up', `${why} 무게를 올려요.`, { sets: plannedSets, reps: target, weight: ww + weightIncrement(meta) })
}

// 평가 결과를 루틴의 운동 항목에 반영한다. 반복(reps)은 사용자가 정한 값이라 건드리지 않고, 맨몸 운동의 지금 목표 횟수만 progressReps에 둔다.
export function applyNextToPlan(plan, next) {
  return { ...plan, sets: next.sets, weight: next.weight, progressReps: Number(next.weight) > 0 ? undefined : next.reps }
}
