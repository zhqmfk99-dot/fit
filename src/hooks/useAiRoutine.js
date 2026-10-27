import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { requestRoutineDraft, buildRoutineDraft, buildHistorySummary, fetchBodyInfo, currentForRefine, mergeRefined } from '../lib/aiRoutine.js'

// AI 루틴 만들어주기 모달(웹앱·PWA)이 같이 쓰는 상태·로직. 화면(렌더링)만 따로 둔다.
// generate(conditions, repeatDays, options) → 성공하면 루틴 초안, 실패하면 error에 문구를 두고 null.
//   options: { include: 꼭 넣을 운동 id[], avoid: 빼고 싶은 운동 id[], useHistory: 내 운동 기록 참고, useBody: 체형 정보 전송, goalHint: 내 목표에서 계산한 방향·크기(체형 정보 전송을 켰을 때만 함께 보낸다) }
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
        extra.body = await fetchBodyInfo(user.id, bodyRecords, options.goalHint)
        if (!extra.body) throw new Error('보낼 체형 정보가 없어요. "내 정보"에 키·몸무게 등을 입력하거나, 체형 정보 전송을 해제해 주세요.')
      }
      const result = await requestRoutineDraft(conditions, exercises, extra)
      const draft = buildRoutineDraft(result, exercises, logs, repeatDays)
      if (!draft.exercises.length) throw new Error('고른 장비로 만들 수 있는 운동이 부족해요. 장비 선택을 넓혀 보세요.')
      // 수정 요청(다듬기)에서 같은 조건으로 다시 부를 수 있게 이 초안을 만든 조건을 담아 둔다(저장되지는 않는다)
      draft.request = { conditions, extra: { avoid: extra.avoid, history: extra.history, body: extra.body } }
      return draft
    } catch (e) {
      setError(e.message || 'AI 루틴 생성에 실패했어요.')
      return null
    } finally {
      setLoading(false)
    }
  }

  // 만들어진 초안을 말로 고친다: 지금 화면의 운동 행들과 요청 문장을 보내고, 수정된 행들과 설명을 돌려준다(실패하면 null)
  const refine = async (request, rows, instruction) => {
    if (loading) return null
    setLoading(true)
    setError('')
    try {
      const current = currentForRefine(rows, exercises)
      if (!current.length) throw new Error('수정할 운동이 없어요. 운동 리스트에 있는 운동이 한 개 이상 있어야 해요.')
      const result = await requestRoutineDraft(request.conditions, exercises, { ...request.extra, include: [], current, instruction })
      return { rows: mergeRefined(result, rows, exercises, logs), summary: result.summary || '' }
    } catch (e) {
      setError(e.message || '루틴 수정에 실패했어요.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, generate, refine }
}
