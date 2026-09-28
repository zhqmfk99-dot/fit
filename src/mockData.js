// 운동 마스터 리스트 — 운동명 ↔ 부위(react-body-highlighter 슬러그) ↔ 사용장비 매핑.
// 여기 등록된 운동만 대시보드 인체도 계산·자동완성에 잡힌다.
export const exerciseCatalog = [
  { id: 1, name: '스쿼트', muscles: ['quadriceps', 'gluteal', 'hamstring'], equipment: '바벨' },
  { id: 2, name: '데드리프트', muscles: ['lower-back', 'hamstring', 'gluteal'], equipment: '바벨' },
  { id: 3, name: '벤치프레스', muscles: ['chest', 'triceps', 'front-deltoids'], equipment: '바벨' },
  { id: 4, name: '오버헤드프레스', muscles: ['front-deltoids', 'triceps'], equipment: '바벨' },
  { id: 5, name: '풀업', muscles: ['upper-back', 'biceps'], equipment: '맨몸' },
]

export const routines = [
  {
    id: 1,
    name: '5x5 스트렝스 A',
    isActive: true,
    repeatDays: ['월', '목'],
    exercises: [
      { exercise: '스쿼트', sets: 5, reps: 5, weight: 80 },
      { exercise: '벤치프레스', sets: 5, reps: 5, weight: 60 },
    ],
  },
  {
    id: 2,
    name: '5x5 스트렝스 B',
    isActive: true,
    repeatDays: ['화', '금'],
    exercises: [
      { exercise: '데드리프트', sets: 3, reps: 5, weight: 100 },
      { exercise: '오버헤드프레스', sets: 4, reps: 6, weight: 35 },
    ],
  },
]

// 과거 기록은 세트별 소요시간·휴식시간 데이터가 없어서(당시엔 안 쟀으니) null로 둔다.
// 피로도는 그 시절 수동으로 입력했던 값을 그대로 유지한다.
function synthSets(count, reps, weight) {
  return Array.from({ length: count }, () => ({ reps, weight, durationSeconds: null, restBeforeSeconds: null }))
}

const pastWorkoutLogs = [
  { id: 1, date: '2026-09-16', exercise: '스쿼트', performedSets: synthSets(5, 5, 80), fatigue: 3, isCompleted: true },
  { id: 2, date: '2026-09-16', exercise: '벤치프레스', performedSets: synthSets(5, 5, 60), fatigue: 2, isCompleted: true },
  { id: 3, date: '2026-09-18', exercise: '데드리프트', performedSets: synthSets(3, 5, 100), fatigue: 4, isCompleted: true },
  { id: 4, date: '2026-09-18', exercise: '오버헤드프레스', performedSets: synthSets(4, 6, 35), fatigue: 2, isCompleted: true },
  { id: 5, date: '2026-09-20', exercise: '스쿼트', performedSets: synthSets(5, 5, 82.5), fatigue: 3, isCompleted: true },
  { id: 6, date: '2026-09-20', exercise: '풀업', performedSets: synthSets(4, 8, 0), fatigue: 3, isCompleted: true },
  { id: 7, date: '2026-09-22', exercise: '벤치프레스', performedSets: synthSets(5, 5, 62.5), fatigue: 2, isCompleted: true },
]

// 활성 루틴의 반복 요일이면, 아직 안 한 "예정" 기록을 오늘부터 2주치 미리 만들어둔다.
// 미리 보여줘야 뭘 해야 할지 계획하고, 필요하면 날짜를 연기할 수 있다.
// 완료 여부(isCompleted)는 여기서 건드리지 않는다 — PWA에서 실제로 하고 나서 따로 완료 처리한다.
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const SCHEDULE_AHEAD_DAYS = 14

function generateScheduledLogs() {
  const scheduled = []
  const pad = n => String(n).padStart(2, '0')

  for (let offset = 0; offset < SCHEDULE_AHEAD_DAYS; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const dowLabel = DOW_LABELS[d.getDay()]

    routines.forEach(routine => {
      if (!routine.isActive || !routine.repeatDays?.includes(dowLabel)) return
      // 이미 그 루틴에서 그 날짜치가 만들어져 있으면 중복 생성하지 않는다
      const alreadyExists = pastWorkoutLogs.some(l => l.routineId === routine.id && l.date === dateStr)
      if (alreadyExists) return

      routine.exercises.forEach((ex, idx) => {
        scheduled.push({
          id: `sched_${routine.id}_${dateStr}_${idx}`,
          date: dateStr,
          exercise: ex.exercise,
          routineId: routine.id,
          targetSets: ex.sets,
          targetReps: ex.reps,
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

export const workoutLogs = [...generateScheduledLogs(), ...pastWorkoutLogs]
