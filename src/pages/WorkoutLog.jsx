import { useState } from 'react'
import { ChevronDown, CalendarClock, Play } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import WorkoutFormModal from '../components/web/WorkoutFormModal.jsx'
import BodyRecordModal from '../components/BodyRecordModal.jsx'
import { useDayKcal } from '../hooks/useDayKcal.js'
import { useDayDuration } from '../hooks/useDayDuration.js'
import { formatDuration } from '../lib/workoutTime.js'
import RescheduleModal from '../components/web/RescheduleModal.jsx'
import { setCount, avgReps, avgWeight } from '../lib/workoutMetrics.js'
import { useWorkoutLog, getLocalDateString, fatigueDotColor, fatigueBadgeColor } from '../hooks/useWorkoutLog.js'

export default function WorkoutLog() {
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
  const [showBodyModal, setShowBodyModal] = useState(false)
  const dayKcal = useDayKcal(listDate)
  const daySeconds = useDayDuration(listDate)

  const renderLogRow = log => (
    <div
      key={log.id}
      className={`group px-3 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
        log.isCompleted ? 'border-gray-100 bg-white hover:border-gray-200' : 'border-dashed border-gray-300 bg-gray-50'
      }`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-ui-body font-bold truncate ${log.isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>{log.exercise}</span>
        <span className="text-ui-caption text-gray-400">
          {setCount(log)}세트 x {avgReps(log)}회 x {avgWeight(log)}kg
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {log.isCompleted ? (
          <span className={`text-ui-caption font-bold px-2 py-0.5 rounded ${fatigueBadgeColor(log.fatigue)}`}>{log.fatigue}</span>
        ) : (
          <span className="text-ui-caption font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-400">예정</span>
        )}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {!log.isCompleted && (
            <button
              onClick={() => toggleComplete(log.id)}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded-full transition-colors"
              title="완료 처리"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button onClick={() => openEdit(log)} className="p-1.5 text-gray-400 hover:text-letusBlue hover:bg-gray-100 rounded-full transition-colors" title="수정">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button onClick={() => handleDelete(log.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors" title="삭제">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  const today = new Date()

  return (
    <div>
      <PageHeader title="기록" color="bg-letusOrange" />
      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-2 min-h-[56px] flex flex-col md:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-ui-title font-black text-gray-800 tracking-tight">
              {year}년 {month + 1}월
            </h2>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button onClick={prevMonth} className="p-1 hover:bg-white rounded-md text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={goToday} className="px-3 py-1 text-ui-body font-bold text-gray-700 hover:bg-white rounded-md">
                오늘
              </button>
              <button onClick={nextMonth} className="p-1 hover:bg-white rounded-md text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-4 items-center w-full md:w-auto">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>피로 낮음
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>보통
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>높음
              </span>
            </div>

            <div className="relative flex items-center flex-1 md:flex-none">
              <input
                type="text"
                placeholder="운동명 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg text-ui-body font-medium focus:outline-none focus:border-letusBlue w-full md:w-56"
              />
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 w-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px] flex-1 lg:w-[calc(100%-360px)]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 shrink-0">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <div key={day} className={`py-2.5 text-center text-ui-body font-black ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
              {calendarCells.map((cell, idx) => {
                const pad = n => String(n).padStart(2, '0')
                const dateStr = `${cell.date.getFullYear()}-${pad(cell.date.getMonth() + 1)}-${pad(cell.date.getDate())}`
                const dayLogs = displayedLogs.filter(l => l.date === dateStr)
                const isToday = dateStr === getLocalDateString(today)
                const isSelected = dateStr === listDate

                return (
                  <div
                    key={idx}
                    onClick={() => setListDate(dateStr)}
                    className={`border-r border-b border-slate-100 p-1.5 sm:p-2 cursor-pointer flex flex-col h-[80px] sm:h-[100px] overflow-hidden group transition-colors ${
                      isSelected ? 'bg-blue-50/60 ring-inset ring-2 ring-blue-200' : cell.isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-start shrink-0">
                      <span
                        className={`text-ui-body font-bold w-5 h-5 flex items-center justify-center rounded-full ${
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
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          openCreate(dateStr)
                        }}
                        className="text-gray-400 hover:text-letusBlue hover:bg-blue-100 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="기록 등록"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5 px-0.5 content-start flex-1">
                      {dayLogs.map(log =>
                        log.isCompleted ? (
                          <div key={log.id} className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${fatigueDotColor(log.fatigue)}`} title={`${log.exercise} (피로 ${log.fatigue})`} />
                        ) : (
                          <div key={log.id} className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-gray-400 bg-white" title={`${log.exercise} (예정)`} />
                        ),
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col w-full lg:w-[360px] shrink-0 h-[600px] lg:h-auto overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between min-h-[28px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-letusOrange rounded-full"></span>
                  <h3 className="font-bold text-gray-800 text-ui-body leading-none">운동 기록 LIST</h3>
                </div>
                <span className="bg-blue-100 text-letusBlue text-ui-caption font-bold px-2 py-0.5 rounded-full leading-none">{sidebarLogs.length}건</span>
              </div>
              <div className="flex items-center justify-between pl-3 leading-none">
                <span className="text-ui-caption font-bold text-gray-500">{listDate}</span>
                {daySeconds != null && (
                  <span className="text-ui-caption font-bold text-letusBlue" title="세트 시작·종료 시각을 합친 총 운동 시간입니다">
                    {formatDuration(daySeconds)}
                  </span>
                )}
                {dayKcal.kcal != null && (
                  <span className="text-ui-caption font-bold text-orange-600" title="시간 기반 MET에 강도를 반영한 추정치입니다 (오차가 큽니다)">
                    약 {dayKcal.kcal.toLocaleString()} kcal
                  </span>
                )}
                {dayKcal.needsWeight && <span className="text-ui-caption font-bold text-gray-400">신체 기록에 몸무게를 입력하면 칼로리가 표시됩니다</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
              {routineGroups.map(group => {
                const routine = routines.find(r => r.id === group.routineId)
                const isExpanded = expandedRoutineIds.includes(group.routineId)
                const completedCount = group.logs.filter(l => l.isCompleted).length

                const groupDate = group.logs[0]?.date
                const hasPending = group.logs.some(l => !l.isCompleted)

                return (
                  <div key={group.routineId} className="group/routine border border-gray-100 rounded-lg overflow-hidden">
                    <div className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <button onClick={() => toggleExpand(group.routineId)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        <span className="text-ui-body font-bold text-gray-800 truncate">{routine?.name || '루틴'}</span>
                        <span className="text-ui-caption font-bold text-gray-400 shrink-0">
                          {completedCount}/{group.logs.length} 완료
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setRescheduleTarget({ routineId: group.routineId, oldDate: groupDate, routineName: routine?.name || '루틴' })
                          }}
                          className="flex items-center gap-1 text-ui-caption font-bold text-gray-400 hover:text-letusBlue px-1.5 py-1 rounded hover:bg-white opacity-0 group-hover/routine:opacity-100 transition-opacity"
                          title="날짜 변경"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          날짜 변경
                        </button>

                        {hasPending && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigate(`/mobile/session?routineId=${group.routineId}&date=${groupDate}`)
                            }}
                            className="flex items-center gap-1 text-ui-caption font-bold text-white bg-letusBlue hover:bg-blue-600 px-2 py-1 rounded transition-colors"
                            title="운동 시작"
                          >
                            <Play className="w-3 h-3" fill="currentColor" />
                            시작하기
                          </button>
                        )}
                      </div>
                    </div>
                    {isExpanded && <div className="p-2 space-y-1.5 bg-white">{group.logs.map(renderLogRow)}</div>}
                  </div>
                )
              })}

              {standaloneLogs.map(renderLogRow)}

              {sidebarLogs.length === 0 && (
                <div className="text-center text-ui-body text-gray-400 py-10 font-bold">{searchQuery ? '검색 결과가 없습니다.' : '이 날짜엔 기록이 없습니다.'}</div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 shrink-0 flex flex-col gap-2">
              <button
                onClick={() => openCreate(listDate)}
                className="w-full bg-letusBlue text-white text-ui-body font-bold py-2.5 rounded-lg hover:bg-blue-600 transition-colors"
              >
                + 운동 기록 추가
              </button>
              <button
                onClick={() => setShowBodyModal(true)}
                className="w-full bg-emerald-600 text-white text-ui-body font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                + 신체 기록
              </button>
            </div>
          </div>
        </div>
      </div>

      {showBodyModal && <BodyRecordModal initialDate={listDate} onClose={() => setShowBodyModal(false)} />}

      {showModal && (
        <WorkoutFormModal row={modalRow} initialDate={modalDate} onClose={() => setShowModal(false)} onSave={handleModalSave} />
      )}

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
