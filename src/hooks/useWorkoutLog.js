import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { getRecentMaxWeight, estimateExerciseFatigue } from '../lib/workoutMetrics.js'

export const getLocalDateString = d => {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fatigueDotColor(level) {
  if (level <= 2) return 'bg-green-400'
  if (level === 3) return 'bg-yellow-400'
  return 'bg-red-400'
}
export function fatigueBadgeColor(level) {
  if (level <= 2) return 'bg-green-50 text-green-600'
  if (level === 3) return 'bg-yellow-50 text-yellow-600'
  return 'bg-red-50 text-red-600'
}

// "기록" 화면(데스크탑 캘린더+사이드리스트 / 모바일 캘린더+카드리스트)이 공유하는 상태·로직.
export function useWorkoutLog() {
  const navigate = useNavigate()
  const { logs, setLogs, routines } = useWorkoutLogs()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [listDate, setListDate] = useState(getLocalDateString(new Date()))

  const [showModal, setShowModal] = useState(false)
  const [modalRow, setModalRow] = useState(null)
  const [modalDate, setModalDate] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const calendarCells = useMemo(() => {
    const cells = []
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ date: new Date(year, month - 1, daysInPrevMonth - firstDayOfMonth + i + 1), isCurrentMonth: false })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }
    return cells
  }, [year, month, daysInMonth, firstDayOfMonth, daysInPrevMonth])

  const displayedLogs = useMemo(() => {
    if (!searchQuery) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(l => l.exercise.toLowerCase().includes(q))
  }, [logs, searchQuery])

  // 등록/생성된 순서 그대로 둔다 — 루틴 그룹은 이 순서가 곧 운동 시작 화면의 진행 순서와 같아야 한다
  const sidebarLogs = useMemo(() => displayedLogs.filter(l => l.date === listDate), [displayedLogs, listDate])

  // 같은 루틴에서 나온 기록은 하나의 아코디언 카드로 묶는다
  const [expandedRoutineIds, setExpandedRoutineIds] = useState([])
  const toggleExpand = routineId => {
    setExpandedRoutineIds(prev => (prev.includes(routineId) ? prev.filter(id => id !== routineId) : [...prev, routineId]))
  }

  // 루틴 세션 전체(같은 routineId + 같은 날짜)를 한번에 다른 날짜로 옮기기
  const [rescheduleTarget, setRescheduleTarget] = useState(null) // { routineId, oldDate, routineName }
  const handleRescheduleConfirm = newDate => {
    if (!rescheduleTarget) return
    const { routineId, oldDate } = rescheduleTarget
    if (newDate !== oldDate) {
      setLogs(prev => prev.map(l => (l.routineId === routineId && l.date === oldDate ? { ...l, date: newDate } : l)))
    }
  }

  const { routineGroups, standaloneLogs } = useMemo(() => {
    const groups = []
    const groupMap = {}
    const standalone = []
    sidebarLogs.forEach(log => {
      if (!log.routineId) {
        standalone.push(log)
        return
      }
      if (!groupMap[log.routineId]) {
        groupMap[log.routineId] = { routineId: log.routineId, logs: [] }
        groups.push(groupMap[log.routineId])
      }
      groupMap[log.routineId].logs.push(log)
    })
    // 루틴 안 운동은 등록 순서(=진행 순서) 유지, 루틴 없는 개별 기록만 이름순으로 찾기 쉽게 정렬
    standalone.sort((a, b) => a.exercise.localeCompare(b.exercise))
    return { routineGroups: groups, standaloneLogs: standalone }
  }, [sidebarLogs])

  const openCreate = dateStr => {
    setModalRow(null)
    setModalDate(dateStr)
    setShowModal(true)
  }
  const openEdit = row => {
    setModalRow(row)
    setModalDate(row.date)
    setShowModal(true)
  }
  const handleDelete = id => {
    if (!confirm('이 기록을 삭제할까요?')) return
    setLogs(prev => prev.filter(l => l.id !== id))
  }
  const toggleComplete = id => {
    setLogs(prev =>
      prev.map(l => {
        if (l.id !== id) return l
        if (l.isCompleted) return { ...l, isCompleted: false }
        // 세션을 거치지 않고 바로 완료 처리하는 경우 — 목표치를 실제 기록으로 채우고 피로도를 계산한다
        const performedSets = l.performedSets?.length
          ? l.performedSets
          : Array.from({ length: l.targetSets || 1 }, () => ({
              reps: l.targetReps || 0,
              weight: l.targetWeight || 0,
              durationSeconds: null,
              restBeforeSeconds: null,
            }))
        const recentMax = getRecentMaxWeight(logs, l.exercise)
        const fatigue = estimateExerciseFatigue(performedSets, recentMax)
        return { ...l, performedSets, fatigue, isCompleted: true }
      }),
    )
  }
  const handleModalSave = saved => {
    setLogs(prev => (modalRow ? prev.map(l => (l.id === saved.id ? saved : l)) : [saved, ...prev]))
    setListDate(saved.date)
  }

  return {
    navigate,
    routines,
    currentDate,
    year,
    month,
    calendarCells,
    prevMonth,
    nextMonth,
    goToday,
    searchQuery,
    setSearchQuery,
    listDate,
    setListDate,
    displayedLogs,
    sidebarLogs,
    routineGroups,
    standaloneLogs,
    expandedRoutineIds,
    toggleExpand,
    rescheduleTarget,
    setRescheduleTarget,
    handleRescheduleConfirm,
    showModal,
    setShowModal,
    modalRow,
    modalDate,
    openCreate,
    openEdit,
    handleDelete,
    toggleComplete,
    handleModalSave,
  }
}
