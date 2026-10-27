import { useMemo, useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { checkRoutineBalance } from '../lib/routineCheck.js'
import { currentForRefine, requestRoutineReview, lastWeightFor, goalsOf, REVIEW_MAX_EXERCISES } from '../lib/aiRoutine.js'

// 루틴 점검 상자(웹앱·PWA)가 같이 쓰는 상태·로직. 화면(렌더링)만 따로 둔다.
//  - checks: 규칙으로 계산한 균형 점검(AI 아님, 즉시·무료)
//  - run(): 버튼을 눌렀을 때 AI에게 운동별 판정을 받는다. 결과는 { overall, items: [{ exercise, verdict, reason, alternatives: [{ name, reason }] }], remaining }
//  - items: 지금 화면에 아직 있는 운동의 판정만(운동을 바꾸거나 지우면 그 판정은 사라진다)
//  - replaceWith(oldName, newName): 운동을 바꿀 행 정보를 만든다(무게는 새 운동의 내 기록에서, 없으면 빈칸)
// request: AI 초안의 조건(draft.request, 없으면 직접 만드는 루틴)
export function useRoutineReview(rows, request) {
  const { exercises, logs } = useWorkoutLogs()
  const { settings } = useSettings()
  // 목표: AI 초안이 여러 목표로 만들어졌으면 기본값이 "초안 조건 그대로"('draft'), 하나면 그 목표, 직접 만든 루틴이면 지정 안 함('')
  const draftGoals = goalsOf(request?.conditions)
  const [goal, setGoal] = useState(draftGoals.length > 1 ? 'draft' : draftGoals[0] || '')
  const [level, setLevel] = useState(request?.conditions?.level || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const focus = request?.conditions?.focus
  const checks = useMemo(() => checkRoutineBalance(rows, exercises, { focus }), [rows, exercises, focus])

  const filled = rows.filter(r => r.exercise?.trim())
  const reviewable = useMemo(() => currentForRefine(rows, exercises), [rows, exercises])
  const skippedCount = filled.length - reviewable.length // 운동 리스트에 없는(직접 입력한) 운동은 AI가 알 수 없다
  const overLimit = reviewable.length > REVIEW_MAX_EXERCISES

  const run = async () => {
    if (loading) return
    if (!reviewable.length) {
      setError('검토할 운동이 없어요. 운동 리스트에 있는 운동을 한 개 이상 넣어 주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      // 대체 운동 후보 장비: AI 초안의 조건 → 설정의 내 운동기구(맨몸 포함) → 전체
      const equipment = request?.conditions?.equipment?.length ? request.conditions.equipment : settings.myEquipment.length ? [...new Set([...settings.myEquipment, '맨몸'])] : []
      const current = reviewable.slice(0, REVIEW_MAX_EXERCISES)
      const out = await requestRoutineReview({ goals: goal === 'draft' ? draftGoals : goal ? [goal] : [], level, focus, equipment }, exercises, current)
      const byId = new Map(exercises.map(e => [e.id, e]))
      setResult({
        overall: out.overall || '',
        remaining: out.remaining,
        items: out.items
          .filter(i => byId.has(i.id))
          .map(i => ({
            exercise: byId.get(i.id).name,
            verdict: i.verdict,
            reason: i.reason,
            alternatives: i.alternatives.filter(a => byId.has(a.id)).map(a => ({ name: byId.get(a.id).name, reason: a.reason })),
          })),
      })
    } catch (e) {
      setError(e.message || 'AI 루틴 검토에 실패했어요.')
    } finally {
      setLoading(false)
    }
  }

  const items = result ? result.items.filter(i => rows.some(r => r.exercise?.trim() === i.exercise)) : []
  const replacement = newName => ({ exercise: newName, weight: lastWeightFor(newName, logs) ?? '', progressReps: undefined })

  return { goal, setGoal, draftGoals, level, setLevel, loading, error, result, items, checks, skippedCount, overLimit, hasFocus: !!focus?.length, run, replacement }
}
