import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { estimateDayKcal, bodyWeightOn } from '../lib/calories.js'

// 한 날짜의 소모 칼로리 — 웹앱·PWA 화면이 같이 쓴다. 그날 완료한 운동들의 저장된 칼로리(workout_logs.kcal)를 합산한다.
// 저장값이 없는 기록(이 기능 이전 기록)만 체중으로 즉석 계산한다.
// kcal: 추정치(그날 완료한 운동이 없거나 계산이 불가능하면 null)
// needsWeight: 완료한 운동은 있는데 저장값도 없고 체중도 몰라서 계산을 못 한 경우 → 화면에 안내를 띄운다
export function useDayKcal(date) {
  const { logs, bodyRecords, profileWeightKg } = useWorkoutLogs()
  const { settings } = useSettings()
  const kcal = estimateDayKcal(date, logs, bodyWeightOn(date, bodyRecords, profileWeightKg), settings.calorieCalibration)
  const hasCompleted = logs.some(l => l.date === date && l.isCompleted && l.performedSets?.length)
  return { kcal, needsWeight: hasCompleted && kcal == null }
}
