import { Plus, Pencil } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import RoutineFormModal from '../components/RoutineFormModal.jsx'
import RoutineDetailModal from '../components/RoutineDetailModal.jsx'
import { useRoutineManager } from '../hooks/useRoutineManager.js'

export default function WorkoutRoutine() {
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-left whitespace-nowrap table-fixed text-sm">
              <thead className="bg-slate-50 border-b border-gray-200 text-sm text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  {editMode && <th className="p-4 pl-6 w-10 text-center shrink-0"></th>}
                  <th className="p-4 text-center">루틴명</th>
                  <th className="p-4 text-center">구성</th>
                  <th className="p-4 text-center w-24">활성</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {routines.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 4 : 3} className="p-16 text-center text-gray-400 font-bold">
                      등록된 루틴이 없습니다.
                    </td>
                  </tr>
                ) : (
                  routines.map(r => (
                    <tr
                      key={r.id}
                      className={`transition-colors cursor-pointer ${
                        editMode ? (selectedId === r.id ? 'bg-red-50' : 'hover:bg-red-50/40') : 'hover:bg-blue-50/30'
                      }`}
                      onClick={e => (editMode ? toggleSelect(e, r.id) : setDetailRow(r))}
                    >
                      {editMode && (
                        <td className="p-4 pl-6 text-center" onClick={e => toggleSelect(e, r.id)}>
                          <input type="checkbox" checked={selectedId === r.id} onChange={() => {}} className="w-4 h-4 accent-red-500 cursor-pointer" />
                        </td>
                      )}
                      <td className="p-4 text-left truncate font-bold text-gray-800" title={r.name}>
                        {r.name}
                      </td>
                      <td className="p-4 text-center text-gray-500">
                        {r.repeatDays?.length ? r.repeatDays.join(',') : '요일 미지정'} · {r.exercises.length}개 운동
                      </td>
                      <td className="p-4 text-center" onClick={e => toggleActive(e, r.id)}>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                            r.isActive ? 'bg-blue-50 text-letusBlue' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {r.isActive ? '진행중' : '비활성'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-sm text-gray-500 font-bold">
            <span>총 {routines.length}건</span>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm font-bold text-gray-400 hover:border-letusBlue hover:text-letusBlue hover:bg-blue-50/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          루틴 추가
        </button>

        {!editMode ? (
          <button
            onClick={enterEditMode}
            className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-red-300 rounded-lg py-3 text-sm font-bold text-red-400 hover:border-red-500 hover:text-red-600 hover:bg-red-50/40 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={exitEditMode}
              className="flex-1 border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm font-bold text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmEdit}
              disabled={!selectedId}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-colors ${
                selectedId ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
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
