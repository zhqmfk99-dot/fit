import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { upcomingPendingLogs, withoutUpcomingPending } from '../lib/routineCleanup.js'
import { getLocalDateString } from './useWorkoutLog.js'

// 루틴 목록 화면(데스크탑 테이블/모바일 카드)이 공유하는 상태·로직.
// 화면마다 렌더링(테이블 vs 카드)만 다르고 동작은 완전히 같아야 하므로 훅으로 뽑아둔다.
export function useRoutineManager() {
  const { routines, setRoutines, logs, setLogs } = useWorkoutLogs()
  const [editMode, setEditMode] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [formRow, setFormRow] = useState(null)
  const [detailRow, setDetailRow] = useState(null)
  // AI 루틴 만들기: 조건 입력 모달 → 만들어진 초안(draftRow)을 루틴 등록 화면에 채워 연다 (수정이 아니라 새 루틴이라 formRow는 null)
  const [showAiModal, setShowAiModal] = useState(false)
  const [draftRow, setDraftRow] = useState(null)
  const [showSplitModal, setShowSplitModal] = useState(false) // 분할 프리셋으로 여러 루틴을 한 번에 만드는 창 (lib/splitPlan.js)

  const openCreate = () => {
    setFormRow(null)
    setDraftRow(null)
    setShowFormModal(true)
  }
  const openAiCreate = () => setShowAiModal(true)
  const handleAiDraft = draft => {
    setShowAiModal(false)
    setFormRow(null)
    setDraftRow(draft)
    setShowFormModal(true)
  }
  const enterEditMode = () => {
    setEditMode(true)
    setSelectedId(null)
  }
  const exitEditMode = () => {
    setEditMode(false)
    setSelectedId(null)
  }
  const toggleSelect = (e, id) => {
    e.stopPropagation()
    setSelectedId(prev => (prev === id ? null : id))
  }
  const confirmEdit = () => {
    const routine = routines.find(r => r.id === selectedId)
    if (!routine) return
    setFormRow(routine)
    setDraftRow(null)
    setShowFormModal(true)
    exitEditMode()
  }
  const handleFormSave = saved => {
    setRoutines(prev => (formRow ? prev.map(r => (r.id === saved.id ? saved : r)) : [saved, ...prev]))
  }
  // 루틴을 지우면 그 루틴에서 미리 만들어 둔 앞으로의 예정 기록(오늘 이후, 아직 안 한 것)도 함께 지운다. 이미 한 기록은 그대로 남는다. (lib/routineCleanup.js)
  const handleDelete = routine => {
    const today = getLocalDateString(new Date())
    const upcoming = upcomingPendingLogs(logs, routine.id, today).length
    const extra = upcoming > 0 ? `\n앞으로 예정된 기록 ${upcoming}개도 함께 지워져요. (이미 한 기록은 그대로 남아요.)` : ''
    if (!confirm(`"${routine.name}" 루틴을 삭제할까요?${extra}`)) return
    setRoutines(prev => prev.filter(r => r.id !== routine.id))
    setLogs(prev => withoutUpcomingPending(prev, routine.id, today))
    setDetailRow(null)
  }
  const toggleActive = (e, id) => {
    e.stopPropagation()
    setRoutines(prev => prev.map(r => (r.id === id ? { ...r, isActive: !r.isActive } : r)))
  }

  return {
    routines,
    editMode,
    selectedId,
    showFormModal,
    formRow,
    detailRow,
    showAiModal,
    showSplitModal,
    setShowSplitModal,
    draftRow,
    openCreate,
    openAiCreate,
    handleAiDraft,
    setShowAiModal,
    enterEditMode,
    exitEditMode,
    toggleSelect,
    confirmEdit,
    handleFormSave,
    handleDelete,
    toggleActive,
    setShowFormModal,
    setDetailRow,
    setFormRow,
  }
}
