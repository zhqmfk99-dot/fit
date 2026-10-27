import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { generateScheduledLogs } from '../lib/scheduleGenerator.js'
import { applyKcal } from '../lib/calories.js'
import { unilateralNames } from '../lib/workoutMetrics.js'
import { useAuth } from './AuthContext.jsx'
import { useSettings } from './SettingsContext.jsx'

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
  unilateral: !!r.unilateral, // 한쪽씩 하는 운동(횟수를 한쪽 기준으로 적음) — 볼륨·칼로리를 양쪽(×2)으로 센다
})
const exerciseToRow = e => ({
  id: e.id,
  name: e.name,
  muscles: e.muscles ?? [],
  equipment: e.equipment ?? null,
  movement_pattern: e.movementPattern ?? null,
  exercise_type: e.exerciseType ?? null,
  tags: e.tags ?? [],
  unilateral: !!e.unilateral,
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
  kcal: r.kcal == null ? null : Number(r.kcal), // 소모 칼로리(추정) — 완료·수정 시 앱이 계산해서 저장 (lib/calories.js)
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
  kcal: l.kcal ?? null,
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
// transform(next, prev): 저장 직전에 값을 다듬는 선택 함수 (운동 기록에 소모 칼로리를 채울 때 쓴다)
function usePersistedState(table, toRow, queueRef, onError, transform) {
  const [state, setState] = useState([])
  const ref = useRef([])

  const set = useCallback(
    updater => {
      const prev = ref.current
      const raw = typeof updater === 'function' ? updater(prev) : updater
      const next = transform ? transform(raw, prev) : raw
      ref.current = next
      setState(next)
      // 저장 순서가 뒤바뀌지 않도록 하나의 큐에 이어 붙인다
      queueRef.current = queueRef.current.then(() => persistDiff(table, prev, next, toRow)).catch(onError)
    },
    [table, toRow, queueRef, onError, transform],
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
  const { user } = useAuth()
  const { settings } = useSettings() // 소모 칼로리 보정 계수
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // "내 정보"의 체중 — 신체 기록이 없을 때 칼로리 계산에 쓰는 대체값. 부가 정보라 조회에 실패해도 무시한다.
  const [profileWeightKg, setProfileWeightKg] = useState(null)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('weight_kg')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.weight_kg) setProfileWeightKg(Number(data.weight_kg))
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const handleError = useCallback(e => {
    console.error(e)
    setError(e.message || '저장 중 오류가 발생했습니다.')
  }, [])

  // 칼로리 계산에 쓰는 체중 출처(신체 기록, 내 정보 체중). setLogs가 저장 직전에 최신 값을 읽도록 ref에 둔다.
  const weightSourceRef = useRef({ bodyRecords: [], profileWeightKg: null })
  // DB에 kcal 칼럼이 아직 없으면(SQL 미실행) 칼로리를 채우지도 저장하지도 않아서 운동 기록 저장이 실패하지 않게 한다.
  // (이때 화면의 칼로리는 저장값 없이 즉석 계산으로만 보인다)
  const kcalColumnRef = useRef(true)
  const transformLogs = useCallback((next, prev) => (kcalColumnRef.current ? applyKcal(next, prev, weightSourceRef.current) : next), [])
  const toLogRow = useCallback(l => {
    const row = logToRow(l)
    if (!kcalColumnRef.current) delete row.kcal
    return row
  }, [])
  // exercises.unilateral 칼럼이 아직 없으면(SQL 미실행) 그 값은 저장하지 않아서 운동 저장이 실패하지 않게 한다. 이때 표시는 유지되지 않는다.
  const [unilateralSupported, setUnilateralSupported] = useState(true)
  const unilateralColumnRef = useRef(true)
  const toExerciseRow = useCallback(e => {
    const row = exerciseToRow(e)
    if (!unilateralColumnRef.current) delete row.unilateral
    return row
  }, [])
  const [logs, setLogs, replaceLogs] = usePersistedState('workout_logs', toLogRow, queueRef, handleError, transformLogs)
  const [routines, setRoutines, replaceRoutines] = usePersistedState('routines', routineToRow, queueRef, handleError)
  const [exercises, setExercises, replaceExercises] = usePersistedState('exercises', toExerciseRow, queueRef, handleError)
  const [bodyRecords, setBodyRecords, replaceBodyRecords] = usePersistedState('body_records', bodyRecordToRow, queueRef, handleError)
  weightSourceRef.current = { bodyRecords, profileWeightKg, calibration: settings.calorieCalibration, uni: unilateralNames(exercises) }

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
      const loadedExercises = ex.data.map(exerciseFromRow)
      // unilateral 칼럼 유무 확인: 행이 있는데 키가 없으면 칼럼이 아직 없는 것
      if (ex.data.length && !('unilateral' in ex.data[0])) {
        unilateralColumnRef.current = false
        setUnilateralSupported(false)
        console.warn('exercises.unilateral 칼럼이 없어 한쪽씩 표시를 저장하지 않습니다. supabase/unilateral.sql을 실행하세요.')
      }
      replaceExercises(loadedExercises)
      replaceRoutines(loadedRoutines)
      const loadedBodyRecords = (bo.data ?? []).map(bodyRecordFromRow)
      // kcal 칼럼 유무 확인: 행이 있는데 kcal 키가 없으면 칼럼이 아직 없는 것
      if (lo.data.length && !('kcal' in lo.data[0])) {
        kcalColumnRef.current = false
        console.warn('workout_logs.kcal 칼럼이 없어 칼로리를 저장하지 않습니다. supabase/log_kcal.sql을 실행하세요.')
      }
      replaceLogs(loadedLogs)
      replaceBodyRecords(loadedBodyRecords)
      setLoading(false)
      // 이 시점의 렌더 전이라 ref가 아직 비어 있으므로, 칼로리 채우기에 쓸 체중 출처를 직접 넣어 둔다
      weightSourceRef.current = { ...weightSourceRef.current, bodyRecords: loadedBodyRecords, uni: unilateralNames(loadedExercises) }
      // 앞으로 2주치 "예정" 기록을 채워 넣고(이미 있으면 건너뜀), 칼로리가 비어 있는 완료 기록(이 기능 이전 기록)은 체중을 알면 채운다
      const scheduled = generateScheduledLogs(loadedRoutines, loadedLogs)
      setLogs(prev => [...scheduled, ...prev])
    })()
    return () => {
      cancelled = true
    }
  }, [replaceExercises, replaceRoutines, replaceLogs, replaceBodyRecords, setLogs])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-gray-400">불러오는 중...</div>
  }

  return (
    <WorkoutLogsContext.Provider value={{ logs, setLogs, routines, setRoutines, exercises, setExercises, bodyRecords, setBodyRecords, profileWeightKg, unilateralSupported }}>
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
