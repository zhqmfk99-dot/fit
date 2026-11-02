import { useMemo } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { weeklyGoalStatus } from '../lib/weeklyGoal.js'
import { todayStr } from '../lib/bodyGoal.js'

// 주간 운동 목표 현황(설정의 weeklyGoalDays 기준). 목표가 없으면 null. 계산은 lib/weeklyGoal.js(웹앱·PWA 공용).
export function useWeeklyGoal() {
  const { logs } = useWorkoutLogs()
  const { settings } = useSettings()
  const today = todayStr()
  return useMemo(() => weeklyGoalStatus(logs, settings.weeklyGoalDays, today), [logs, settings.weeklyGoalDays, today])
}
