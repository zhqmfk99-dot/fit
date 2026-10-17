// 활성 루틴의 반복 요일이면, 아직 안 한 "예정" 기록을 오늘부터 2주치 미리 만들어둔다.
// 미리 보여줘야 뭘 해야 할지 계획하고, 필요하면 날짜를 연기할 수 있다.
// 이미 그 루틴에서 그 날짜치 기록이 있으면(완료·연기 포함) 중복 생성하지 않는다.
import { targetRepsOf } from './progression.js'

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const SCHEDULE_AHEAD_DAYS = 14

export function generateScheduledLogs(routines, existingLogs) {
  const scheduled = []
  const pad = n => String(n).padStart(2, '0')

  for (let offset = 0; offset < SCHEDULE_AHEAD_DAYS; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const dowLabel = DOW_LABELS[d.getDay()]

    routines.forEach(routine => {
      if (!routine.isActive || !routine.repeatDays?.includes(dowLabel)) return
      if (existingLogs.some(l => l.routineId === routine.id && l.date === dateStr)) return

      routine.exercises.forEach(ex => {
        scheduled.push({
          id: crypto.randomUUID(),
          date: dateStr,
          exercise: ex.exercise,
          routineId: routine.id,
          targetSets: ex.sets,
          targetReps: targetRepsOf(ex), // 점진 과부하로 올라간 지금 목표 횟수(없으면 루틴의 반복)
          targetWeight: ex.weight,
          restSeconds: ex.restSeconds ?? 90,
          linkedToNext: !!ex.linkedToNext,
          performedSets: [],
          fatigue: null,
          isCompleted: false,
        })
      })
    })
  }

  return scheduled
}
