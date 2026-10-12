import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import RoutineFormModal from '../components/web/RoutineFormModal.jsx'
import RoutineDetailModal from '../components/web/RoutineDetailModal.jsx'
import { useRoutineManager } from '../hooks/useRoutineManager.js'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '진행중' },
  { id: 'inactive', label: '비활성' },
]

// "스쿼트 5×5 80kg" 형태로 한 운동을 요약
const summarizeExercise = ex => `${ex.exercise} ${ex.sets}×${ex.reps}${Number(ex.weight) ? ` ${ex.weight}kg` : ''}`

// 웹앱 전용 루틴 화면. 수정 모드 없이 행에서 바로 수정/삭제한다. (PWA는 MobileRoutines.jsx)
export default function WorkoutRoutine() {
  const {
    routines,
    showFormModal,
    formRow,
    detailRow,
    openCreate,
    handleFormSave,
    handleDelete,
    toggleActive,
    setShowFormModal,
    setDetailRow,
    setFormRow,
  } = useRoutineManager()
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])

  const shown = routines.filter(r => (filter === 'active' ? r.isActive : filter === 'inactive' ? !r.isActive : true))
  // 필터로 가려졌거나 삭제된 루틴의 선택은 세지 않는다
  const selectedCount = shown.filter(r => selectedIds.includes(r.id)).length
  const allChecked = shown.length > 0 && selectedCount === shown.length

  const toggleRow = (e, id) => {
    e.stopPropagation()
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }
  const toggleAll = () => {
    const shownIds = shown.map(r => r.id)
    setSelectedIds(prev => (allChecked ? prev.filter(id => !shownIds.includes(id)) : [...new Set([...prev, ...shownIds])]))
  }

  const openEdit = (e, routine) => {
    e.stopPropagation()
    setFormRow(routine)
    setShowFormModal(true)
  }
  const askDelete = (e, routine) => {
    e.stopPropagation()
    handleDelete(routine)
  }

  return (
    <div>
      <PageHeader title="루틴" color="bg-letusOrange" />
      <div className="p-4 space-y-3">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-2 min-h-[56px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-ui-title font-black text-gray-800 tracking-tight">
              루틴 {routines.length}건
              {selectedCount > 0 && <span className="text-letusBlue font-bold"> · {selectedCount}건 선택</span>}
            </h2>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1 text-ui-body font-bold rounded-md transition-colors ${
                    filter === f.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-letusBlue text-white text-ui-body font-bold px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            루틴 추가
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 border-b border-gray-200 text-ui-body text-slate-500 font-bold">
              <tr>
                <th className="pl-4 pr-2 py-2.5 w-[44px] text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={shown.length === 0}
                    className="w-3.5 h-3.5 accent-letusBlue cursor-pointer align-middle"
                    title="전체 선택"
                  />
                </th>
                <th className="px-4 py-2.5 w-[20%] text-center">루틴명</th>
                <th className="px-4 py-2.5 w-[22%] text-center">반복 요일</th>
                <th className="px-4 py-2.5 text-center">운동 구성</th>
                <th className="px-4 py-2.5 w-[72px] text-center">운동 수</th>
                <th className="px-4 py-2.5 w-[88px] text-center">상태</th>
                <th className="px-4 py-2.5 w-[84px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-ui-body text-gray-400 font-bold">
                    {routines.length === 0 ? '등록된 루틴이 없습니다.' : '해당하는 루틴이 없습니다.'}
                  </td>
                </tr>
              ) : (
                shown.map(r => {
                  const summary = r.exercises.map(summarizeExercise).join(' · ')
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setDetailRow(r)}
                      className={`group cursor-pointer transition-colors ${selectedIds.includes(r.id) ? 'bg-blue-50/60' : 'hover:bg-blue-50/30'}`}
                    >
                      <td className="pl-4 pr-2 py-3 text-center" onClick={e => toggleRow(e, r.id)}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-letusBlue cursor-pointer align-middle"
                        />
                      </td>
                      <td className="px-4 py-3 text-ui-body font-bold text-gray-800 truncate" title={r.name}>
                        {r.name}
                      </td>
                      <td className="px-4 py-3">
                        {r.repeatDays?.length ? (
                          <div className="flex gap-1">
                            {DAYS.map(d => (
                              <span
                                key={d}
                                className={`w-5 h-5 flex items-center justify-center rounded text-ui-caption font-bold ${
                                  r.repeatDays.includes(d) ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-300'
                                }`}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-ui-caption text-gray-400 font-bold">요일 미지정</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ui-body text-gray-500 truncate" title={summary}>
                        {summary || '-'}
                      </td>
                      <td className="px-4 py-3 text-ui-body text-gray-500 text-center">{r.exercises.length}개</td>
                      <td className="px-4 py-3 text-center" onClick={e => toggleActive(e, r.id)}>
                        <span
                          className={`text-ui-caption font-bold px-2 py-0.5 rounded cursor-pointer ${
                            r.isActive ? 'bg-blue-50 text-letusBlue' : 'bg-gray-100 text-gray-400'
                          }`}
                          title="클릭하면 진행중/비활성이 바뀝니다"
                        >
                          {r.isActive ? '진행중' : '비활성'}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => openEdit(e, r)} className="p-1.5 text-gray-400 hover:text-letusBlue hover:bg-gray-100 rounded-full transition-colors" title="수정">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => askDelete(e, r)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors" title="삭제">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
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
