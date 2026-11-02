// 운동 진행 중 "다른 운동으로 바꾸기" — PWA 운동 진행 화면이 쓴다. 순수 함수만 있다(UI·저장소 의존 없음).
//
// 추천: 지금 운동과 **같은 부위(근육)를 쓰는 운동을 먼저** 보여 준다. 규칙 기반이라 같은 입력이면 항상 같은 결과다(AI 아님).
//   정렬 점수 = 지금 운동의 **주 근육(근육 목록의 첫 번째)**을 쓰면 +100, 근육이 겹치는 비율 ×40, 같은 동작 패턴 +15, 같은 운동 유형 +8,
//   내가 쓸 수 있는 기구(설정의 "내 운동기구", 맨몸은 항상 가능)면 +10, 지금 운동과 같은 기구면 +3. 같은 점수면 이름순.
//   운동 리스트의 근육은 주동근 위주로 앞에 적혀 있다는 가정이다(seed_exercises.sql) — 직접 등록한 운동은 순서가 다를 수 있다.
//   "같은 부위" = 근육이 하나라도 겹치는 운동, 나머지는 "다른 부위"(기본은 접어 둔다).
//   이미 오늘 운동 목록에 있는 운동은 뺀다(같은 운동이 오늘 두 번 들어가지 않게).

import { buildTagIndex, matchesQuery } from './exerciseSearch.js'

const WEIGHTS = { primary: 100, overlap: 40, pattern: 15, type: 8, usable: 10, equipment: 3 }

// current: { name, muscles, movementPattern, exerciseType, equipment } — 운동 리스트에 없는 운동이면 name만 있어도 된다
// 반환: { same: [...], other: [...] } 각 항목 { exercise, shared(겹치는 근육), hasPrimary, samePattern, sameType, usable, score }
export function suggestSwaps(current, catalog, { excludeNames = new Set(), myEquipment = [], query = '' } = {}) {
  const curMuscles = current.muscles || []
  const primary = curMuscles[0]
  const curSet = new Set(curMuscles)
  const mine = myEquipment.length ? new Set([...myEquipment, '맨몸']) : null
  const tags = buildTagIndex(catalog)
  const q = query.trim()

  const scored = catalog
    .filter(e => e.name !== current.name && !excludeNames.has(e.name) && (!q || matchesQuery(e.name, tags.get(e.name), q)))
    .map(e => {
      const ms = e.muscles || []
      const shared = ms.filter(m => curSet.has(m))
      const hasPrimary = !!primary && ms.includes(primary)
      const ratio = curSet.size ? shared.length / curSet.size : 0
      const samePattern = !!current.movementPattern && e.movementPattern === current.movementPattern
      const sameType = !!current.exerciseType && e.exerciseType === current.exerciseType
      const usable = !mine || !e.equipment || mine.has(e.equipment)
      const score =
        (hasPrimary ? WEIGHTS.primary : 0) +
        ratio * WEIGHTS.overlap +
        (samePattern ? WEIGHTS.pattern : 0) +
        (sameType ? WEIGHTS.type : 0) +
        (usable ? WEIGHTS.usable : 0) +
        (e.equipment && e.equipment === current.equipment ? WEIGHTS.equipment : 0)
      return { exercise: e, shared, hasPrimary, samePattern, sameType, usable, score }
    })
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, 'ko'))

  return { same: scored.filter(s => s.shared.length > 0), other: scored.filter(s => s.shared.length === 0) }
}

// 오늘 이 루틴 기록에 들어 있는 운동 이름(후보에서 뺀다 — 같은 운동이 오늘 두 번 들어가지 않게).
// 루틴에는 있지만 오늘 다른 운동으로 바꿔서 빠진 운동은 후보에 남는다(다시 되돌릴 수 있게).
export function sessionExcludeNames(logs, routineId, date) {
  return new Set(logs.filter(l => l.routineId === routineId && l.date === date).map(l => l.exercise))
}

// 루틴에 들어 있는 운동 이름. 이미 루틴에 있는 운동으로 "루틴에도 반영"하면 루틴에 같은 운동이 두 번 생기므로, 그 운동은 오늘만 바꿀 수 있다.
export const routineExerciseNames = (routines, routineId) => new Set(routines.find(r => r.id === routineId)?.exercises?.map(ex => ex.exercise) ?? [])

// 오늘 기록의 운동을 바꾼다. 세트·횟수·휴식 목표는 그대로 두고 운동명과 무게만 바뀐다.
//  toRoutine이면 앞으로 예정된(아직 안 한) 같은 운동 기록도 같이 바꾼다 — 오늘 이후 날짜만(이미 한 기록은 건드리지 않는다).
// log에 한 세트라도 기록돼 있으면 바꾸지 않는다(그 기록이 다른 운동의 것으로 둔갑하지 않게). 호출하는 쪽이 막지만 한 번 더 방어한다.
export function swapLogs(logs, log, newName, weight, toRoutine) {
  const w = Number(weight) > 0 ? Number(weight) : 0
  return logs.map(l => {
    if (l.id === log.id) return l.performedSets?.length || l.isCompleted ? l : { ...l, exercise: newName, targetWeight: w }
    if (toRoutine && log.routineId && l.routineId === log.routineId && l.exercise === log.exercise && !l.isCompleted && l.date > log.date) return { ...l, exercise: newName, targetWeight: w }
    return l
  })
}

// 루틴의 해당 운동 항목을 새 운동으로 바꾼다(세트·횟수·휴식·수퍼세트 묶기는 그대로, 무게는 새 운동 기준, 자동 관리하는 맨몸 목표 횟수는 지운다)
export function swapRoutine(routines, log, newName, weight) {
  const w = Number(weight) > 0 ? Number(weight) : 0
  return routines.map(r =>
    r.id === log.routineId ? { ...r, exercises: r.exercises.map(ex => (ex.exercise === log.exercise ? { ...ex, exercise: newName, weight: w, progressReps: undefined } : ex)) } : r,
  )
}
