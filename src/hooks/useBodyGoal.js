import { useMemo } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { buildBodyGoal } from '../lib/bodyGoal.js'

// 내 목표(설정의 목표 체중·목표 체지방률·목표일)와 신체 기록을 합쳐 진행 상황·추세·AI 힌트를 계산한다. 웹앱·PWA가 같이 쓴다.
// 반환: { hasGoal, weight, fat, goalDate, daysLeft, goalPassed, hint, suggestedGoals } — 자세한 모양은 lib/bodyGoal.js의 buildBodyGoal
export function useBodyGoal() {
  const { bodyRecords, profileWeightKg } = useWorkoutLogs()
  const { settings } = useSettings()
  const { goalWeightKg, goalBodyFatPct, goalDate } = settings
  return useMemo(
    () => buildBodyGoal(bodyRecords, profileWeightKg, { goalWeightKg, goalBodyFatPct, goalDate }),
    [bodyRecords, profileWeightKg, goalWeightKg, goalBodyFatPct, goalDate],
  )
}
