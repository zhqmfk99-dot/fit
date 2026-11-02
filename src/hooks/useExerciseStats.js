import { useMemo } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { exerciseSessions, personalRecords, trendSeries } from '../lib/exerciseStats.js'

// 운동 하나의 완료 기록 통계(세션 목록·개인 기록·추이). 계산은 lib/exerciseStats.js.
export function useExerciseStats(name) {
  const { logs } = useWorkoutLogs()
  return useMemo(() => {
    const sessions = exerciseSessions(logs, name)
    return { sessions, pr: personalRecords(sessions), trend: trendSeries(sessions) }
  }, [logs, name])
}