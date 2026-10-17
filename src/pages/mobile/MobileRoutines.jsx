import { Plus, Pencil, Check } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import RoutineFormModal from '../../components/RoutineFormModal.jsx'
import RoutineDetailModal from '../../components/RoutineDetailModal.jsx'
import { useRoutineManager } from '../../hooks/useRoutineManager.js'

// "스쿼트 5×5 80kg" 형태로 한 운동을 요약
const summarizeExercise = ex => `${ex.exercise} ${ex.sets}×${ex.reps}${Number(ex.weight) ? ` ${ex.weight}kg` : ''}`

export default function MobileRoutines() {
  const {
    routines,
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
    toggleActive,
    setShowFormModal,
    setDetailRow,
    setFormRow,
  } = useRoutineManager()

  return (
    <div>
      <PageHeader title="루틴" color="bg-letusOrange" />
      <div className="p-4 space-y-3">
        {routines.length === 0 ? (
          <div className="py-16 text-center text-m-body text-gray-400 font-bold">등록된 루틴이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {routines.map(r => {
              const isSelected = selectedId === r.id
              return (
                <div
                  key={r.id}
                  onClick={e => (editMode ? toggleSelect(e, r.id) : setDetailRow(r))}
                  className={`relative bg-white rounded-xl border p-4 flex flex-col gap-1.5 cursor-pointer transition-colors ${
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

                  <div className="flex items-center justify-between gap-2 pr-8">
                    <span className="font-bold text-gray-800 text-m-body truncate">{r.name}</span>
                    {!editMode && (
                      <span
                        onClick={e => toggleActive(e, r.id)}
                        className={`shrink-0 text-m-caption font-bold px-3 py-2 rounded-lg cursor-pointer ${
                          r.isActive ? 'bg-blue-50 text-letusBlue' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {r.isActive ? '진행중' : '비활성'}
                      </span>
                    )}
                  </div>
                  <div className="text-m-caption text-gray-400 font-bold">
                    {r.repeatDays?.length ? r.repeatDays.join(', ') : '요일 미지정'} · {r.exercises.length}개 운동
                  </div>
                  {r.exercises.length > 0 && <div className="text-m-caption text-gray-500 truncate">{r.exercises.map(summarizeExercise).join(' · ')}</div>}
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-1 text-m-caption font-bold text-gray-400">총 {routines.length}건</div>

        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-lg py-3 text-m-body font-bold text-gray-400 active:border-letusBlue active:text-letusBlue transition-colors"
        >
          <Plus className="w-4 h-4" />
          루틴 추가
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
              선택한 루틴 수정하기
            </button>
          </div>
        )}
      </div>

      {showFormModal && <RoutineFormModal row={formRow} onClose={() => setShowFormModal(false)} onSave={handleFormSave} />}
      {detailRow && (
        <RoutineDetailModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onEdit={r => {
            setFormRow(r)
            setShowFormModal(true)
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
