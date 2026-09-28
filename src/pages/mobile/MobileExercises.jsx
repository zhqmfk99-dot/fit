import { useState } from 'react'
import { Plus, Pencil, Check, SlidersHorizontal, X } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import ExerciseFormModal from '../../components/ExerciseFormModal.jsx'
import ExerciseDetailModal from '../../components/ExerciseDetailModal.jsx'
import { useExerciseManager } from '../../hooks/useExerciseManager.js'
import { MUSCLE_LABELS, UPPER_BODY_MUSCLES, LOWER_BODY_MUSCLES, EQUIPMENT_OPTIONS } from '../../lib/muscleMap.js'

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

  // 필터 — 뱃지를 다 펼치면 화면을 너무 많이 차지해서 바텀시트 안에 넣는다
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [muscleFilter, setMuscleFilter] = useState([])
  const [equipmentFilter, setEquipmentFilter] = useState([])
  const toggleMuscleFilter = m => setMuscleFilter(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]))
  const toggleEquipmentFilter = eq => setEquipmentFilter(prev => (prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]))
  const resetFilters = () => {
    setMuscleFilter([])
    setEquipmentFilter([])
  }
  const activeFilterCount = muscleFilter.length + equipmentFilter.length
  // 부위는 선택할수록 좁혀지는 AND, 사용장비는 운동 하나에 값이 하나뿐이라 OR
  const filteredExercises = exercises.filter(
    ex => muscleFilter.every(m => ex.muscles.includes(m)) && (equipmentFilter.length === 0 || equipmentFilter.includes(ex.equipment)),
  )

  return (
    <div>
      <PageHeader title="운동 리스트" color="bg-letusOrange" />
      <div className="p-4 space-y-3">
        <button
          onClick={() => setShowFilterSheet(true)}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg px-3 py-2"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          필터
          {activeFilterCount > 0 && <span className="bg-letusBlue text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
        </button>

        {exercises.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 font-bold">등록된 운동이 없습니다.</div>
        ) : filteredExercises.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 font-bold">필터에 해당하는 운동이 없습니다.</div>
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
                      className={`absolute top-3.5 right-3.5 w-5 h-5 rounded flex items-center justify-center border-2 ${
                        isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}

                  <div className="pr-7">
                    <span className="font-bold text-gray-800 text-sm truncate">{ex.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.muscles.map(m => (
                      <span key={m} className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {MUSCLE_LABELS[m] || m}
                      </span>
                    ))}
                    {ex.equipment && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-letusBlue">{ex.equipment}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-1 text-xs font-bold text-gray-400">총 {filteredExercises.length}건</div>

        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm font-bold text-gray-400 active:border-letusBlue active:text-letusBlue transition-colors"
        >
          <Plus className="w-4 h-4" />
          운동 추가
        </button>

        {!editMode ? (
          <button
            onClick={enterEditMode}
            className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-red-300 rounded-lg py-3 text-sm font-bold text-red-400 active:border-red-500 active:text-red-600 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={exitEditMode}
              className="flex-1 border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm font-bold text-gray-400 active:border-gray-400 transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmEdit}
              disabled={!selectedId}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-colors ${
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
          <div onClick={e => e.stopPropagation()} className="w-full bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-bold text-gray-800">필터</h3>
              <button onClick={() => setShowFilterSheet(false)} className="text-gray-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">상체</div>
                <div className="flex flex-wrap gap-1.5">
                  {UPPER_BODY_MUSCLES.map(m => {
                    const isSelected = muscleFilter.includes(m)
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMuscleFilter(m)}
                        className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-colors ${
                          isSelected ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300'
                        }`}
                      >
                        {MUSCLE_LABELS[m]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">하체</div>
                <div className="flex flex-wrap gap-1.5">
                  {LOWER_BODY_MUSCLES.map(m => {
                    const isSelected = muscleFilter.includes(m)
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMuscleFilter(m)}
                        className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-colors ${
                          isSelected ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300'
                        }`}
                      >
                        {MUSCLE_LABELS[m]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">사용장비</div>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_OPTIONS.map(eq => {
                    const isSelected = equipmentFilter.includes(eq)
                    return (
                      <button
                        key={eq}
                        onClick={() => toggleEquipmentFilter(eq)}
                        className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-colors ${
                          isSelected ? 'bg-letusBlue text-white border-letusBlue' : 'bg-white text-gray-600 border-gray-300'
                        }`}
                      >
                        {eq}
                      </button>
                    )
                  })}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="text-xs font-bold text-gray-400 underline underline-offset-2">
                  필터 초기화
                </button>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowFilterSheet(false)} className="w-full bg-letusBlue text-white text-sm font-bold py-3 rounded-lg active:bg-blue-600 transition-colors">
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
