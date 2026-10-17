// 점진 과부하(이중 점진, double progression) — 운동을 끝낼 때 "수행 능력 평가 → 다음 목표(세트/횟수/무게) 추천"을 정한다.
// 웹앱·PWA 공용 로직(UI 아님). AI가 아니라 규칙이라서 같은 기록이면 항상 같은 결과가 나오고, 이유도 설명할 수 있다.
//
// 루틴의 운동(plan)에 쓰는 필드: reps(범위 하한) · repsMax(범위 상한, 비우면 기본값) · progressReps(지금 목표 횟수, 앱이 자동 관리) · weight · sets
//   예) 8~12회: 모든 세트에서 목표 횟수를 채우면 목표를 1회씩 올리고, 모든 세트가 상한(12회)에 닿으면 무게를 올리고 횟수를 하한(8회)으로 되돌린다.
//   범위를 따로 안 정하면 하한이 6 이상이면 +4회, 6 미만이면 +2회까지를 범위로 본다. 5×5처럼 고정하려면 최대를 하한과 같게 둔다.
//
// 평가 순서(위에서 먼저 걸리는 것):
//   1. 계획한 무게보다 가볍게 했다            → 유지 (그 무게로는 평가하지 않는다)
//   2. 어떤 세트가 범위 하한에도 못 미쳤다     → 유지, 직전 기록도 하한 미달이면 무게 낮추기(10%)
//   3. 어떤 세트가 목표 횟수에 못 미쳤다       → 유지 (같은 목표로 재도전)
//   4. 계획한 세트를 다 못 했다               → 유지
//   5. 피로도 5(매우 힘듦)                    → 유지
//   6. 모든 세트가 상한 이상                  → 무게 올리기 (횟수는 하한으로)
//   7. 그 외(모든 세트가 목표 이상)            → 횟수 늘리기. 단 피로도 1(매우 쉬움)이고 세트가 5 미만이면 세트를 하나 늘린다
//   맨몸(무게 0)은 무게·상한 없이 모든 세트가 목표 이상이면 횟수만 계속 늘린다.
// ※ 증량 폭(바벨 2.5kg 등)·10% 감량·피로도 기준은 흔히 쓰는 값으로 정한 가정이며, 개인에 맞춰 조정할 수 있다.

const MAX_SETS = 5
const DELOAD_RATIO = 0.9
const FATIGUE_HARD = 5
const FATIGUE_EASY = 1

const round1 = n => Math.round(n * 10) / 10

export const VERDICT_LABELS = {
  'weight-up': '무게 올리기',
  'reps-up': '횟수 늘리기',
  'sets-up': '세트 늘리기',
  hold: '유지',
  deload: '무게 낮추기',
}

// 반복 범위
export function repRange(plan) {
  const min = Number(plan?.reps) || 0
  const rawMax = Number(plan?.repsMax)
  const max = rawMax > 0 ? Math.max(min, rawMax) : min + (min >= 6 ? 4 : 2)
  return { min, max }
}

// 지금 목표 횟수(progressReps를 범위 안으로 맞춘 값). 맨몸은 상한 없이 늘어난다.
export function targetRepsOf(plan) {
  const { min, max } = repRange(plan)
  const p = Number(plan?.progressReps)
  if (!(p > 0)) return min
  return Number(plan?.weight) > 0 ? Math.min(max, Math.max(min, p)) : Math.max(min, p)
}

// 운동 종류별 증량 폭(kg). meta = 운동 리스트의 { equipment, movementPattern }
export function weightIncrement(meta) {
  if (meta?.equipment === '덤벨') return 2
  if (meta?.equipment === '바벨' && ['스쿼트', '힌지', '런지'].includes(meta?.movementPattern)) return 5
  return 2.5
}

// 이 기록 직전에 한 같은 운동의 완료 기록
export function findPrevLog(logs, log) {
  return (
    logs
      .filter(l => l.id !== log.id && l.exercise === log.exercise && l.isCompleted && l.performedSets?.length && l.date < log.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  )
}

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

// 완료한 운동 하나를 평가해서 다음 목표를 정한다.
//   log: 완료한 기록(목표·수행 세트·피로도) / plan: 루틴의 해당 운동(없으면 기록의 목표로 대신함)
//   prev: 직전 같은 운동 기록(연속 미달 판단용) / meta: 운동 리스트 정보(증량 폭)
// 반환: { verdict, label, reason, next: { sets, reps, weight } } — 수행 세트가 없으면 null
export function evaluateSession({ log, plan, prev, meta }) {
  const sets = log.performedSets ?? []
  if (!sets.length) return null

  const { min, max } = repRange(plan ?? { reps: log.targetReps })
  const target = Number(log.targetReps) || min
  const plannedSets = log.targetSets || sets.length
  const plannedWeight = Number(log.targetWeight) || 0
  const fatigue = log.fatigue ?? 3
  const ww = workingWeight(sets)
  const bodyweight = ww === 0 && plannedWeight === 0
  const minReps = Math.min(...sets.map(s => s.reps || 0))

  const make = (verdict, reason, next) => ({ verdict, label: VERDICT_LABELS[verdict], reason, next: { ...next, weight: round1(next.weight) } })
  const hold = reason => make('hold', reason, { sets: plannedSets, reps: target, weight: plannedWeight })

  if (!bodyweight && ww < plannedWeight) return hold(`계획한 ${plannedWeight}kg보다 가볍게 해서 목표를 그대로 둬요.`)

  if (minReps < min) {
    const prevUnder = prev?.performedSets?.some(s => (s.reps || 0) < min)
    if (prevUnder && !bodyweight) {
      const lowered = Math.min(ww - 0.5, Math.round(ww * DELOAD_RATIO * 2) / 2)
      return make('deload', `2번 연속 ${min}회에 못 미쳤어요. 무게를 낮춰 다시 쌓아요.`, { sets: plannedSets, reps: min, weight: Math.max(0, lowered) })
    }
    return hold(`${min}회에 못 미친 세트가 있어요. 같은 목표로 다시 도전해요.`)
  }
  if (minReps < target) return hold(`목표 ${target}회에 못 미친 세트가 있어요. 같은 목표로 다시 도전해요.`)
  if (sets.length < plannedSets) return hold(`계획한 ${plannedSets}세트를 다 하지 못해서 목표를 그대로 둬요.`)
  if (fatigue >= FATIGUE_HARD) return hold('매우 힘들었어요(피로도 5). 목표를 그대로 두고 회복해요.')

  if (bodyweight) return make('reps-up', `모든 세트에서 ${target}회 이상 해냈어요. 횟수를 늘려요.`, { sets: plannedSets, reps: minReps + 1, weight: 0 })

  const inc = weightIncrement(meta)
  if (minReps >= max) {
    return make('weight-up', `모든 세트에서 최대 ${max}회를 채웠어요. 무게를 올리고 횟수는 ${min}회로 되돌려요.`, { sets: plannedSets, reps: min, weight: ww + inc })
  }
  if (fatigue <= FATIGUE_EASY && plannedSets < MAX_SETS) {
    return make('sets-up', '매우 쉬웠어요(피로도 1). 세트를 하나 늘려요.', { sets: plannedSets + 1, reps: target, weight: ww })
  }
  const nextReps = Math.min(max, minReps + 1)
  return make('reps-up', `모든 세트에서 ${target}회 이상 해냈어요. 최대 ${max}회까지 횟수를 늘려요.`, { sets: plannedSets, reps: nextReps, weight: ww })
}

// 평가 결과를 루틴의 운동 항목에 반영한다 (reps·repsMax는 사용자가 정한 범위라서 건드리지 않고, 지금 목표는 progressReps에 둔다)
export function applyNextToPlan(plan, next) {
  return { ...plan, sets: next.sets, weight: next.weight, progressReps: next.reps }
}

// 화면 표시용 반복 문구: 지금 목표 횟수, 범위를 정해 둔 운동이면 뒤에 범위 — 예) "9 (8~12)"
export function repsText(plan) {
  const cur = targetRepsOf(plan)
  const hasRange = Number(plan?.repsMax) > Number(plan?.reps)
  return hasRange ? `${cur} (${plan.reps}~${plan.repsMax})` : `${cur}`
}
