import { useState } from 'react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'

// 운동 리스트 화면(데스크탑 테이블/모바일 카드)이 공유하는 상태·로직.
export function useExerciseManager() {
  const { exercises, setExercises } = useWorkoutLogs()
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
    const exercise = exercises.find(e => e.id === selectedId)
    if (!exercise) return
    setFormRow(exercise)
    setShowFormModal(true)
    exitEditMode()
  }
  const handleFormSave = saved => {
    setExercises(prev => (formRow ? prev.map(e => (e.id === saved.id ? saved : e)) : [saved, ...prev]))
  }
  const handleDelete = exercise => {
    if (!confirm(`"${exercise.name}" 운동을 삭제할까요?`)) return
    setExercises(prev => prev.filter(e => e.id !== exercise.id))
    setDetailRow(null)
  }

  return {
    exercises,
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
    setShowFormModal,
    setDetailRow,
    setFormRow,
  }
}
