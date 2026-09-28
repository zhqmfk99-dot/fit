import { MUSCLE_LABELS } from '../lib/muscleMap.js'

export default function ExerciseDetailModal({ row, onClose, onEdit, onDelete }) {
  if (!row) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-sm font-bold text-gray-800 flex items-center">
            <span className="w-1.5 h-3.5 bg-letusOrange rounded-full mr-2"></span>
            운동 상세
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 bg-slate-50 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">운동명</label>
            <div className="text-base font-black text-gray-800">{row.name}</div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1.5">부위</label>
            <div className="flex flex-wrap gap-1.5">
              {row.muscles.map(m => (
                <span key={m} className="px-3 py-1.5 rounded-full text-sm font-bold bg-orange-50 text-letusOrange">
                  {MUSCLE_LABELS[m] || m}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1.5">사용장비</label>
            <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-blue-50 text-letusBlue">{row.equipment || '-'}</span>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="px-4 py-[9px] text-red-500 text-sm font-bold rounded-[3px] hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-[9px] border border-gray-300 text-gray-600 text-sm font-bold rounded-[3px] hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
            {onEdit && (
              <button
                onClick={() => {
                  onClose()
                  onEdit(row)
                }}
                className="px-5 py-[9px] bg-letusBlue text-white text-sm font-bold rounded-[3px] hover:bg-blue-600 transition-colors"
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
