// 루틴에서 빠진 운동 다시 채우기 — 웹앱·PWA 공용 로직(UI 아님), 서버 연결이 없는 순수 함수.
//
// 기록 화면에서 그날 루틴 묶음의 운동 하나를 실수로 지우면, 앱은 "그 루틴에 그 날짜 기록이 하나라도 있으면" 예정 기록을 다시 만들지 않아서 지운 운동이 돌아오지 않았다.
// 루틴(`routine.exercises`)에는 있는데 그 날 묶음(같은 루틴·같은 날짜의 기록)에는 없는 운동을 찾아 예정 기록으로 다시 만든다.
//  · 운동 이름으로 맞춘다. 루틴에 같은 운동이 두 번 있으면 두 번 있어야 "있는" 것이다.
//  · 이미 한 기록·건너뜀 기록은 그대로 두고(있는 것으로 센다) 빠진 것만 더한다.
//  · 루틴의 운동 순서 자리에 끼워 넣는다(`orderLogsByRoutine`).
//  · 날짜 변경으로 옮겨 온 묶음이면 그 표시(`movedFrom`)를 새 기록에도 이어 준다 — 어느 기록이 남아도 원래 날짜가 다시 채워지지 않게(lib/reschedule.js).
// 주의: 오늘 다른 운동으로 "오늘만 바꾸기"를 한 운동은 이름이 달라져서 원래 운동이 빠진 것으로 보인다 — 화면의 확인창에 운동 이름을 보여 주고 사용자가 고르게 한다.
import { buildTodayLogs } from './todayWorkout.js'
import { orderLogsByRoutine } from './logOrder.js'

// 루틴 운동 중 그 묶음(같은 루틴·같은 날짜의 기록 목록)에 없는 것(루틴 순서대로)
export function missingRoutineExercises(routine, groupLogs) {
  if (!routine) return []
  const remaining = new Map() // 운동 이름 → 묶음에 있는 개수
  for (const l of groupLogs ?? []) remaining.set(l.exercise, (remaining.get(l.exercise) ?? 0) + 1)
  const missing = []
  for (const ex of routine.exercises ?? []) {
    const n = remaining.get(ex.exercise) ?? 0
    if (n > 0) remaining.set(ex.exercise, n - 1)
    else missing.push(ex)
  }
  return missing
}

// logs에 그 날 묶음의 빠진 운동을 예정 기록으로 더한 새 기록 목록. 더할 게 없으면 logs 그대로.
export function restoreMissingLogs(logs, routines, routine, date, defaultRestSeconds, newId = () => crypto.randomUUID()) {
  if (!routine) return logs
  const group = logs.filter(l => l.routineId === routine.id && l.date === date)
  const missing = missingRoutineExercises(routine, group)
  if (!missing.length) return logs
  const movedFrom = [...new Set(group.flatMap(l => (Array.isArray(l.movedFrom) ? l.movedFrom : [])))].sort()
  const added = buildTodayLogs(routine.id, missing, date, defaultRestSeconds, newId).map(l => (movedFrom.length ? { ...l, movedFrom } : l))
  return orderLogsByRoutine([...logs, ...added], routines)
}
