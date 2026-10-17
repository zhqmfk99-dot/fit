import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, CalendarClock, Play, Check, Pencil, Trash2, Search, X, Scale } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import WorkoutFormModal from '../../components/WorkoutFormModal.jsx'
import RescheduleModal from '../../components/RescheduleModal.jsx'
import BodyRecordModal from '../../components/mobile/BodyRecordModal.jsx'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { setCount, avgReps, avgWeight } from '../../lib/workoutMetrics.js'
import { useWorkoutLog, getLocalDateString, fatigueDotColor, fatigueBadgeColor } from '../../hooks/useWorkoutLog.js'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 신체 기록 요약에 보여줄 값 (있는 것만, 최대 4개)
const BODY_SUMMARY = [
  { key: 'weightKg', label: '몸무게', unit: 'kg' },
  { key: 'bodyFatPct', label: '체지방', unit: '%' },
  { key: 'muscleMassKg', label: '근육량', unit: 'kg' },
  { key: 'bmi', label: 'BMI', unit: '' },
]

// PWA(모바일) 전용 기록 화면. 글자 크기는 모바일 표준(text-m-*). (웹앱은 pages/WorkoutLog.jsx)
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
  const { bodyRecords } = useWorkoutLogs()
  const [showBodyModal, setShowBodyModal] = useState(false)

  const today = new Date()
  // 선택한 날짜에 신체 기록이 있으면 목록 위에 요약을 보여준다 (누르면 수정)
  const bodyRecordOfDay = bodyRecords.find(r => r.date === listDate)

  const renderLogCard = log => (
    <div
      key={log.id}
      className={`px-3 py-2.5 rounded-lg border flex items-center justify-between gap-2 ${
        log.isCompleted ? 'border-gray-100 bg-white' : 'border-dashed border-gray-300 bg-gray-50'
      }`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-m-body font-bold truncate ${log.isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>{log.exercise}</span>
        <span className="text-m-caption text-gray-400">
          {setCount(log)}세트 x {avgReps(log)}회 x {avgWeight(log)}kg
        </span>
      </div>
      <div className="flex items-center shrink-0">
        {log.isCompleted ? (
          <span className={`text-m-caption font-bold px-2 py-0.5 rounded ${fatigueBadgeColor(log.fatigue)} mr-1`}>{log.fatigue}</span>
        ) : (
          <span className="text-m-caption font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-400 mr-1">예정</span>
        )}
        {!log.isCompleted && (
          <button onClick={() => toggleComplete(log.id)} className="w-9 h-9 flex items-center justify-center text-gray-400 active:text-green-600 active:bg-gray-100 rounded-full transition-colors" title="완료 처리">
            <Check className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => openEdit(log)} className="w-9 h-9 flex items-center justify-center text-gray-400 active:text-letusBlue active:bg-gray-100 rounded-full transition-colors" title="수정">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => handleDelete(log.id)} className="w-9 h-9 flex items-center justify-center text-gray-400 active:text-red-500 active:bg-gray-100 rounded-full transition-colors" title="삭제">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title="기록" color="bg-letusOrange" />
      {/* 아래 고정 버튼 바가 목록을 가리지 않도록 아래 여백(pb-28)을 둔다 */}
      <div className="p-4 pb-28 space-y-3">
        {/* 월 이동 */}
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-2 py-1.5">
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-md" aria-label="이전 달">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-m-title font-black text-gray-800">
              {year}년 {month + 1}월
            </span>
            <button onClick={goToday} className="text-m-caption font-bold text-letusBlue bg-blue-50 px-3 py-2 rounded-md">
              오늘
            </button>
          </div>
          <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-md" aria-label="다음 달">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="운동명 검색"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-9 border border-gray-300 rounded-lg text-m-body font-medium focus:outline-none focus:border-letusBlue bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-400" aria-label="검색어 지우기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 캘린더 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-slate-50">
            {DOW.map((day, idx) => (
              <div key={day} className={`py-2 text-center text-m-caption font-black ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
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
              const hasBody = bodyRecords.some(r => r.date === dateStr)

              return (
                <button
                  key={idx}
                  onClick={() => setListDate(dateStr)}
                  className={`flex flex-col items-center gap-1 py-1.5 border-r border-b border-gray-50 last:border-r-0 ${
                    isSelected ? 'bg-blue-50' : cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <span
                    className={`text-m-caption font-bold w-7 h-7 flex items-center justify-center rounded-full ${
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
                    {/* 신체 기록이 있는 날은 초록 네모로 표시 */}
                    {hasBody && <div className="w-1.5 h-1.5 rounded-[2px] bg-emerald-500" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택 날짜 목록 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-m-body font-black text-gray-800">{listDate}</span>
          <span className="text-m-caption font-bold text-gray-400">{sidebarLogs.length}건</span>
        </div>

        {bodyRecordOfDay && (
          <button onClick={() => setShowBodyModal(true)} className="w-full text-left bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 flex items-center gap-3 active:bg-emerald-100 transition-colors">
            <Scale className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-m-body font-bold text-emerald-800">신체 기록</div>
              <div className="text-m-caption text-emerald-700 truncate">
                {BODY_SUMMARY.filter(f => bodyRecordOfDay[f.key] != null)
                  .map(f => `${f.label} ${bodyRecordOfDay[f.key]}${f.unit}`)
                  .join(' · ')}
              </div>
            </div>
            <Pencil className="w-4 h-4 text-emerald-600 shrink-0" />
          </button>
        )}

        <div className="space-y-2">
          {routineGroups.map(group => {
            const routine = routines.find(r => r.id === group.routineId)
            const isExpanded = expandedRoutineIds.includes(group.routineId)
            const completedCount = group.logs.filter(l => l.isCompleted).length
            const groupDate = group.logs[0]?.date
            const hasPending = group.logs.some(l => !l.isCompleted)

            return (
              <div key={group.routineId} className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                <button onClick={() => toggleExpand(group.routineId)} className="w-full flex items-center gap-2 px-3 py-3 bg-slate-50 text-left">
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  <span className="text-m-body font-bold text-gray-800 truncate flex-1">{routine?.name || '루틴'}</span>
                  <span className="text-m-caption font-bold text-gray-400 shrink-0">
                    {completedCount}/{group.logs.length} 완료
                  </span>
                </button>

                <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-50">
                  <button
                    onClick={() => setRescheduleTarget({ routineId: group.routineId, oldDate: groupDate, routineName: routine?.name || '루틴' })}
                    className="flex items-center gap-1 text-m-caption font-bold text-gray-500 px-3 py-2 rounded-lg bg-gray-50"
                  >
                    <CalendarClock className="w-4 h-4" />
                    날짜 변경
                  </button>
                  {hasPending && (
                    <button
                      onClick={() => navigate(`/mobile/session?routineId=${group.routineId}&date=${groupDate}`)}
                      className="flex items-center gap-1 text-m-caption font-bold text-white bg-letusBlue px-3.5 py-2 rounded-lg"
                    >
                      <Play className="w-3.5 h-3.5" fill="currentColor" />
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
            <div className="text-center text-m-body text-gray-400 py-10 font-bold bg-white rounded-lg border border-gray-100">
              {searchQuery ? '검색 결과가 없습니다.' : '이 날짜엔 기록이 없습니다.'}
            </div>
          )}
        </div>
      </div>

      {/* 하단 고정 버튼 바 — 목록이 길어도 기록 추가가 항상 손 닿는 곳에 있다 */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <button
          onClick={() => openCreate(listDate)}
          className="flex-1 h-12 bg-letusBlue text-white text-m-body font-bold rounded-lg active:bg-blue-600 transition-colors"
        >
          + 운동 기록
        </button>
        <button
          onClick={() => setShowBodyModal(true)}
          className="flex-1 h-12 bg-emerald-600 text-white text-m-body font-bold rounded-lg active:bg-emerald-700 transition-colors"
        >
          + 신체 기록
        </button>
      </div>

      {showModal && <WorkoutFormModal row={modalRow} initialDate={modalDate} onClose={() => setShowModal(false)} onSave={handleModalSave} />}
      {showBodyModal && <BodyRecordModal initialDate={listDate} onClose={() => setShowBodyModal(false)} />}

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
