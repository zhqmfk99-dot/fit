import { useState } from 'react'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { TRAINABLE_MUSCLES, MUSCLE_LABELS, EQUIPMENT_OPTIONS, MOVEMENT_PATTERNS, EXERCISE_TYPES } from '../../lib/muscleMap.js'

const ACCENT = 'bg-letusOrange'

export default function ExerciseFormModal({ row, existingNames = [], onClose, onSave }) {
  const { unilateralSupported } = useWorkoutLogs()
  const isEdit = !!row

  const [name, setName] = useState(row?.name || '')
  const [muscles, setMuscles] = useState(row?.muscles || [])
  const [equipment, setEquipment] = useState(row?.equipment || '')
  const [movementPattern, setMovementPattern] = useState(row?.movementPattern || '')
  const [exerciseType, setExerciseType] = useState(row?.exerciseType || '')
  const [unilateral, setUnilateral] = useState(!!row?.unilateral) // 한쪽씩 하는 운동: 횟수를 한쪽 기준으로 적고, 볼륨·칼로리는 양쪽으로 센다
  const [tags, setTags] = useState(row?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // 태그 추가 — Enter 또는 쉼표로 확정. 공백만 있거나 이미 있는 태그는 무시한다.
  const addTag = raw => {
    const t = raw.trim()
    if (t && !tags.some(x => x.toLowerCase() === t.toLowerCase())) setTags(prev => [...prev, t])
    setTagInput('')
  }
  const handleTagKeyDown = e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  const toggleMuscle = muscle => {
    setMuscles(prev => (prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]))
  }

  const handleSave = () => {
    if (!name.trim()) return setErrorMsg('운동명을 입력해 주세요.')
    if (muscles.length === 0) return setErrorMsg('부위를 최소 1개 선택해 주세요.')
    if (!equipment) return setErrorMsg('사용장비를 선택해 주세요.')
    if (existingNames.includes(name.trim())) return setErrorMsg('이미 등록된 운동명입니다.')
    setErrorMsg('')

    // 입력창에 확정하지 않고 남아 있는 태그도 저장 시 함께 반영한다
    const pendingTag = tagInput.trim()
    const finalTags = pendingTag && !tags.some(x => x.toLowerCase() === pendingTag.toLowerCase()) ? [...tags, pendingTag] : tags

    onSave({
      id: row?.id ?? crypto.randomUUID(),
      name: name.trim(),
      muscles,
      equipment,
      movementPattern: movementPattern || null,
      exerciseType: exerciseType || null,
      unilateral,
      tags: finalTags,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-ui-body font-bold text-gray-800 flex items-center">
            <span className={`w-1.5 h-3.5 ${ACCENT} rounded-full mr-2`}></span>
            {isEdit ? '운동 수정' : '운동 등록'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 bg-slate-50 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-ui-body font-bold p-3 rounded border border-red-100 flex items-center gap-1.5">
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
            <label className="text-ui-body font-bold text-gray-700">
              운동명 <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 랫풀다운"
              className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-ui-body focus:outline-none focus:border-letusOrange transition-all bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-ui-body font-bold text-gray-700">
              부위 <span className="text-red-500">*</span> <span className="text-ui-caption font-normal text-gray-400">(여러 개 선택 가능)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TRAINABLE_MUSCLES.map(muscle => {
                const isSelected = muscles.includes(muscle)
                return (
                  <button
                    key={muscle}
                    onClick={() => toggleMuscle(muscle)}
                    className={`px-3 py-1.5 rounded-full text-ui-body font-bold transition-colors ${
                      isSelected ? 'bg-letusOrange text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {MUSCLE_LABELS[muscle]}
                  </button>
                )
              })}
            </div>
            <div className="text-ui-caption text-gray-400 font-semibold mt-1">선택한 부위는 대시보드 인체도 계산에 바로 반영됩니다</div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-ui-body font-bold text-gray-700">
              사용장비 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map(item => {
                const isSelected = equipment === item
                return (
                  <button
                    key={item}
                    onClick={() => setEquipment(item)}
                    className={`px-3 py-1.5 rounded-full text-ui-body font-bold transition-colors ${
                      isSelected ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-ui-body font-bold text-gray-700">
              동작 패턴 <span className="text-ui-caption font-normal text-gray-400">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOVEMENT_PATTERNS.map(item => {
                const isSelected = movementPattern === item
                return (
                  <button
                    key={item}
                    onClick={() => setMovementPattern(isSelected ? '' : item)}
                    className={`px-3 py-1.5 rounded-full text-ui-body font-bold transition-colors ${
                      isSelected ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-ui-body font-bold text-gray-700">
              운동 유형 <span className="text-ui-caption font-normal text-gray-400">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXERCISE_TYPES.map(item => {
                const isSelected = exerciseType === item
                return (
                  <button
                    key={item}
                    onClick={() => setExerciseType(isSelected ? '' : item)}
                    className={`px-3 py-1.5 rounded-full text-ui-body font-bold transition-colors ${
                      isSelected ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={unilateral} onChange={e => setUnilateral(e.target.checked)} className="mt-0.5 w-4 h-4 accent-letusBlue shrink-0" />
            <span className="flex flex-col">
              <span className="text-ui-body font-bold text-gray-700">한쪽씩 하는 운동</span>
              <span className="text-ui-caption text-gray-400 leading-relaxed">횟수를 한쪽 기준으로 적어요(예: 한쪽 10회). 볼륨·칼로리는 양쪽으로 계산해요.</span>
              {!unilateralSupported && <span className="text-ui-caption font-bold text-red-500 leading-relaxed">이 표시를 저장하려면 supabase/unilateral.sql을 먼저 실행해 주세요.</span>}
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-ui-body font-bold text-gray-700">
              태그 <span className="text-ui-caption font-normal text-gray-400">(별칭·다른 이름, Enter로 추가)</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 border border-gray-300 rounded-[4px] px-2.5 py-2 bg-white focus-within:border-letusOrange transition-all">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-ui-caption font-bold">
                  {tag}
                  <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== tag))} className="text-slate-400 hover:text-red-500" title="태그 삭제">
                    ×
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length ? '' : '예: 스쿼트의 별칭 "백스쿼트"'}
                className="flex-1 min-w-[120px] text-ui-body focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-[9px] border border-gray-300 text-gray-600 text-ui-body font-bold rounded-[3px] hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-[9px] bg-letusBlue text-white text-ui-body font-bold rounded-[3px] hover:bg-blue-600 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
