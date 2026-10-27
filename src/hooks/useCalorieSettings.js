import { useState } from 'react'
import { useSettings, SETTING_LIMITS } from '../context/SettingsContext.jsx'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'

// 소모 칼로리 보정 설정(PWA·웹앱 설정 화면이 같이 쓴다): 계수 조절, 시계 값과 비교해서 맞추기, 과거 기록 다시 계산.
//  - 보정 계수는 새로 저장되는 기록부터 적용된다. 이미 저장된 값은 그대로이므로, 과거까지 맞추려면 recompute()를 쓴다.
const round2 = n => Math.round(n * 100) / 100

export function useCalorieSettings() {
  const { settings, update } = useSettings()
  const { logs, setLogs } = useWorkoutLogs()
  const [message, setMessage] = useState('')
  const value = settings.calorieCalibration

  const doneCount = logs.filter(l => l.isCompleted && l.performedSets?.length).length

  const step = delta => {
    update({ calorieCalibration: round2(value + delta) })
    setMessage('')
  }

  // 앱이 보여준 값과 시계(또는 다른 운동 앱)가 보여준 값을 비교해서 계수를 정한다.
  // 앱 값에는 지금 계수가 이미 곱해져 있으므로 "지금 계수 × 시계 ÷ 앱"이 새 계수다. 범위(0.5~1.5)를 넘으면 한계값으로 맞춘다.
  const fitFromWatch = (appKcal, watchKcal) => {
    const a = Number(appKcal)
    const w = Number(watchKcal)
    if (!(a > 0) || !(w > 0)) {
      setMessage('앱 값과 시계 값을 모두 0보다 크게 입력해 주세요.')
      return false
    }
    const raw = value * (w / a)
    const next = Math.min(SETTING_LIMITS.calMax, Math.max(SETTING_LIMITS.calMin, Math.round(raw * 20) / 20))
    update({ calorieCalibration: next })
    setMessage(`보정 계수를 ×${next.toFixed(2)}로 바꿨어요.${raw !== next ? ' (조절 범위 0.5~1.5를 넘어서 한계값으로 맞췄어요)' : ''} 앞으로 저장되는 기록부터 적용돼요.`)
    return true
  }

  // 완료한 기록의 저장된 칼로리를 지우면 저장 로직(applyKcal)이 지금 계수와 체중으로 다시 계산해서 채운다
  const recompute = () => {
    if (doneCount === 0) {
      setMessage('다시 계산할 완료 기록이 없어요.')
      return
    }
    const ok = confirm(`완료한 운동 기록 ${doneCount}건의 소모 칼로리를 현재 보정 계수(×${value.toFixed(2)})로 다시 계산해서 덮어써요.\n지금까지 저장된 값이 바뀌어요. 계속할까요?`)
    if (!ok) return
    setLogs(prev => prev.map(l => (l.isCompleted && l.performedSets?.length ? { ...l, kcal: null } : l)))
    setMessage(`${doneCount}건을 다시 계산했어요.`)
  }

  return { value, step, fitFromWatch, recompute, doneCount, message, limits: SETTING_LIMITS }
}
