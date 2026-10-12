import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { generateScheduledLogs } from '../lib/scheduleGenerator.js'

const WorkoutLogsContext = createContext(null)

// ── DB 행 ↔ 앱 객체 변환 ─────────────────────────────────────────
const exerciseFromRow = r => ({
  id: r.id,
  name: r.name,
  muscles: r.muscles ?? [],
  equipment: r.equipment,
  movementPattern: r.movement_pattern ?? null,
  exerciseType: r.exercise_type ?? null,
  tags: r.tags ?? [],
})
const exerciseToRow = e => ({
  id: e.id,
  name: e.name,
  muscles: e.muscles ?? [],
  equipment: e.equipment ?? null,
  movement_pattern: e.movementPattern ?? null,
  exercise_type: e.exerciseType ?? null,
  tags: e.tags ?? [],
})

const routineFromRow = r => ({ id: r.id, name: r.name, isActive: r.is_active, repeatDays: r.repeat_days ?? [], exercises: r.exercises ?? [] })
const routineToRow = r => ({ id: r.id, name: r.name, is_active: !!r.isActive, repeat_days: r.repeatDays ?? [], exercises: r.exercises ?? [] })

const logFromRow = r => ({
  id: r.id,
  date: r.date,
  exercise: r.exercise,
  routineId: r.routine_id ?? undefined,
  targetSets: r.target_sets ?? undefined,
  targetReps: r.target_reps ?? undefined,
  targetWeight: r.target_weight == null ? undefined : Number(r.target_weight),
  restSeconds: r.rest_seconds ?? undefined,
  linkedToNext: r.linked_to_next,
  performedSets: r.performed_sets ?? [],
  fatigue: r.fatigue,
  isCompleted: r.is_completed,
})
const logToRow = l => ({
  id: l.id,
  routine_id: l.routineId ?? null,
  date: l.date,
  exercise: l.exercise,
  target_sets: l.targetSets ?? null,
  target_reps: l.targetReps ?? null,
  target_weight: l.targetWeight ?? null,
  rest_seconds: l.restSeconds ?? null,
  linked_to_next: !!l.linkedToNext,
  performed_sets: l.performedSets ?? [],
  fatigue: l.fatigue ?? null,
  is_completed: !!l.isCompleted,
})

const num = v => (v == null ? null : Number(v))
const bodyRecordFromRow = r => ({
  id: r.id,
  date: r.date,
  heightCm: num(r.height_cm),
  weightKg: num(r.weight_kg),
  bmi: num(r.bmi),
  boneMassKg: num(r.bone_mass_kg),
  bodyFatPct: num(r.body_fat_pct),
  muscleMassKg: num(r.muscle_mass_kg),
  musclePct: num(r.muscle_pct),
  proteinPct: num(r.protein_pct),
  waterPct: num(r.water_pct),
  skeletalMuscleKg: num(r.skeletal_muscle_kg),
  bmr: num(r.bmr),
})
const bodyRecordToRow = b => ({
  id: b.id,
  date: b.date,
  height_cm: b.heightCm ?? null,
  weight_kg: b.weightKg ?? null,
  bmi: b.bmi ?? null,
  bone_mass_kg: b.boneMassKg ?? null,
  body_fat_pct: b.bodyFatPct ?? null,
  muscle_mass_kg: b.muscleMassKg ?? null,
  muscle_pct: b.musclePct ?? null,
  protein_pct: b.proteinPct ?? null,
  water_pct: b.waterPct ?? null,
  skeletal_muscle_kg: b.skeletalMuscleKg ?? null,
  bmr: b.bmr ?? null,
})

// 이전/다음 상태를 id로 비교해 바뀐 행만 upsert, 사라진 행은 delete 한다.
async function persistDiff(table, prev, next, toRow) {
  const prevById = new Map(prev.map(x => [x.id, x]))
  const nextIds = new Set(next.map(x => x.id))
  const changed = next.filter(x => JSON.stringify(prevById.get(x.id)) !== JSON.stringify(x))
  const removedIds = prev.filter(x => !nextIds.has(x.id)).map(x => x.id)

  if (changed.length) {
    const { error } = await supabase.from(table).upsert(changed.map(toRow))
    if (error) throw error
  }
  if (removedIds.length) {
    const { error } = await supabase.from(table).delete().in('id', removedIds)
    if (error) throw error
  }
}

// useState처럼 쓸 수 있는(값 또는 함수형 업데이트) setter를 만들되, 변경분을 Supabase에 비동기로 저장한다.
// 같은 핸들러 안에서 setter를 연달아 불러도 최신 값을 보도록 ref에 동기적으로 반영한다.
function usePersistedState(table, toRow, queueRef, onError) {
  const [state, setState] = useState([])
  const ref = useRef([])

  const set = useCallback(
    updater => {
      const prev = ref.current
      const next = typeof updater === 'function' ? updater(prev) : updater
      ref.current = next
      setState(next)
      // 저장 순서가 뒤바뀌지 않도록 하나의 큐에 이어 붙인다
      queueRef.current = queueRef.current.then(() => persistDiff(table, prev, next, toRow)).catch(onError)
    },
    [table, toRow, queueRef, onError],
  )

  // 서버에서 읽어온 값으로 덮어쓸 때(저장 없이)
  const replace = useCallback(next => {
    ref.current = next
    setState(next)
  }, [])

  return [state, set, replace]
}

export function WorkoutLogsProvider({ children }) {
  const queueRef = useRef(Promise.resolve())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleError = useCallback(e => {
    console.error(e)
    setError(e.message || '저장 중 오류가 발생했습니다.')
  }, [])

  const [logs, setLogs, replaceLogs] = usePersistedState('workout_logs', logToRow, queueRef, handleError)
  const [routines, setRoutines, replaceRoutines] = usePersistedState('routines', routineToRow, queueRef, handleError)
  const [exercises, setExercises, replaceExercises] = usePersistedState('exercises', exerciseToRow, queueRef, handleError)
  const [bodyRecords, setBodyRecords, replaceBodyRecords] = usePersistedState('body_records', bodyRecordToRow, queueRef, handleError)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [ex, ro, lo, bo] = await Promise.all([
        supabase.from('exercises').select('*').order('created_at', { ascending: false }),
        supabase.from('routines').select('*').order('created_at', { ascending: false }),
        supabase.from('workout_logs').select('*').order('date', { ascending: false }).order('created_at', { ascending: true }),
        supabase.from('body_records').select('*').order('date', { ascending: false }),
      ])
      if (cancelled) return
      // 신체 기록은 부가 기능이라 조회에 실패해도(테이블 미생성 등) 나머지 데이터는 정상 로드한다
      if (bo.error) console.warn('body_records 조회 실패:', bo.error.message)
      const firstError = ex.error || ro.error || lo.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }
      const loadedRoutines = ro.data.map(routineFromRow)
      const loadedLogs = lo.data.map(logFromRow)
      replaceExercises(ex.data.map(exerciseFromRow))
      replaceRoutines(loadedRoutines)
      replaceLogs(loadedLogs)
      replaceBodyRecords((bo.data ?? []).map(bodyRecordFromRow))
      setLoading(false)
      // 앞으로 2주치 "예정" 기록을 채워 넣는다 (이미 있으면 건너뜀)
      const scheduled = generateScheduledLogs(loadedRoutines, loadedLogs)
      if (scheduled.length) setLogs(prev => [...scheduled, ...prev])
    })()
    return () => {
      cancelled = true
    }
  }, [replaceExercises, replaceRoutines, replaceLogs, replaceBodyRecords, setLogs])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-gray-400">불러오는 중...</div>
  }

  return (
    <WorkoutLogsContext.Provider value={{ logs, setLogs, routines, setRoutines, exercises, setExercises, bodyRecords, setBodyRecords }}>
      {error && (
        <div className="fixed top-0 inset-x-0 z-[200] bg-red-500 text-white text-xs font-bold px-4 py-2 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>닫기</button>
        </div>
      )}
      {children}
    </WorkoutLogsContext.Provider>
  )
}

export function useWorkoutLogs() {
  const ctx = useContext(WorkoutLogsContext)
  if (!ctx) throw new Error('useWorkoutLogs must be used within WorkoutLogsProvider')
  return ctx
}
