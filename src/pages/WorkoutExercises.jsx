import { useState, useEffect, useRef } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import ExerciseFormModal from '../components/web/ExerciseFormModal.jsx'
import ExerciseDetailModal from '../components/web/ExerciseDetailModal.jsx'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { MUSCLE_LABELS, UPPER_BODY_MUSCLES, LOWER_BODY_MUSCLES, EQUIPMENT_OPTIONS } from '../lib/muscleMap.js'

const DEFAULT_COLUMNS = [
  { label: '운동명', key: 'name', w: 180 },
  { label: '부위', key: null, w: 320 },
  { label: '사용장비', key: 'equipment', w: 130 },
]
const COL_STORAGE_KEY = 'training_exercises_col'

export default function WorkoutExercises() {
  const { exercises, setExercises } = useWorkoutLogs()

  // 필터 — 드롭박스 대신 값 하나하나를 뱃지로 눌러서 토글 (즉시 반영, 서버 왕복이 없는 화면이라 조회 버튼 불필요)
  const [muscleFilter, setMuscleFilter] = useState([])
  const [equipmentFilter, setEquipmentFilter] = useState([])
  const toggleMuscleFilter = m => setMuscleFilter(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]))
  const toggleEquipmentFilter = eq => setEquipmentFilter(prev => (prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]))
  const resetFilters = () => {
    setMuscleFilter([])
    setEquipmentFilter([])
  }
  // 부위는 선택할수록 좁혀지는 AND — "가슴이면서 삼두인 운동"처럼 고르라고 여러 개 누르는 것이지,
  // "가슴 또는 삼두"로 넓히려는 게 아니다. 사용장비는 운동 하나에 값이 하나뿐이라 여러 개 고르면 OR(합집합).
  const filteredExercises = exercises.filter(
    ex =>
      muscleFilter.every(m => ex.muscles.includes(m)) &&
      (equipmentFilter.length === 0 || equipmentFilter.includes(ex.equipment)),
  )

  // 정렬
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'none' })
  const requestSort = key => {
    let direction = 'asc'
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc'
      else if (sortConfig.direction === 'desc') direction = 'none'
    }
    setSortConfig({ key: direction === 'none' ? null : key, direction })
  }
  const getSortIcon = key => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? '↑' : sortConfig.direction === 'desc' ? '↓' : null
  }
  const sortedExercises = [...filteredExercises].sort((a, b) => {
    const { key, direction } = sortConfig
    if (!key || direction === 'none') return 0
    const av = String(a[key] ?? '')
    const bv = String(b[key] ?? '')
    return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  // 칼럼 순서·너비 (드래그 이동 + 리사이즈, localStorage 기억)
  const [colOrder, setColOrder] = useState(DEFAULT_COLUMNS.map((_, i) => i))
  const [colWidths, setColWidths] = useState(DEFAULT_COLUMNS.map(c => c.w))
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const resizingRef = useRef(null)
  const dragSrcRef = useRef(null)
  const wasDraggedRef = useRef(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COL_STORAGE_KEY))
      if (saved?.order?.length === DEFAULT_COLUMNS.length) setColOrder(saved.order)
      if (saved?.widths?.length === DEFAULT_COLUMNS.length) setColWidths(saved.widths)
    } catch {}
  }, [])
  useEffect(() => {
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify({ order: colOrder, widths: colWidths }))
  }, [colOrder, colWidths])

  const resetColSettings = () => {
    setColOrder(DEFAULT_COLUMNS.map((_, i) => i))
    setColWidths(DEFAULT_COLUMNS.map(c => c.w))
    localStorage.removeItem(COL_STORAGE_KEY)
  }

  const handleResizeStart = (e, visualIdx) => {
    e.preventDefault()
    e.stopPropagation()
    const origIdx = colOrder[visualIdx]
    resizingRef.current = { origIdx, startX: e.clientX, startW: colWidths[origIdx] }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const onMove = ev => {
      if (!resizingRef.current) return
      const { origIdx, startX, startW } = resizingRef.current
      setColWidths(prev => {
        const next = [...prev]
        next[origIdx] = Math.max(50, startW + (ev.clientX - startX))
        return next
      })
    }
    const onUp = () => {
      resizingRef.current = null
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }
  const handleDragStart = (e, visualIdx) => {
    dragSrcRef.current = visualIdx
    wasDraggedRef.current = false
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, visualIdx) => {
    e.preventDefault()
    setDragOverIdx(visualIdx)
  }
  const handleDrop = (e, visualIdx) => {
    e.preventDefault()
    setDragOverIdx(null)
    if (dragSrcRef.current === null || dragSrcRef.current === visualIdx) return
    wasDraggedRef.current = true
    const newOrder = [...colOrder]
    const [moved] = newOrder.splice(dragSrcRef.current, 1)
    newOrder.splice(visualIdx, 0, moved)
    setColOrder(newOrder)
    dragSrcRef.current = null
  }
  const handleDragEnd = () => {
    setDragOverIdx(null)
    setTimeout(() => {
      wasDraggedRef.current = false
    }, 50)
  }

  // 행 선택 (Shift 범위선택 지원) — 선택한 것들을 아래 "선택실행"에서 등록/수정/삭제로 처리
  const [selectedIds, setSelectedIds] = useState([])
  const [lastSelectedId, setLastSelectedId] = useState(null)
  const allChecked = sortedExercises.length > 0 && sortedExercises.every(ex => selectedIds.includes(ex.id))
  const handleSelectAll = () => {
    const visibleIds = sortedExercises.map(ex => ex.id)
    setSelectedIds(allChecked ? [] : visibleIds)
  }
  const handleSelectOne = (e, id) => {
    const rowIds = sortedExercises.map(ex => ex.id)
    if (e.shiftKey && lastSelectedId != null) {
      const from = rowIds.indexOf(lastSelectedId)
      const to = rowIds.indexOf(id)
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from]
        const range = rowIds.slice(start, end + 1)
        setSelectedIds(prev => Array.from(new Set([...prev, ...range])))
        setLastSelectedId(id)
        return
      }
    }
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    setLastSelectedId(id)
  }

  // 선택실행 — 등록/수정/삭제
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [formRow, setFormRow] = useState(null)
  const [detailRow, setDetailRow] = useState(null)

  const openCreate = () => {
    setFormRow(null)
    setShowFormModal(true)
    setIsActionMenuOpen(false)
  }
  const openEdit = () => {
    if (selectedIds.length !== 1) {
      alert('수정할 운동을 1개만 선택해 주세요.')
      return
    }
    setFormRow(exercises.find(ex => ex.id === selectedIds[0]))
    setShowFormModal(true)
    setIsActionMenuOpen(false)
  }
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      alert('삭제할 운동을 선택해 주세요.')
      return
    }
    if (!confirm(`선택한 운동 ${selectedIds.length}개를 삭제할까요?`)) return
    setExercises(prev => prev.filter(ex => !selectedIds.includes(ex.id)))
    setSelectedIds([])
    setIsActionMenuOpen(false)
  }
  const handleFormSave = saved => {
    setExercises(prev => (formRow ? prev.map(ex => (ex.id === saved.id ? saved : ex)) : [saved, ...prev]))
    setSelectedIds([])
  }
  const handleDeleteOne = exercise => {
    if (!confirm(`"${exercise.name}" 운동을 삭제할까요?`)) return
    setExercises(prev => prev.filter(ex => ex.id !== exercise.id))
    setDetailRow(null)
  }

  const renderCell = (origIdx, row) => {
    switch (origIdx) {
      case 0:
        return (
          <td key={origIdx} className="p-4 text-left truncate font-bold text-gray-800" title={row.name}>
            {row.name}
          </td>
        )
      case 1:
        return (
          <td key={origIdx} className="p-4 text-left">
            <div className="flex flex-wrap gap-1">
              {row.muscles.map(m => (
                <span key={m} className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {MUSCLE_LABELS[m] || m}
                </span>
              ))}
            </div>
          </td>
        )
      case 2:
        return (
          <td key={origIdx} className="p-4 text-center">
            {row.equipment && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-letusBlue">{row.equipment}</span>}
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div>
      <PageHeader title="운동 리스트" color="bg-letusOrange" />
      <div className="p-4 space-y-3">
        {/* 필터 카드 — 드롭박스 대신 값별 뱃지 토글 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-500 shrink-0 pt-1 w-16">상체</span>
            <div className="flex flex-wrap gap-1.5">
              {UPPER_BODY_MUSCLES.map(m => {
                const isSelected = muscleFilter.includes(m)
                return (
                  <button
                    key={m}
                    onClick={() => toggleMuscleFilter(m)}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                      isSelected ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-500 shrink-0 pt-1 w-16">하체</span>
            <div className="flex flex-wrap gap-1.5">
              {LOWER_BODY_MUSCLES.map(m => {
                const isSelected = muscleFilter.includes(m)
                return (
                  <button
                    key={m}
                    onClick={() => toggleMuscleFilter(m)}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                      isSelected ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-500 shrink-0 pt-1 w-16">사용장비</span>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map(eq => {
                const isSelected = equipmentFilter.includes(eq)
                return (
                  <button
                    key={eq}
                    onClick={() => toggleEquipmentFilter(eq)}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                      isSelected ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {eq}
                  </button>
                )
              })}
            </div>
          </div>
          {(muscleFilter.length > 0 || equipmentFilter.length > 0) && (
            <div className="flex justify-end">
              <button onClick={resetFilters} className="text-xs font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2">
                필터 초기화
              </button>
            </div>
          )}
        </div>

        {/* 칼럼 초기화 + 선택실행 액션바 */}
        <div className="flex justify-end items-center gap-3">
          <button
            onClick={resetColSettings}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 border border-gray-300 bg-white rounded shadow-sm px-3 h-[32px] hover:bg-gray-50 hover:text-gray-700 transition-colors"
            title="컬럼 너비·순서를 기본값으로 초기화"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            칼럼 초기화
          </button>

          <div className="relative">
            <button
              onClick={() => setIsActionMenuOpen(o => !o)}
              className="flex items-center justify-between text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded shadow-sm px-3 py-[7px] hover:bg-gray-50 transition-all min-w-[110px] h-[32px]"
            >
              선택실행 {selectedIds.length > 0 && `(${selectedIds.length})`}
              <svg
                className={`w-3.5 h-3.5 ml-2 text-gray-400 transition-transform ${isActionMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isActionMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsActionMenuOpen(false)}></div>
                <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded shadow-lg z-50 py-1.5">
                  <button onClick={openCreate} className="w-full text-left px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
                    등록
                  </button>
                  <button onClick={openEdit} className="w-full text-left px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
                    수정
                  </button>
                  <button onClick={handleDeleteSelected} className="w-full text-left px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50">
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-left whitespace-nowrap table-fixed text-sm">
              <thead className="bg-slate-50 border-b border-gray-200 text-sm text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 pl-6 w-10 text-center shrink-0">
                    <input type="checkbox" checked={allChecked} onChange={handleSelectAll} className="w-4 h-4 accent-letusBlue cursor-pointer" />
                  </th>
                  {colOrder.map((origIdx, visualIdx) => {
                    const col = DEFAULT_COLUMNS[origIdx]
                    return (
                      <th
                        key={origIdx}
                        className={`relative p-4 text-center select-none transition-colors cursor-grab active:cursor-grabbing ${
                          col.key ? 'hover:bg-gray-100' : ''
                        } ${dragOverIdx === visualIdx ? 'bg-blue-100' : ''}`}
                        style={{ width: colWidths[origIdx] }}
                        draggable
                        onClick={() => !wasDraggedRef.current && col.key && requestSort(col.key)}
                        onDragStart={e => handleDragStart(e, visualIdx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => handleDragOver(e, visualIdx)}
                        onDrop={e => handleDrop(e, visualIdx)}
                        onDragLeave={() => setDragOverIdx(null)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {col.label}
                          {col.key && getSortIcon(col.key)}
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-letusBlue/40 z-10"
                          onPointerDown={e => handleResizeStart(e, visualIdx)}
                          onClick={e => e.stopPropagation()}
                        />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedExercises.length === 0 ? (
                  <tr>
                    <td colSpan={colOrder.length + 1} className="p-16 text-center text-gray-400 font-bold">
                      조회 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedExercises.map(ex => (
                    <tr key={ex.id} className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${selectedIds.includes(ex.id) ? 'bg-blue-50' : ''}`} onClick={() => setDetailRow(ex)}>
                      <td className="p-4 pl-6 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ex.id)}
                          onChange={e => handleSelectOne(e, ex.id)}
                          className="w-4 h-4 accent-letusBlue cursor-pointer"
                        />
                      </td>
                      {colOrder.map(origIdx => renderCell(origIdx, ex))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-sm text-gray-500 font-bold">
            <span>총 {sortedExercises.length}건</span>
          </div>
        </div>
      </div>

      {showFormModal && (
        <ExerciseFormModal
          row={formRow}
          existingNames={exercises.filter(e => e.id !== formRow?.id).map(e => e.name)}
          onClose={() => setShowFormModal(false)}
          onSave={handleFormSave}
        />
      )}
      {detailRow && (
        <ExerciseDetailModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onEdit={ex => {
            setFormRow(ex)
            setShowFormModal(true)
          }}
          onDelete={handleDeleteOne}
        />
      )}
    </div>
  )
}
