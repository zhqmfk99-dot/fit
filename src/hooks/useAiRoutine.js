import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { requestRoutineDraft, buildRoutineDraft, buildHistorySummary, fetchBodyInfo } from '../lib/aiRoutine.js'

// AI 루틴 만들어주기 모달(웹앱·PWA)이 같이 쓰는 상태·로직. 화면(렌더링)만 따로 둔다.
// generate(conditions, repeatDays, options) → 성공하면 루틴 초안, 실패하면 error에 문구를 두고 null.
//   options: { include: 꼭 넣을 운동 id[], avoid: 빼고 싶은 운동 id[], useHistory: 내 운동 기록 참고, useBody: 체형 정보 전송 }
export function useAiRoutine() {
  const { exercises, logs, bodyRecords } = useWorkoutLogs()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async (conditions, repeatDays, options = {}) => {
    if (loading) return null
    if (!exercises.length) {
      setError('운동 리스트가 비어 있어요. 운동 리스트에 운동을 먼저 등록해 주세요.')
      return null
    }
    setLoading(true)
    setError('')
    try {
      const extra = { include: options.include || [], avoid: options.avoid || [] }
      if (options.useHistory) extra.history = buildHistorySummary(logs, exercises)
      if (options.useBody) {
        extra.body = await fetchBodyInfo(user.id, bodyRecords)
        if (!extra.body) throw new Error('보낼 체형 정보가 없어요. "내 정보"에 키·몸무게 등을 입력하거나, 체형 정보 전송을 해제해 주세요.')
      }
      const result = await requestRoutineDraft(conditions, exercises, extra)
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
