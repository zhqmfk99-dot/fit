import { useBackHandler } from '../context/BackNavigationContext.jsx'
import { useState } from 'react'
import DateInput from './DateInput.jsx'

const ACCENT = 'bg-letusOrange'

export default function RescheduleModal({ routineName, currentDate, onClose, onConfirm }) {
  useBackHandler(onClose) // 뒤로가기(제스처)로 이 창을 닫는다
  const [newDate, setNewDate] = useState(currentDate)
  const [errorMsg, setErrorMsg] = useState('')

  const handleConfirm = () => {
    if (!newDate) return setErrorMsg('날짜를 선택해 주세요.')
    onConfirm(newDate)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[380px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <h3 className="text-m-body font-bold text-gray-800 flex items-center">
            <span className={`w-1.5 h-3.5 ${ACCENT} rounded-full mr-2`}></span>
            루틴 날짜 변경
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 bg-slate-50 flex-1 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-m-caption font-bold p-3 rounded border border-red-100 flex items-center gap-1.5">
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

          <div className="text-m-caption text-gray-500 leading-relaxed">
            <span className="font-bold text-gray-800">{routineName}</span> 세션 전체를 다른 날짜로 옮깁니다. 이 루틴에 속한 운동 기록이 모두 함께 이동합니다.
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-m-caption font-bold text-gray-700">
              새 날짜 <span className="text-red-500">*</span>
            </label>
            <DateInput value={newDate} onChange={setNewDate} fullWidth />
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
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-letusBlue text-white text-m-body font-bold rounded-[3px] hover:bg-blue-600 transition-colors"
          >
            변경
          </button>
        </div>
      </div>
    </div>
  )
}
