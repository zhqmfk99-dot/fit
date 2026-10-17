import { useState, useMemo } from 'react'
import { GripVertical } from 'lucide-react'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { getKnownExerciseNames } from '../lib/muscleMap.js'
import { buildTagIndex, matchesQuery, aliasMatch } from '../lib/exerciseSearch.js'

const ACCENT = 'bg-letusOrange'
const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const emptyExercise = () => ({ exercise: '', sets: '', reps: '', weight: '', restSeconds: '', linkedToNext: false })

const renderHighlight = (text, query) => {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-letusOrange font-black">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function RoutineFormModal({ row, onClose, onSave }) {
  const isEdit = !!row
  const { routines, exercises: exerciseCatalog } = useWorkoutLogs()
  const knownExercises = useMemo(() => getKnownExerciseNames(routines, exerciseCatalog), [routines, exerciseCatalog])

  const [name, setName] = useState(row?.name || '')
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [repeatDays, setRepeatDays] = useState(row?.repeatDays || [])
  const [exercises, setExercises] = useState(row?.exercises?.map(e => ({ ...e })) || [emptyExercise()])
  const [errorMsg, setErrorMsg] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const [dropdownIdx, setDropdownIdx] = useState(null)

  // 이름뿐 아니라 태그(별칭)로도 찾는다. 선택하면 정식 명칭이 입력된다.
  const tagsByName = useMemo(() => buildTagIndex(exerciseCatalog), [exerciseCatalog])
  const suggestionsFor = query => (query.trim() ? knownExercises.filter(n => matchesQuery(n, tagsByName.get(n), query)) : knownExercises)
  const aliasHint = (n, query) => aliasMatch(n, tagsByName.get(n), query)

  const toggleDay = day => {
    setRepeatDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]))
  }
  const handleSelectAllDays = () => {
    setRepeatDays(prev => (prev.length === 7 ? [] : [...DAYS]))
  }

  const addExercise = () => setExercises(prev => [...prev, emptyExercise()])
  const removeExercise = idx => setExercises(prev => prev.filter((_, i) => i !== idx))
  const updateExercise = (idx, field, value) => setExercises(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))

  // 마우스·터치 둘 다에서 되게 HTML5 draggable 대신 포인터 이벤트로 직접 순서를 바꾼다
  // (모바일 브라우저는 네이티브 drag-and-drop을 지원하지 않는 경우가 많다)
  const handleDragPointerDown = (e, idx) => {
    e.preventDefault()
    setDragIndex(idx)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handleDragPointerMove = e => {
    if (dragIndex === null) return
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const rowEl = target?.closest('[data-exercise-row]')
    if (!rowEl) return
    const overIdx = Number(rowEl.dataset.exerciseRow)
    if (Number.isNaN(overIdx) || overIdx === dragIndex) return
    setExercises(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(overIdx, 0, moved)
      return next
    })
    setDragIndex(overIdx)
  }
  const handleDragPointerUp = () => setDragIndex(null)

  const handleSave = () => {
    if (!name.trim()) return setErrorMsg('루틴명을 입력해 주세요.')
    setErrorMsg('')

    const cleanedExercises = exercises
      .filter(e => e.exercise.trim())
      .map(e => ({
        exercise: e.exercise.trim(),
        sets: Number(e.sets) || 0,
        reps: Number(e.reps) || 0,
        weight: Number(e.weight) || 0,
        restSeconds: Number(e.restSeconds) || 90,
        linkedToNext: !!e.linkedToNext,
      }))
    // 목록 맨 끝 운동은 "다음 운동"이 없으니 묶기 표시가 남아있어도 무시한다
    if (cleanedExercises.length > 0) cleanedExercises[cleanedExercises.length - 1].linkedToNext = false

    onSave({
      id: row?.id ?? crypto.randomUUID(),
      name: name.trim(),
      isActive,
      repeatDays,
      exercises: cleanedExercises,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-m-body font-bold text-gray-800 flex items-center">
            <span className={`w-1.5 h-3.5 ${ACCENT} rounded-full mr-2`}></span>
            {isEdit ? '루틴 수정' : '루틴 등록'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 bg-slate-50 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-m-body font-bold p-3 rounded border border-red-100 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-m-body font-bold text-gray-700">
              루틴명 <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 5x5 스트렝스 A"
              className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusOrange transition-all bg-white"
            />
          </div>

          <label className="flex items-center gap-2 text-m-body font-bold text-gray-700">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 accent-letusBlue" />
            현재 진행중인 루틴으로 설정
          </label>

          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between items-end mb-1">
              <label className="text-m-body font-bold text-gray-700">반복 요일</label>
              <button
                onClick={handleSelectAllDays}
                className="text-m-caption font-bold text-letusBlue hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors"
              >
                {repeatDays.length === 7 ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="flex gap-1.5 w-full justify-between">
              {DAYS.map(day => {
                const isSelected = repeatDays.includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-9 h-9 rounded-full text-m-body font-bold transition-all flex items-center justify-center ${
                      isSelected ? 'bg-letusBlue text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-m-body font-bold text-gray-700">운동 목록</label>
            <div className="space-y-2">
              {exercises.map((ex, idx) => {
                const isGrouped = !!ex.linkedToNext || (idx > 0 && !!exercises[idx - 1].linkedToNext)
                return (
                <div
                  key={idx}
                  data-exercise-row={idx}
                  className={`flex gap-2 border rounded-lg p-2.5 bg-white transition-shadow ${
                    dragIndex === idx ? 'border-letusOrange shadow-md' : isGrouped ? 'border-letusOrange/50' : 'border-gray-200'
                  }`}
                >
                  <span
                    onPointerDown={e => handleDragPointerDown(e, idx)}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerUp}
                    onPointerCancel={handleDragPointerUp}
                    className="shrink-0 self-stretch flex items-center justify-center w-6 -ml-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
                    title="드래그해서 순서 변경"
                  >
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <input
                          value={ex.exercise}
                          onChange={e => updateExercise(idx, 'exercise', e.target.value)}
                          onFocus={() => setDropdownIdx(idx)}
                          onBlur={() => setTimeout(() => setDropdownIdx(prev => (prev === idx ? null : prev)), 150)}
                          placeholder="운동명"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-m-body focus:outline-none focus:border-letusOrange"
                        />
                        {dropdownIdx === idx && suggestionsFor(ex.exercise).length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-orange-200 rounded-lg shadow-lg overflow-y-auto max-h-[160px]">
                            {suggestionsFor(ex.exercise).map(nameOption => (
                              <button
                                key={nameOption}
                                onClick={() => {
                                  updateExercise(idx, 'exercise', nameOption)
                                  setDropdownIdx(null)
                                }}
                                className="w-full text-left px-3 py-2 text-m-body text-gray-700 hover:bg-orange-50 border-b border-gray-50 last:border-0"
                              >
                                {renderHighlight(nameOption, ex.exercise)}
                                {aliasHint(nameOption, ex.exercise) && <span className="ml-1.5 text-m-caption text-gray-400">({aliasHint(nameOption, ex.exercise)})</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeExercise(idx)}
                        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center p-1"
                        title="운동 삭제"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <input
                        type="number"
                        value={ex.sets}
                        onChange={e => updateExercise(idx, 'sets', e.target.value)}
                        placeholder="세트"
                        className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-m-body focus:outline-none focus:border-letusOrange"
                      />
                      <input
                        type="number"
                        value={ex.reps}
                        onChange={e => updateExercise(idx, 'reps', e.target.value)}
                        placeholder="반복"
                        className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-m-body focus:outline-none focus:border-letusOrange"
                      />
                      <input
                        type="number"
                        value={ex.weight}
                        onChange={e => updateExercise(idx, 'weight', e.target.value)}
                        placeholder="kg"
                        className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-m-body focus:outline-none focus:border-letusOrange"
                      />
                      <input
                        type="number"
                        value={ex.restSeconds}
                        onChange={e => updateExercise(idx, 'restSeconds', e.target.value)}
                        placeholder="휴식(초)"
                        title="세트간 휴식시간(초), 기본 90초"
                        className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-m-body focus:outline-none focus:border-letusOrange"
                      />
                    </div>
                    {idx < exercises.length - 1 && (
                      <label className="flex items-center gap-1.5 text-m-caption font-bold text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!ex.linkedToNext}
                          onChange={e => updateExercise(idx, 'linkedToNext', e.target.checked)}
                          className="w-3.5 h-3.5 accent-letusOrange cursor-pointer"
                        />
                        🔗 다음 운동과 수퍼세트로 묶기
                      </label>
                    )}
                  </div>
                </div>
              )})}
            </div>
            <button onClick={addExercise} className="text-m-body font-bold text-letusBlue hover:opacity-70 transition-opacity self-start">
              + 운동 추가
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 text-gray-600 text-m-body font-bold rounded-[3px] hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-letusBlue text-white text-m-body font-bold rounded-[3px] hover:bg-blue-600 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
