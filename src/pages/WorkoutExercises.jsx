import { useState, useEffect, useRef } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import ExerciseFormModal from '../components/web/ExerciseFormModal.jsx'
import ExerciseDetailModal from '../components/web/ExerciseDetailModal.jsx'
import { equipmentBadgeClass } from '../components/web/equipmentStyle.js'
import { matchesQuery } from '../components/web/exerciseSearch.js'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { MUSCLE_LABELS, UPPER_BODY_MUSCLES, LOWER_BODY_MUSCLES, EQUIPMENT_OPTIONS, MOVEMENT_PATTERNS, EXERCISE_TYPES } from '../lib/muscleMap.js'

// 기본 너비(px) — 기본 운동 120개의 실제 글자 길이 기준으로 정했다.
// 운동명: 대부분 ≤167px, 긴 이름은 말줄임(마우스 올리면 전체) / 부위: 260px이면 119개가 한 줄 / 장비·패턴·유형: 뱃지와 헤더 글자가 들어가는 최소 폭 / 태그: 중앙값 176, 상위 10% 277
const DEFAULT_COLUMNS = [
  { label: '운동명', key: 'name', w: 200, flex: true },
  { label: '부위', key: null, w: 260, flex: true },
  { label: '사용장비', key: 'equipment', w: 110 },
  { label: '동작 패턴', key: 'movementPattern', w: 100 },
  { label: '운동 유형', key: 'exerciseType', w: 100 },
  { label: '태그', key: null, w: 300, flex: true },
]
// flex: true인 칼럼(글자가 많은 칼럼)은 화면이 넓을 때 남는 폭을 자기 너비 비율대로 나눠 가져서 표가 화면을 꽉 채운다.
// 뱃지만 있는 칼럼은 고정 폭을 유지한다. 화면이 좁으면 기본 너비 그대로 가로 스크롤.
const CHECK_COL_W = 44
// 기본 너비를 바꿀 때는 키 뒤의 버전을 올린다 — 그래야 이전에 저장된 사용자 너비가 새 기본값을 가리지 않는다.
const COL_STORAGE_KEY = 'training_exercises_col_v2'

// 필터 한 줄: 라벨 + 값별 토글 뱃지. 라벨 폭(w-16)을 모든 그룹이 같게 써서 뱃지 시작점이 맞는다.
function FilterGroup({ label, options, selected, onToggle, labelOf = v => v, className = '' }) {
  return (
    <div className={`flex items-start gap-3 min-w-0 ${className}`}>
      <span className="text-ui-caption font-bold text-gray-500 shrink-0 pt-1 w-16">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`px-2.5 py-1 rounded text-ui-caption font-bold border transition-colors ${
              selected.includes(o) ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {labelOf(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function WorkoutExercises() {
  const { exercises, setExercises } = useWorkoutLogs()

  // 필터 — 드롭박스 대신 값 하나하나를 뱃지로 눌러서 토글 (즉시 반영, 서버 왕복이 없는 화면이라 조회 버튼 불필요)
  const [muscleFilter, setMuscleFilter] = useState([])
  const [equipmentFilter, setEquipmentFilter] = useState([])
  const toggleMuscleFilter = m => setMuscleFilter(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]))
  const toggleEquipmentFilter = eq => setEquipmentFilter(prev => (prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]))
  const [searchQuery, setSearchQuery] = useState('') // 운동명 + 태그(별칭) 검색
  const [patternFilter, setPatternFilter] = useState([])
  const [typeFilter, setTypeFilter] = useState([])
  const toggleIn = (setter, value) => setter(prev => (prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]))
  const hasActiveFilter = muscleFilter.length > 0 || equipmentFilter.length > 0 || patternFilter.length > 0 || typeFilter.length > 0 || searchQuery !== ''
  const resetFilters = () => {
    setMuscleFilter([])
    setEquipmentFilter([])
    setPatternFilter([])
    setTypeFilter([])
    setSearchQuery('')
  }
  // 부위는 선택할수록 좁혀지는 AND — "가슴이면서 삼두인 운동"처럼 고르라고 여러 개 누르는 것이지,
  // "가슴 또는 삼두"로 넓히려는 게 아니다. 사용장비는 운동 하나에 값이 하나뿐이라 여러 개 고르면 OR(합집합).
  const filteredExercises = exercises.filter(
    ex =>
      muscleFilter.every(m => ex.muscles.includes(m)) &&
      (equipmentFilter.length === 0 || equipmentFilter.includes(ex.equipment)) &&
      // 동작 패턴·운동 유형도 운동 하나에 값이 하나뿐이라 여러 개 고르면 OR(합집합)
      (patternFilter.length === 0 || patternFilter.includes(ex.movementPattern)) &&
      (typeFilter.length === 0 || typeFilter.includes(ex.exerciseType)) &&
      matchesQuery(ex.name, ex.tags, searchQuery),
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
  const [wrapWidth, setWrapWidth] = useState(0) // 표를 감싸는 영역의 가로 폭 (남는 폭 계산용)
  const [isResizing, setIsResizing] = useState(false)
  const [scrollbarW, setScrollbarW] = useState(0) // 본문 세로 스크롤바 폭 — 헤더 오른쪽에 같은 폭을 비워 칼럼 위치를 맞춘다
  const headRef = useRef(null)
  const wrapRef = useRef(null)
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

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      setWrapWidth(el.clientWidth) // 스크롤바를 뺀 폭
      setScrollbarW(el.offsetWidth - el.clientWidth)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild) // 필터로 행 수가 바뀌면 스크롤바가 생기거나 사라진다
    return () => ro.disconnect()
  }, [])

  // 칼럼별 실제 표시 너비 = 저장된 너비 + (flex 칼럼이면) 남는 폭 중 자기 몫. 드래그로 조절하는 중에는 분배를 멈춘다.
  const baseSum = colWidths.reduce((a, b) => a + b, 0)
  const flexSum = DEFAULT_COLUMNS.reduce((a, c, i) => (c.flex ? a + colWidths[i] : a), 0)
  const excess = isResizing || !wrapWidth ? 0 : Math.max(0, wrapWidth - CHECK_COL_W - baseSum - 1)
  const displayWidth = i => Math.floor(colWidths[i] + (DEFAULT_COLUMNS[i].flex && flexSum ? (excess * colWidths[i]) / flexSum : 0))
  const tableWidth = CHECK_COL_W + colOrder.reduce((a, i) => a + displayWidth(i), 0)
  // 헤더 표와 본문 표가 같은 칼럼 폭을 쓰도록 colgroup을 공유한다
  const colGroup = (
    <colgroup>
      <col style={{ width: CHECK_COL_W }} />
      {colOrder.map(i => (
        <col key={i} style={{ width: displayWidth(i) }} />
      ))}
    </colgroup>
  )

  const resetColSettings = () => {
    setColOrder(DEFAULT_COLUMNS.map((_, i) => i))
    setColWidths(DEFAULT_COLUMNS.map(c => c.w))
    localStorage.removeItem(COL_STORAGE_KEY)
  }

  const handleResizeStart = (e, visualIdx) => {
    e.preventDefault()
    e.stopPropagation()
    const origIdx = colOrder[visualIdx]
    // 지금 화면에 보이는 너비를 그대로 저장 값으로 굳히고 분배를 멈춘다 → 드래그가 커서를 정확히 따라간다
    const shownWidths = colWidths.map((_, i) => displayWidth(i))
    setColWidths(shownWidths)
    setIsResizing(true)
    resizingRef.current = { origIdx, startX: e.clientX, startW: shownWidths[origIdx] }
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
      setIsResizing(false)
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
          <td key={origIdx} className="px-4 py-3 text-left truncate font-bold text-gray-800" title={row.name}>
            {row.name}
          </td>
        )
      case 1:
        return (
          <td key={origIdx} className="px-4 py-3 text-left">
            <div className="flex flex-wrap gap-1">
              {row.muscles.map(m => (
                <span key={m} className="text-ui-caption font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {MUSCLE_LABELS[m] || m}
                </span>
              ))}
            </div>
          </td>
        )
      case 2:
        return (
          <td key={origIdx} className="px-4 py-3 text-center">
            {row.equipment && <span className={`text-ui-caption font-bold px-2 py-0.5 rounded-full ${equipmentBadgeClass(row.equipment)}`}>{row.equipment}</span>}
          </td>
        )
      case 3:
        return (
          <td key={origIdx} className="px-4 py-3 text-center">
            {row.movementPattern && <span className="text-ui-caption font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{row.movementPattern}</span>}
          </td>
        )
      case 4:
        return (
          <td key={origIdx} className="px-4 py-3 text-center">
            {row.exerciseType && (
              <span className={`text-ui-caption font-bold px-2 py-0.5 rounded-full ${row.exerciseType === '복합관절' ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                {row.exerciseType}
              </span>
            )}
          </td>
        )
      case 5:
        return (
          <td key={origIdx} className="px-4 py-3 text-left text-ui-caption text-gray-500 truncate" title={row.tags?.join(', ')}>
            {row.tags?.join(' · ')}
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div>
      <PageHeader title="운동 리스트" color="bg-letusOrange" />
      {/* 웹앱(md 이상): 화면 높이에 맞춰 고정하고 표 영역만 안에서 스크롤한다 → 필터와 표 헤더가 항상 보인다 (64px = 상단 헤더) */}
      <div className="p-4 space-y-3 md:space-y-0 md:flex md:flex-col md:gap-3 md:h-[calc(100vh-64px)]">
        {/* 필터 카드 — 드롭박스 대신 값별 뱃지 토글 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 md:shrink-0">
          {/*
            좌우 2칸 균등 분할 (lg 이상). 칸 폭은 각 그룹이 한 줄로 차지하는 폭(상체 653·사용장비 634·하체 438·동작 패턴+운동 유형 658px)을
            1920px 화면의 반쪽 폭(783px)과 대조해 정했다 → 모두 한 줄에 들어간다.
            왼쪽 칸: 상체 / 사용장비 — 오른쪽 칸: 하체 / 동작 패턴 + 운동 유형. 같은 칸의 시작점이 위아래로 맞는다.
            좁은 화면에서는 한 칸으로 쌓이고, 칩은 그 칸 안에서 줄바꿈된다.
          */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
            <FilterGroup label="상체" options={UPPER_BODY_MUSCLES} selected={muscleFilter} onToggle={toggleMuscleFilter} labelOf={m => MUSCLE_LABELS[m]} />
            {/* 하체 줄의 맨 오른쪽에 필터 초기화를 둔다 — 필터를 켜고 꺼도 카드 높이가 변하지 않는다 */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              <FilterGroup className="flex-1" label="하체" options={LOWER_BODY_MUSCLES} selected={muscleFilter} onToggle={toggleMuscleFilter} labelOf={m => MUSCLE_LABELS[m]} />
              {hasActiveFilter && (
                <button onClick={resetFilters} className="shrink-0 pt-1 text-ui-caption font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2">
                  필터 초기화
                </button>
              )}
            </div>
            <FilterGroup label="사용장비" options={EQUIPMENT_OPTIONS} selected={equipmentFilter} onToggle={toggleEquipmentFilter} />
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3 min-w-0">
              <FilterGroup label="동작 패턴" options={MOVEMENT_PATTERNS} selected={patternFilter} onToggle={p => toggleIn(setPatternFilter, p)} />
              <FilterGroup label="운동 유형" options={EXERCISE_TYPES} selected={typeFilter} onToggle={t => toggleIn(setTypeFilter, t)} />
            </div>
          </div>
        </div>

        {/* 칼럼 초기화 + 선택실행 액션바 */}
        <div className="flex justify-end items-center gap-3 md:shrink-0">
          <div className="relative flex items-center mr-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="운동명·태그 검색 (예: 턱걸이, bench)"
              className="pl-3 pr-8 h-[32px] border border-gray-300 rounded text-ui-body font-medium focus:outline-none focus:border-letusBlue w-72 bg-white"
            />
            {searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 text-gray-400 hover:text-gray-600 text-ui-body" title="검색어 지우기">
                ×
              </button>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <button
            onClick={resetColSettings}
            className="flex items-center gap-1 text-ui-caption font-bold text-gray-500 border border-gray-300 bg-white rounded shadow-sm px-3 h-[32px] hover:bg-gray-50 hover:text-gray-700 transition-colors"
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
              className="flex items-center justify-between text-ui-body font-bold text-gray-700 bg-white border border-gray-300 rounded shadow-sm px-3 py-[7px] hover:bg-gray-50 transition-all min-w-[110px] h-[32px]"
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
                  <button onClick={openCreate} className="w-full text-left px-3 py-1.5 text-ui-body font-bold text-gray-700 hover:bg-gray-50">
                    등록
                  </button>
                  <button onClick={openEdit} className="w-full text-left px-3 py-1.5 text-ui-body font-bold text-gray-700 hover:bg-gray-50">
                    수정
                  </button>
                  <button onClick={handleDeleteSelected} className="w-full text-left px-3 py-1.5 text-ui-body font-bold text-red-600 hover:bg-red-50">
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden md:flex-1 md:min-h-0">
          {/* 헤더는 스크롤 영역 밖에 둔다 — 세로 스크롤바가 헤더를 가리지 않고, 항상 보인다. 가로 스크롤은 아래 본문과 동기화한다. */}
          <div ref={headRef} className="overflow-hidden shrink-0 bg-slate-50 border-b border-gray-200" style={{ paddingRight: scrollbarW }}>
            <table className="text-left whitespace-nowrap table-fixed text-ui-body" style={{ width: tableWidth }}>
              {colGroup}
              <thead className="text-ui-body text-slate-500 font-bold">
                <tr>
                  <th className="pl-4 pr-2 py-2.5 w-[44px] text-center shrink-0">
                    <input type="checkbox" checked={allChecked} onChange={handleSelectAll} className="w-3.5 h-3.5 accent-letusBlue cursor-pointer align-middle" />
                  </th>
                  {colOrder.map((origIdx, visualIdx) => {
                    const col = DEFAULT_COLUMNS[origIdx]
                    return (
                      <th
                        key={origIdx}
                        className={`relative px-4 py-2.5 text-center select-none transition-colors cursor-grab active:cursor-grabbing ${
                          col.key ? 'hover:bg-gray-100' : ''
                        } ${dragOverIdx === visualIdx ? 'bg-blue-100' : ''}`}
                        style={{ width: displayWidth(origIdx) }}
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
            </table>
          </div>

          <div
            ref={wrapRef}
            onScroll={e => {
              if (headRef.current) headRef.current.scrollLeft = e.currentTarget.scrollLeft
            }}
            // 스크롤바 자리를 항상 확보한다 — 행이 적어 스크롤바가 사라져도 표 영역 폭이 같아서 칼럼 폭이 변하지 않는다
            style={{ scrollbarGutter: 'stable' }}
            className="overflow-auto md:flex-1 md:min-h-0"
          >
            <table className="text-left whitespace-nowrap table-fixed text-ui-body" style={{ width: tableWidth }}>
              {colGroup}
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
                      <td className="pl-4 pr-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ex.id)}
                          onChange={e => handleSelectOne(e, ex.id)}
                          className="w-3.5 h-3.5 accent-letusBlue cursor-pointer align-middle"
                        />
                      </td>
                      {colOrder.map(origIdx => renderCell(origIdx, ex))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-ui-body text-gray-500 font-bold shrink-0">
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
