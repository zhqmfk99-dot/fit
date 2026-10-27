import { useBackHandler } from '../context/BackNavigationContext.jsx'
import { useState, useMemo } from 'react'
import DateInput from './DateInput.jsx'
import { setCount, avgReps, avgWeight } from '../lib/workoutMetrics.js'
import { useWorkoutLogs } from '../context/WorkoutLogsContext.jsx'
import { getKnownExerciseNames } from '../lib/muscleMap.js'
import { buildTagIndex, matchesQuery, aliasMatch } from '../lib/exerciseSearch.js'

const ACCENT = 'bg-letusOrange'

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

export default function WorkoutFormModal({ row, initialDate, onClose, onSave }) {
  useBackHandler(onClose) // 뒤로가기(제스처)로 이 창을 닫는다
  const isEdit = !!row
  const { routines, exercises: exerciseCatalog } = useWorkoutLogs()
  const knownExercises = useMemo(() => getKnownExerciseNames(routines, exerciseCatalog), [routines, exerciseCatalog])
  // 이름뿐 아니라 태그(별칭)로도 찾는다. 선택하면 정식 명칭이 입력된다.
  const tagsByName = useMemo(() => buildTagIndex(exerciseCatalog), [exerciseCatalog])
  const suggestionsFor = query => (query.trim() ? knownExercises.filter(n => matchesQuery(n, tagsByName.get(n), query)) : knownExercises)
  const aliasHint = (n, query) => aliasMatch(n, tagsByName.get(n), query)

  const [form, setForm] = useState({
    date: row?.date || initialDate || '',
    exercise: row?.exercise || '',
    sets: row ? setCount(row) || '' : '',
    reps: row ? avgReps(row) || '' : '',
    weight: row ? avgWeight(row) || '' : '',
    fatigue: row?.fatigue ?? '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const [errorMsg, setErrorMsg] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const handleSave = () => {
    if (!form.date) return setErrorMsg('날짜를 선택해 주세요.')
    if (!form.exercise.trim()) return setErrorMsg('운동명을 입력해 주세요.')
    setErrorMsg('')

    const count = Math.max(1, Number(form.sets) || 1)
    const reps = Number(form.reps) || 0
    const weight = Number(form.weight) || 0

    onSave({
      id: row?.id ?? crypto.randomUUID(),
      date: form.date,
      exercise: form.exercise.trim(),
      // 이 화면은 세트별 시간을 직접 입력받지 않으니, 입력한 값으로 세트를 균일하게 채운다
      // (소요시간·휴식시간 기반 자동 계산은 운동 진행 화면에서만 가능)
      performedSets: Array.from({ length: count }, () => ({ reps, weight, durationSeconds: null, restBeforeSeconds: null })),
      fatigue: Number(form.fatigue) || 0,
      // 완료 여부는 이 모달에서 건드리지 않는다 — 기존 값 유지, 신규 수동 등록은 완료로 시작
      isCompleted: row?.isCompleted ?? true,
      routineId: row?.routineId,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-m-body font-bold text-gray-800 flex items-center">
            <span className={`w-1.5 h-3.5 ${ACCENT} rounded-full mr-2`}></span>
            {isEdit ? '운동 기록 수정' : '운동 기록 등록'}
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
              날짜 <span className="text-red-500">*</span>
            </label>
            <DateInput value={form.date} onChange={v => set('date', v)} fullWidth />
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-m-body font-bold text-gray-700">
              운동명 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.exercise}
              onChange={e => set('exercise', e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusOrange transition-all bg-white"
            />
            {showDropdown && suggestionsFor(form.exercise).length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-orange-200 rounded-lg shadow-lg overflow-y-auto max-h-[160px]">
                {suggestionsFor(form.exercise).map(nameOption => (
                  <button
                    key={nameOption}
                    onClick={() => {
                      set('exercise', nameOption)
                      setShowDropdown(false)
                    }}
                    className="w-full text-left px-3.5 py-2 text-m-body text-gray-700 hover:bg-orange-50 border-b border-gray-50 last:border-0"
                  >
                    {renderHighlight(nameOption, form.exercise)}
                    {aliasHint(nameOption, form.exercise) && <span className="ml-1.5 text-m-caption text-gray-400">({aliasHint(nameOption, form.exercise)})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-m-body font-bold text-gray-700">세트</label>
              <input
                type="number"
                value={form.sets}
                onChange={e => set('sets', e.target.value)}
                className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusOrange transition-all bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-m-body font-bold text-gray-700">반복</label>
              <input
                type="number"
                value={form.reps}
                onChange={e => set('reps', e.target.value)}
                className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusOrange transition-all bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-m-body font-bold text-gray-700">중량(kg)</label>
              <input
                type="number"
                value={form.weight}
                onChange={e => set('weight', e.target.value)}
                className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusOrange transition-all bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-m-body font-bold text-gray-700">피로도(1-5)</label>
              <input
                type="number"
                value={form.fatigue}
                onChange={e => set('fatigue', e.target.value)}
                className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body focus:outline-none focus:border-letusOrange transition-all bg-white"
              />
            </div>
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
