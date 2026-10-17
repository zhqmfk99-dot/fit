import { repsText } from '../../lib/progression.js'

const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일']

export default function RoutineDetailModal({ row, onClose, onEdit, onDelete }) {
  if (!row) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[440px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-ui-body font-bold text-gray-800 flex items-center gap-2">
            <span className="flex items-center">
              <span className="w-1.5 h-3.5 bg-letusOrange rounded-full mr-2"></span>
              루틴 상세
            </span>
            <span className="text-ui-body text-gray-400 font-normal">{row.exercises.length}개 운동</span>
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 bg-slate-50 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-ui-body font-bold text-gray-800">{row.name}</span>
            <span
              className={`text-ui-caption font-bold px-2 py-0.5 rounded ${
                row.isActive ? 'bg-blue-50 text-letusBlue' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {row.isActive ? '진행중' : '비활성'}
            </span>
          </div>

          <div>
            <label className="block text-ui-body font-bold text-gray-600 mb-1.5">반복 요일</label>
            <div className="flex gap-1.5">
              {ALL_DAYS.map(day => {
                const isSelected = row.repeatDays?.includes(day)
                return (
                  <span
                    key={day}
                    className={`w-8 h-8 rounded-full text-ui-body font-bold flex items-center justify-center ${
                      isSelected ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-300'
                    }`}
                  >
                    {day}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg bg-white p-3 space-y-1.5">
            <div className="text-ui-body font-bold text-gray-600 mb-1">운동 목록</div>
            {row.exercises.length === 0 ? (
              <div className="text-ui-body text-gray-300">등록된 운동이 없습니다</div>
            ) : (
              row.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-ui-body">
                  <span className="text-gray-700">{ex.exercise}</span>
                  <span className="text-gray-400">
                    {ex.sets}세트 x {repsText(ex)}회 x {ex.weight}kg
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="px-4 py-[9px] text-red-500 text-ui-body font-bold rounded-[3px] hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-[9px] border border-gray-300 text-gray-600 text-ui-body font-bold rounded-[3px] hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
            {onEdit && (
              <button
                onClick={() => {
                  onClose()
                  onEdit(row)
                }}
                className="px-5 py-[9px] bg-letusBlue text-white text-ui-body font-bold rounded-[3px] hover:bg-blue-600 transition-colors"
              >
                수정하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
