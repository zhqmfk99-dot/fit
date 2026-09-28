import { ChevronDown, ChevronLeft, ChevronRight, CalendarClock, Play, Check, Pencil, Trash2 } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import WorkoutFormModal from '../../components/WorkoutFormModal.jsx'
import RescheduleModal from '../../components/RescheduleModal.jsx'
import { setCount, avgReps, avgWeight } from '../../lib/workoutMetrics.js'
import { useWorkoutLog, getLocalDateString, fatigueDotColor, fatigueBadgeColor } from '../../hooks/useWorkoutLog.js'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export default function MobileLog() {
  const {
    navigate,
    routines,
    year,
    month,
    calendarCells,
    prevMonth,
    nextMonth,
    goToday,
    searchQuery,
    setSearchQuery,
    listDate,
    setListDate,
    displayedLogs,
    sidebarLogs,
    routineGroups,
    standaloneLogs,
    expandedRoutineIds,
    toggleExpand,
    rescheduleTarget,
    setRescheduleTarget,
    handleRescheduleConfirm,
    showModal,
    setShowModal,
    modalRow,
    modalDate,
    openCreate,
    openEdit,
    handleDelete,
    toggleComplete,
    handleModalSave,
  } = useWorkoutLog()

  const today = new Date()

  const renderLogCard = log => (
    <div
      key={log.id}
      className={`px-3 py-2.5 rounded-lg border flex items-center justify-between gap-2 ${
        log.isCompleted ? 'border-gray-100 bg-white' : 'border-dashed border-gray-300 bg-gray-50'
      }`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-sm font-bold truncate ${log.isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>{log.exercise}</span>
        <span className="text-xs text-gray-400">
          {setCount(log)}세트 x {avgReps(log)}회 x {avgWeight(log)}kg
        </span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {log.isCompleted ? (
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${fatigueBadgeColor(log.fatigue)} mr-1`}>{log.fatigue}</span>
        ) : (
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-400 mr-1">예정</span>
        )}
        {!log.isCompleted && (
          <button onClick={() => toggleComplete(log.id)} className="p-1.5 text-gray-400 active:text-green-600 active:bg-gray-100 rounded-full transition-colors" title="완료 처리">
            <Check className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => openEdit(log)} className="p-1.5 text-gray-400 active:text-letusBlue active:bg-gray-100 rounded-full transition-colors" title="수정">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => handleDelete(log.id)} className="p-1.5 text-gray-400 active:text-red-500 active:bg-gray-100 rounded-full transition-colors" title="삭제">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title="기록" color="bg-letusOrange" />
      <div className="p-4 space-y-3">
        {/* 월 이동 */}
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
          <button onClick={prevMonth} className="p-1.5 text-gray-500 active:bg-gray-100 rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-gray-800">
              {year}년 {month + 1}월
            </span>
            <button onClick={goToday} className="text-xs font-bold text-letusBlue bg-blue-50 px-2 py-1 rounded-md">
              오늘
            </button>
          </div>
          <button onClick={nextMonth} className="p-1.5 text-gray-500 active:bg-gray-100 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 검색 */}
        <input
          type="text"
          placeholder="운동명 검색"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:border-letusBlue bg-white"
        />

        {/* 캘린더 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-slate-50">
            {DOW.map((day, idx) => (
              <div key={day} className={`py-2 text-center text-xs font-black ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              const pad = n => String(n).padStart(2, '0')
              const dateStr = `${cell.date.getFullYear()}-${pad(cell.date.getMonth() + 1)}-${pad(cell.date.getDate())}`
              const dayLogs = displayedLogs.filter(l => l.date === dateStr)
              const isToday = dateStr === getLocalDateString(today)
              const isSelected = dateStr === listDate

              return (
                <button
                  key={idx}
                  onClick={() => setListDate(dateStr)}
                  className={`flex flex-col items-center gap-1 py-1.5 border-r border-b border-gray-50 last:border-r-0 ${
                    isSelected ? 'bg-blue-50' : cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-letusBlue text-white'
                        : !cell.isCurrentMonth
                          ? 'text-gray-300'
                          : idx % 7 === 0
                            ? 'text-red-500'
                            : idx % 7 === 6
                              ? 'text-blue-500'
                              : 'text-gray-700'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="flex gap-0.5 h-1.5">
                    {dayLogs.slice(0, 3).map(log =>
                      log.isCompleted ? (
                        <div key={log.id} className={`w-1.5 h-1.5 rounded-full ${fatigueDotColor(log.fatigue)}`} />
                      ) : (
                        <div key={log.id} className="w-1.5 h-1.5 rounded-full border border-gray-400 bg-white" />
                      ),
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택 날짜 목록 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-black text-gray-800">{listDate}</span>
          <span className="text-xs font-bold text-gray-400">{sidebarLogs.length}건</span>
        </div>

        <div className="space-y-2">
          {routineGroups.map(group => {
            const routine = routines.find(r => r.id === group.routineId)
            const isExpanded = expandedRoutineIds.includes(group.routineId)
            const completedCount = group.logs.filter(l => l.isCompleted).length
            const groupDate = group.logs[0]?.date
            const hasPending = group.logs.some(l => !l.isCompleted)

            return (
              <div key={group.routineId} className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                <button onClick={() => toggleExpand(group.routineId)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 text-left">
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-bold text-gray-800 truncate flex-1">{routine?.name || '루틴'}</span>
                  <span className="text-xs font-bold text-gray-400 shrink-0">
                    {completedCount}/{group.logs.length} 완료
                  </span>
                </button>

                <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-50">
                  <button
                    onClick={() => setRescheduleTarget({ routineId: group.routineId, oldDate: groupDate, routineName: routine?.name || '루틴' })}
                    className="flex items-center gap-1 text-xs font-bold text-gray-500 px-2 py-1 rounded bg-gray-50"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    날짜 변경
                  </button>
                  {hasPending && (
                    <button
                      onClick={() => navigate(`/mobile/session?routineId=${group.routineId}&date=${groupDate}`)}
                      className="flex items-center gap-1 text-xs font-bold text-white bg-letusBlue px-2.5 py-1 rounded"
                    >
                      <Play className="w-3 h-3" fill="currentColor" />
                      시작하기
                    </button>
                  )}
                </div>

                {isExpanded && <div className="p-2 space-y-1.5 border-t border-gray-50">{group.logs.map(renderLogCard)}</div>}
              </div>
            )
          })}

          {standaloneLogs.map(renderLogCard)}

          {sidebarLogs.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-10 font-bold bg-white rounded-lg border border-gray-100">
              {searchQuery ? '검색 결과가 없습니다.' : '이 날짜엔 기록이 없습니다.'}
            </div>
          )}
        </div>

        <button
          onClick={() => openCreate(listDate)}
          className="w-full bg-letusBlue text-white text-sm font-bold py-3 rounded-lg active:bg-blue-600 transition-colors"
        >
          + 기록 추가
        </button>
      </div>

      {showModal && <WorkoutFormModal row={modalRow} initialDate={modalDate} onClose={() => setShowModal(false)} onSave={handleModalSave} />}

      {rescheduleTarget && (
        <RescheduleModal
          routineName={rescheduleTarget.routineName}
          currentDate={rescheduleTarget.oldDate}
          onClose={() => setRescheduleTarget(null)}
          onConfirm={handleRescheduleConfirm}
        />
      )}
    </div>
  )
}
