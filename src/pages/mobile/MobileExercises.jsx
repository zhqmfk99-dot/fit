import { useState } from 'react'
import { Plus, Pencil, Check, SlidersHorizontal, X, Search } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import { useBackHandler } from '../../context/BackNavigationContext.jsx'
import ExerciseFormModal from '../../components/ExerciseFormModal.jsx'
import ExerciseDetailModal from '../../components/ExerciseDetailModal.jsx'
import { useExerciseManager } from '../../hooks/useExerciseManager.js'
import { MUSCLE_LABELS, UPPER_BODY_MUSCLES, LOWER_BODY_MUSCLES, EQUIPMENT_OPTIONS, MOVEMENT_PATTERNS, EXERCISE_TYPES } from '../../lib/muscleMap.js'
import { equipmentBadgeClass } from '../../lib/equipmentStyle.js'
import { matchesQuery } from '../../lib/exerciseSearch.js'

// 필터 시트의 한 그룹: 라벨 + 값별 토글 뱃지 (터치하기 쉽게 높이를 키웠다)
function FilterGroup({ label, options, selected, onToggle, labelOf = v => v }) {
  return (
    <div>
      <div className="text-m-caption font-bold text-gray-500 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`px-3 py-2 rounded-lg text-m-caption font-bold border transition-colors ${
              selected.includes(o) ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {labelOf(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

// PWA(모바일) 전용 운동 리스트. 글자 크기는 모바일 표준(text-m-*). (웹앱은 pages/WorkoutExercises.jsx)
export default function MobileExercises() {
  const {
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
  } = useExerciseManager()

  // 검색(운동명 + 태그) — 항상 보이게 위에 둔다. 필터는 뱃지를 다 펼치면 화면을 너무 차지해서 바텀시트 안에 넣는다.
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  useBackHandler(() => setShowFilterSheet(false), showFilterSheet) // 필터 시트가 열려 있으면 뒤로가기로 먼저 닫는다
  const [muscleFilter, setMuscleFilter] = useState([])
  const [equipmentFilter, setEquipmentFilter] = useState([])
  const [patternFilter, setPatternFilter] = useState([])
  const [typeFilter, setTypeFilter] = useState([])
  const toggleIn = (setter, value) => setter(prev => (prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]))
  const resetFilters = () => {
    setMuscleFilter([])
    setEquipmentFilter([])
    setPatternFilter([])
    setTypeFilter([])
  }
  const activeFilterCount = muscleFilter.length + equipmentFilter.length + patternFilter.length + typeFilter.length
  // 부위는 선택할수록 좁혀지는 AND. 사용장비·동작 패턴·운동 유형은 운동 하나에 값이 하나뿐이라 여러 개 고르면 OR.
  const filteredExercises = exercises.filter(
    ex =>
      muscleFilter.every(m => ex.muscles.includes(m)) &&
      (equipmentFilter.length === 0 || equipmentFilter.includes(ex.equipment)) &&
      (patternFilter.length === 0 || patternFilter.includes(ex.movementPattern)) &&
      (typeFilter.length === 0 || typeFilter.includes(ex.exerciseType)) &&
      matchesQuery(ex.name, ex.tags, searchQuery),
  )

  return (
    <div>
      <PageHeader title="운동 리스트" color="bg-letusOrange" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="운동명·태그 검색"
              className="w-full h-11 pl-9 pr-9 bg-white border border-gray-300 rounded-lg text-m-body font-medium focus:outline-none focus:border-letusBlue"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-400" aria-label="검색어 지우기">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilterSheet(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-11 text-m-body font-bold text-gray-600 bg-white border border-gray-300 rounded-lg px-3.5"
          >
            <SlidersHorizontal className="w-4 h-4" />
            필터
            {activeFilterCount > 0 && <span className="bg-letusBlue text-white text-m-caption font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>

        {exercises.length === 0 ? (
          <div className="py-16 text-center text-m-body text-gray-400 font-bold">등록된 운동이 없습니다.</div>
        ) : filteredExercises.length === 0 ? (
          <div className="py-16 text-center text-m-body text-gray-400 font-bold">검색·필터에 해당하는 운동이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filteredExercises.map(ex => {
              const isSelected = selectedId === ex.id
              return (
                <div
                  key={ex.id}
                  onClick={e => (editMode ? toggleSelect(e, ex.id) : setDetailRow(ex))}
                  className={`relative bg-white rounded-xl border p-4 flex flex-col gap-2 cursor-pointer transition-colors ${
                    editMode ? (isSelected ? 'border-red-400 bg-red-50' : 'border-gray-200') : 'border-gray-100 active:bg-blue-50/40'
                  }`}
                >
                  {editMode && (
                    <div
                      className={`absolute top-3.5 right-3.5 w-6 h-6 rounded flex items-center justify-center border-2 ${
                        isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  )}

                  <div className="pr-8">
                    <span className="font-bold text-gray-800 text-m-body truncate block">{ex.name}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ex.equipment && <span className={`text-m-caption font-bold px-2 py-0.5 rounded-full ${equipmentBadgeClass(ex.equipment)}`}>{ex.equipment}</span>}
                    {ex.movementPattern && <span className="text-m-caption font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{ex.movementPattern}</span>}
                    {ex.exerciseType && (
                      <span className={`text-m-caption font-bold px-2 py-0.5 rounded-full ${ex.exerciseType === '복합관절' ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                        {ex.exerciseType}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ex.muscles.map(m => (
                      <span key={m} className="text-m-caption font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {MUSCLE_LABELS[m] || m}
                      </span>
                    ))}
                  </div>

                  {ex.tags?.length > 0 && <div className="text-m-caption text-gray-400 truncate">{ex.tags.join(' · ')}</div>}
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-1 text-m-caption font-bold text-gray-400">총 {filteredExercises.length}건</div>

        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-lg py-3 text-m-body font-bold text-gray-400 active:border-letusBlue active:text-letusBlue transition-colors"
        >
          <Plus className="w-4 h-4" />
          운동 추가
        </button>

        {!editMode ? (
          <button
            onClick={enterEditMode}
            className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-red-300 rounded-lg py-3 text-m-body font-bold text-red-400 active:border-red-500 active:text-red-600 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={exitEditMode}
              className="flex-1 border-2 border-dashed border-gray-300 rounded-lg py-3 text-m-body font-bold text-gray-400 active:border-gray-400 transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmEdit}
              disabled={!selectedId}
              className={`flex-1 rounded-lg py-3 text-m-body font-bold transition-colors ${
                selectedId ? 'bg-red-500 text-white active:bg-red-600' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              선택한 운동 수정하기
            </button>
          </div>
        )}
      </div>

      {showFilterSheet && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm fade-in" onClick={() => setShowFilterSheet(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="text-m-title font-bold text-gray-800">필터</h3>
              <button onClick={() => setShowFilterSheet(false)} className="text-gray-400 w-9 h-9 flex items-center justify-center" aria-label="닫기">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-5 overflow-y-auto">
              <FilterGroup label="상체" options={UPPER_BODY_MUSCLES} selected={muscleFilter} onToggle={m => toggleIn(setMuscleFilter, m)} labelOf={m => MUSCLE_LABELS[m]} />
              <FilterGroup label="하체" options={LOWER_BODY_MUSCLES} selected={muscleFilter} onToggle={m => toggleIn(setMuscleFilter, m)} labelOf={m => MUSCLE_LABELS[m]} />
              <FilterGroup label="사용장비" options={EQUIPMENT_OPTIONS} selected={equipmentFilter} onToggle={v => toggleIn(setEquipmentFilter, v)} />
              <FilterGroup label="동작 패턴" options={MOVEMENT_PATTERNS} selected={patternFilter} onToggle={v => toggleIn(setPatternFilter, v)} />
              <FilterGroup label="운동 유형" options={EXERCISE_TYPES} selected={typeFilter} onToggle={v => toggleIn(setTypeFilter, v)} />

              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="px-1 py-2 text-m-caption font-bold text-gray-400 underline underline-offset-2">
                  필터 초기화
                </button>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowFilterSheet(false)} className="w-full bg-letusBlue text-white text-m-body font-bold py-3 rounded-lg active:bg-blue-600 transition-colors">
                결과 보기 ({filteredExercises.length}건)
              </button>
            </div>
          </div>
        </div>
      )}

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
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
