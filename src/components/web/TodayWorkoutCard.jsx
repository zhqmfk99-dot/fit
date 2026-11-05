import { Play, Plus } from 'lucide-react'
import { useTodayWorkout } from '../../hooks/useTodayWorkout.js'
import QuickWorkoutModal from './QuickWorkoutModal.jsx'

// 오늘 운동 카드 (웹앱용 화면) — 대시보드 맨 위. 오늘 예정된 루틴이 있으면 바로 시작하고, 없으면 그 자리에서 운동을 등록해 시작한다.
// 규칙은 lib/todayWorkout.js. PWA는 메인 메뉴의 "운동하기" 카드(pages/mobile/MobileMenuScreen.jsx)가 같은 역할을 한다.
export default function TodayWorkoutCard() {
  const { status, start, showQuick, openQuick, closeQuick, routines, startExistingRoutine, startCustom } = useTodayWorkout('/workout/session')
  const pending = status.kind === 'pending'
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-ui-title font-bold text-gray-800">오늘 운동</h3>
        <p className="mt-0.5 text-ui-body font-bold text-gray-500 truncate">{status.subtitle}</p>
        {pending && (
          <div className="mt-2 h-1.5 w-48 max-w-full rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={status.doneCount} aria-valuemin={0} aria-valuemax={status.totalCount} aria-label="오늘 루틴 진행">
            <div className="h-full rounded-full bg-letusBlue" style={{ width: `${status.totalCount ? Math.round((status.doneCount / status.totalCount) * 100) : 0}%` }} />
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {pending && (
          <button type="button" onClick={openQuick} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-ui-body font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            다른 운동
          </button>
        )}
        <button type="button" onClick={start} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-letusBlue text-white text-ui-body font-bold hover:bg-blue-600 transition-colors">
          <Play className="w-3.5 h-3.5 fill-white" />
          {pending ? (status.doneCount > 0 ? '이어서 하기' : '운동 시작') : '운동 등록하고 시작'}
        </button>
      </div>
      {showQuick && <QuickWorkoutModal routines={routines} onClose={closeQuick} onStartRoutine={startExistingRoutine} onStartCustom={startCustom} />}
    </div>
  )
}
