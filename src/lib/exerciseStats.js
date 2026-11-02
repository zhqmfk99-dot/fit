// 운동별 기록 통계 — 최고 무게·예상 1RM·개인 기록(PR). 웹앱·PWA 공용 로직(UI 아님), 규칙 기반이라 같은 기록이면 항상 같은 결과다.
//
// 대상은 완료한 기록(isCompleted)의 수행 세트(performedSets)뿐이다. 같은 운동은 이름으로 모은다.
// 예상 1RM(한 번에 들 수 있는 최대 무게 추정)은 Epley 식: 무게 × (1 + 횟수/30). 1회 세트는 그 무게 자체.
//   추정식은 횟수가 많을수록 부정확해서 12회를 넘는 세트는 계산에서 뺀다(E1RM_MAX_REPS). 맨몸(무게 0) 운동은 1RM 대신 최대 횟수를 본다.
//   한쪽씩 하는 운동도 손에 든 무게 기준 그대로 계산한다(볼륨 ×2 같은 보정은 여기서 하지 않는다).
// ※ 12회 상한은 흔히 쓰는 값으로 정한 가정이고, 1RM은 어디까지나 추정치다(직접 들어 본 값이 아니다).

export const E1RM_MAX_REPS = 12

const round05 = n => Math.round(n * 2) / 2
const reps = s => Number(s?.reps) || 0
const weight = s => Number(s?.weight) || 0

// 세트 하나의 예상 1RM (계산할 수 없으면 null)
export function e1rmOf(set) {
  const r = reps(set)
  const w = weight(set)
  if (!(w > 0) || r < 1 || r > E1RM_MAX_REPS) return null
  return r === 1 ? w : w * (1 + r / 30)
}

// 이 운동의 완료 기록을 날짜 오름차순으로: [{ id, date, sets, topWeight, topReps, e1rm, bodyweight }]
//   topWeight: 가장 무거운 세트의 무게(횟수 1 이상인 세트만), topReps: 가장 많은 횟수, e1rm: 세션 최고 예상 1RM(없으면 null),
//   bodyweight: 모든 세트가 무게 0
export function exerciseSessions(logs, name) {
  return logs
    .filter(l => l.exercise === name && l.isCompleted && l.performedSets?.some(s => reps(s) > 0))
    .map(l => {
      const sets = l.performedSets.filter(s => reps(s) > 0)
      const e1rms = sets.map(e1rmOf).filter(v => v != null)
      return {
        id: l.id,
        date: l.date,
        sets,
        topWeight: Math.max(...sets.map(weight)),
        topReps: Math.max(...sets.map(reps)),
        e1rm: e1rms.length ? Math.max(...e1rms) : null,
        bodyweight: sets.every(s => !(weight(s) > 0)),
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 개인 기록: { weight: { value, date }, e1rm: { value, date }, reps: { value, date } } (없는 항목은 null)
//   같은 값을 처음 낸 날짜를 기록일로 본다. 맨몸 세션은 weight·e1rm에서 빠지고 reps만 본다(무게가 있는 세션이 있으면 reps는 무게 0 세션만).
export function personalRecords(sessions) {
  const best = { weight: null, e1rm: null, reps: null }
  for (const s of sessions) {
    if (!s.bodyweight) {
      if (s.topWeight > 0 && (!best.weight || s.topWeight > best.weight.value)) best.weight = { value: s.topWeight, date: s.date }
      if (s.e1rm != null && (!best.e1rm || s.e1rm > best.e1rm.value)) best.e1rm = { value: s.e1rm, date: s.date }
    } else if (!best.reps || s.topReps > best.reps.value) {
      best.reps = { value: s.topReps, date: s.date }
    }
  }
  return best
}

// 방금 끝낸 기록(log)이 이 운동의 이전 기록들보다 나은 점: [{ kind: 'weight' | 'e1rm' | 'reps', value, prev }]
//   이전 기록이 하나도 없으면(처음 하는 운동) 빈 배열 — 처음은 "갱신"이 아니다. 같은 값은 갱신이 아니다. e1rm은 0.5kg 단위로 비교(추정 오차 때문에 사소한 차이는 무시).
export function newRecordsOf(logs, log) {
  const prevSessions = exerciseSessions(
    logs.filter(l => l.id !== log.id && l.date <= log.date),
    log.exercise,
  )
  if (!prevSessions.length) return []
  const cur = exerciseSessions([log], log.exercise)[0]
  if (!cur) return []
  const prev = personalRecords(prevSessions)
  const out = []
  if (cur.bodyweight) {
    if (prev.reps && cur.topReps > prev.reps.value) out.push({ kind: 'reps', value: cur.topReps, prev: prev.reps.value })
    return out
  }
  if (prev.weight && cur.topWeight > prev.weight.value) out.push({ kind: 'weight', value: cur.topWeight, prev: prev.weight.value })
  if (prev.e1rm && cur.e1rm != null && round05(cur.e1rm) > round05(prev.e1rm.value)) out.push({ kind: 'e1rm', value: round05(cur.e1rm), prev: round05(prev.e1rm.value) })
  return out
}

// 추이 그래프용: 최근 n회의 { date, value } — 무게 있는 운동은 예상 1RM(없으면 최고 무게), 맨몸은 최대 횟수
export function trendSeries(sessions, n = 12) {
  const useBodyweight = sessions.length > 0 && sessions.every(s => s.bodyweight)
  const points = sessions
    .map(s => ({ date: s.date, value: useBodyweight ? s.topReps : s.e1rm != null ? round05(s.e1rm) : s.topWeight }))
    .filter(p => p.value > 0)
  return { kind: useBodyweight ? 'reps' : 'e1rm', points: points.slice(-n) }
}

export const formatKg = v => `${round05(v)}kg`
