import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { dayDurationSeconds } from '../lib/workoutTime.js'

// 한 날짜의 총 운동 시간(초) — 웹앱·PWA 화면이 같이 쓴다. 시각이 저장된 기록이 없으면 null.
export function useDayDuration(date) {
  const { logs } = useWorkoutLogs()
  return dayDurationSeconds(date, logs)
}
