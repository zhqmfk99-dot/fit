import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { requestRoutineDraft, buildRoutineDraft } from '../lib/aiRoutine.js'

// AI 루틴 만들어주기 모달(웹앱·PWA)이 같이 쓰는 상태·로직. 화면(렌더링)만 따로 둔다.
// generate(conditions, repeatDays) → 성공하면 루틴 초안, 실패하면 error에 문구를 두고 null.
export function useAiRoutine() {
  const { exercises, logs } = useWorkoutLogs()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async (conditions, repeatDays) => {
    if (loading) return null
    if (!exercises.length) {
      setError('운동 리스트가 비어 있어요. 운동 리스트에 운동을 먼저 등록해 주세요.')
      return null
    }
    setLoading(true)
    setError('')
    try {
      const result = await requestRoutineDraft(conditions, exercises)
      const draft = buildRoutineDraft(result, exercises, logs, repeatDays)
      if (!draft.exercises.length) throw new Error('고른 장비로 만들 수 있는 운동이 부족해요. 장비 선택을 넓혀 보세요.')
      return draft
    } catch (e) {
      setError(e.message || 'AI 루틴 생성에 실패했어요.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, generate }
}
