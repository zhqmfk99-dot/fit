import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'

// 루틴 목록 화면(데스크탑 테이블/모바일 카드)이 공유하는 상태·로직.
// 화면마다 렌더링(테이블 vs 카드)만 다르고 동작은 완전히 같아야 하므로 훅으로 뽑아둔다.
export function useRoutineManager() {
  const { routines, setRoutines } = useWorkoutLogs()
  const [editMode, setEditMode] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [formRow, setFormRow] = useState(null)
  const [detailRow, setDetailRow] = useState(null)

  const openCreate = () => {
    setFormRow(null)
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
    setShowFormModal(true)
    exitEditMode()
  }
  const handleFormSave = saved => {
    setRoutines(prev => (formRow ? prev.map(r => (r.id === saved.id ? saved : r)) : [saved, ...prev]))
  }
  const handleDelete = routine => {
    if (!confirm(`"${routine.name}" 루틴을 삭제할까요?`)) return
    setRoutines(prev => prev.filter(r => r.id !== routine.id))
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
    openCreate,
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
