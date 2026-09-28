import { useState, useMemo } from 'react'
import { Plus, GripVertical } from 'lucide-react'
import { getKnownExerciseNames } from '../../lib/muscleMap.js'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'

const ACCENT = 'bg-letusBlue'
const emptyExercise = () => ({ exercise: '', sets: '', reps: '', weight: '', restSeconds: '', linkedToNext: false })

const renderHighlight = (text, query) => {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-letusBlue font-black">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function QuickWorkoutModal({ routines = [], onClose, onStartRoutine, onStartCustom }) {
  const [tab, setTab] = useState(routines.length > 0 ? 'routine' : 'custom')
  const [exercises, setExercises] = useState([emptyExercise()])
  const [errorMsg, setErrorMsg] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const [dropdownIdx, setDropdownIdx] = useState(null)

  const { exercises: exerciseCatalog } = useWorkoutLogs()
  const knownExercises = useMemo(() => getKnownExerciseNames(routines, exerciseCatalog), [routines, exerciseCatalog])
  const suggestionsFor = query => (query.trim() ? knownExercises.filter(n => n.toLowerCase().includes(query.toLowerCase())) : knownExercises)

  const addExercise = () => setExercises(prev => [...prev, emptyExercise()])
  const removeExercise = idx => setExercises(prev => prev.filter((_, i) => i !== idx))
  const updateExercise = (idx, field, value) => setExercises(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))

  // 마우스·터치 둘 다에서 되게 HTML5 draggable 대신 포인터 이벤트로 직접 순서를 바꾼다
  // (모바일 브라우저는 네이티브 drag-and-drop을 지원하지 않는 경우가 많다) — 루틴 등록 모달과 동일한 방식
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

  const handleStart = () => {
    const cleaned = exercises
      .filter(e => e.exercise.trim())
      .map(e => ({
        exercise: e.exercise.trim(),
        sets: Math.max(1, Number(e.sets) || 1),
        reps: Number(e.reps) || 0,
        weight: Number(e.weight) || 0,
        restSeconds: Number(e.restSeconds) || 90,
        linkedToNext: !!e.linkedToNext,
      }))
    if (cleaned.length > 0) cleaned[cleaned.length - 1].linkedToNext = false
    if (cleaned.length === 0) return setErrorMsg('운동을 최소 1개 입력해 주세요.')
    setErrorMsg('')
    onStartCustom(cleaned)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[100] backdrop-blur-sm fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[420px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-sm font-bold text-gray-800 flex items-center">
            <span className={`w-1.5 h-3.5 ${ACCENT} rounded-full mr-2`}></span>
            오늘 운동 등록
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100 bg-white px-2 pt-1">
          {[
            { id: 'routine', label: '루틴 불러오기' },
            { id: 'custom', label: '운동 등록' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-xs font-bold py-2.5 border-b-2 transition-colors ${
                tab === t.id ? 'border-letusBlue text-letusBlue' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 bg-slate-50 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded border border-red-100">{errorMsg}</div>
          )}

          {tab === 'routine' &&
            (routines.length > 0 ? (
              <div className="space-y-1.5">
                {routines.map(r => (
                  <button
                    key={r.id}
                    onClick={() => onStartRoutine(r)}
                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 hover:border-letusBlue transition-colors text-left"
                  >
                    <span className="text-xs font-bold text-gray-700">{r.name}</span>
                    <span className="text-xs text-gray-400 font-bold">{r.exercises.length}개 운동 · 바로 시작</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-gray-400 font-bold py-8">등록된 루틴이 없습니다.</div>
            ))}

          {tab === 'custom' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">운동 목록</label>
              <div className="space-y-2">
                {exercises.map((ex, idx) => {
                  const isGrouped = !!ex.linkedToNext || (idx > 0 && !!exercises[idx - 1].linkedToNext)
                  return (
                  <div
                    key={idx}
                    data-exercise-row={idx}
                    className={`flex gap-2 border rounded-lg p-2.5 bg-white transition-shadow ${
                      dragIndex === idx ? 'border-letusBlue shadow-md' : isGrouped ? 'border-letusBlue/50' : 'border-gray-200'
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
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-letusBlue"
                          />
                          {dropdownIdx === idx && suggestionsFor(ex.exercise).length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-blue-200 rounded-lg shadow-lg overflow-y-auto max-h-[160px]">
                              {suggestionsFor(ex.exercise).map(nameOption => (
                                <button
                                  key={nameOption}
                                  onClick={() => {
                                    updateExercise(idx, 'exercise', nameOption)
                                    setDropdownIdx(null)
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                                >
                                  {renderHighlight(nameOption, ex.exercise)}
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
                          className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-letusBlue"
                        />
                        <input
                          type="number"
                          value={ex.reps}
                          onChange={e => updateExercise(idx, 'reps', e.target.value)}
                          placeholder="반복"
                          className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-letusBlue"
                        />
                        <input
                          type="number"
                          value={ex.weight}
                          onChange={e => updateExercise(idx, 'weight', e.target.value)}
                          placeholder="kg"
                          className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-letusBlue"
                        />
                        <input
                          type="number"
                          value={ex.restSeconds}
                          onChange={e => updateExercise(idx, 'restSeconds', e.target.value)}
                          placeholder="휴식(초)"
                          title="세트간 휴식시간(초), 기본 90초"
                          className="min-w-0 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-letusBlue"
                        />
                      </div>
                      {idx < exercises.length - 1 && (
                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!ex.linkedToNext}
                            onChange={e => updateExercise(idx, 'linkedToNext', e.target.checked)}
                            className="w-3.5 h-3.5 accent-letusBlue cursor-pointer"
                          />
                          🔗 다음 운동과 수퍼세트로 묶기
                        </label>
                      )}
                    </div>
                  </div>
                )})}
              </div>
              <button onClick={addExercise} className="flex items-center gap-1 text-sm font-bold text-letusBlue hover:opacity-70 transition-opacity self-start">
                <Plus className="w-4 h-4" />
                운동 추가
              </button>
            </div>
          )}
        </div>

        {tab === 'custom' && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <button onClick={handleStart} className="w-full px-4 py-3 bg-letusBlue text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors">
              등록 후 시작
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
