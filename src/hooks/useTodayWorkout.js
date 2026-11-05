import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { getLocalDateString } from './useWorkoutLog.js'
import { todayWorkoutStatus, buildTodayLogs, buildQuickRoutine } from '../lib/todayWorkout.js'

// 오늘 운동하기(웹앱 대시보드 카드): 오늘 상태·시작·즉석 운동 등록. sessionPath = 운동 진행 화면 경로.
// 반환: { status, start, showQuick, openQuick, closeQuick, routines, startExistingRoutine, startCustom }
export function useTodayWorkout(sessionPath = '/workout/session') {
  const navigate = useNavigate()
  const { logs, setLogs, routines, setRoutines } = useWorkoutLogs()
  const { settings } = useSettings()
  const [showQuick, setShowQuick] = useState(false)
  const todayDate = getLocalDateString(new Date())
  const status = useMemo(() => todayWorkoutStatus(logs, routines, todayDate), [logs, routines, todayDate])

  const go = routineId => navigate(`${sessionPath}?routineId=${routineId}&date=${todayDate}`)

  // 오늘 할 운동이 남아 있으면 그 루틴으로 바로 진입, 없으면 즉석 운동 창
  const start = () => (status.routineId ? go(status.routineId) : setShowQuick(true))

  // 오늘 날짜로 루틴의 기록을 만들고 바로 진행 화면으로 — 기존 루틴 불러오기·즉석 등록 공통
  const startRoutineToday = (routineId, exerciseList) => {
    setLogs(prev => [...prev, ...buildTodayLogs(routineId, exerciseList, todayDate, settings.defaultRestSeconds)])
    setShowQuick(false)
    go(routineId)
  }
  const startExistingRoutine = routine => startRoutineToday(routine.id, routine.exercises)
  const startCustom = exerciseList => {
    const routine = buildQuickRoutine(exerciseList)
    setRoutines(prev => [...prev, routine])
    startRoutineToday(routine.id, exerciseList)
  }

  return { status, start, showQuick, openQuick: () => setShowQuick(true), closeQuick: () => setShowQuick(false), routines, startExistingRoutine, startCustom }
}
