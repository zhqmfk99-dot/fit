import { useMemo } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { bodyCheckReminder, describeBodyCheckReminder } from '../lib/bodyCheckReminder.js'

// 신체 측정 기록 알림(마지막 기록일 + 14일). 웹앱·PWA의 대시보드 "내 목표" 카드가 같이 쓴다.
// 반환: { reminder(알릴 때만 객체, 아니면 null), text(화면 문장) }
export function useBodyCheckReminder() {
  const { bodyRecords } = useWorkoutLogs()
  return useMemo(() => {
    const reminder = bodyCheckReminder(bodyRecords)
    return { reminder, text: describeBodyCheckReminder(reminder) }
  }, [bodyRecords])
}
