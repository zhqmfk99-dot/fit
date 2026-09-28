import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const pad = n => String(n).padStart(2, '0')

export default function DateRangeInput({ startDate, endDate, onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selecting, setSelecting] = useState('start')
  const [hoverDate, setHoverDate] = useState(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
  const containerRef = useRef(null)
  const popupRef = useRef(null)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const [viewYear, setViewYear] = useState(() => (startDate ? parseInt(startDate.slice(0, 4)) : today.getFullYear()))
  const [viewMonth, setViewMonth] = useState(() => (startDate ? parseInt(startDate.slice(5, 7)) - 1 : today.getMonth()))

  const handleOpen = () => {
    if (!isOpen) {
      if (startDate) {
        setViewYear(parseInt(startDate.slice(0, 4)))
        setViewMonth(parseInt(startDate.slice(5, 7)) - 1)
      }
      setSelecting('start')
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const popupW = 256
        const popupH = 280
        const left = rect.left
        const spaceBelow = window.innerHeight - rect.bottom - 4
        const top = spaceBelow >= popupH ? rect.bottom + 4 : rect.top - popupH - 4
        setPopupPos({
          top: Math.max(4, top),
          left: Math.max(4, Math.min(left, window.innerWidth - popupW - 4)),
        })
      }
    }
    setIsOpen(o => !o)
  }

  useEffect(() => {
    if (!isOpen) return
    const onDown = e => {
      if (containerRef.current?.contains(e.target)) return
      if (popupRef.current?.contains(e.target)) return
      setIsOpen(false)
      setHoverDate(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen])

  const handleDayClick = dateStr => {
    if (selecting === 'start') {
      onChange(dateStr, dateStr)
      setSelecting('end')
    } else {
      if (dateStr < startDate) onChange(dateStr, startDate)
      else onChange(startDate, dateStr)
      setIsOpen(false)
      setHoverDate(null)
      setSelecting('start')
    }
  }

  const handlePreset = type => {
    const end = new Date()
    const start = new Date()
    if (type === '1w') start.setDate(start.getDate() - 6)
    else if (type === '1m') start.setMonth(start.getMonth() - 1)
    else if (type === '6m') start.setMonth(start.getMonth() - 6)
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    onChange(fmt(start), fmt(end))
    setIsOpen(false)
    setHoverDate(null)
    setSelecting('start')
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const years = Array.from({ length: 10 }, (_, i) => today.getFullYear() - 3 + i)

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else setViewMonth(m => m + 1)
  }

  let effStart = startDate
  let effEnd = endDate
  if (selecting === 'end' && hoverDate) {
    if (hoverDate < startDate) {
      effStart = hoverDate
      effEnd = startDate
    } else {
      effStart = startDate
      effEnd = hoverDate
    }
  }

  const displayValue = startDate && endDate ? `${startDate}  ~  ${endDate}` : startDate || ''

  return (
    <div ref={containerRef} className={`inline-block ${className}`}>
      <div
        onClick={handleOpen}
        className="border border-gray-200 rounded-[3px] text-xs px-2.5 h-[30px] flex items-center gap-1.5 cursor-pointer text-gray-700 bg-white hover:border-gray-300 min-w-[210px]"
      >
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className={displayValue ? 'text-gray-700' : 'text-gray-400'}>{displayValue || '날짜 범위 선택'}</span>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left }}
            className="z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl w-[256px] select-none overflow-hidden"
          >
            <div className="bg-letusOrange px-3 py-2 flex items-center justify-between">
              <button onClick={prevMonth} className="text-white text-lg font-bold w-6 text-center hover:opacity-70 leading-none">
                ‹
              </button>
              <div className="flex items-center gap-1">
                <select
                  value={viewYear}
                  onChange={e => setViewYear(Number(e.target.value))}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y} className="text-gray-800 bg-white">
                      {y}년
                    </option>
                  ))}
                </select>
                <select
                  value={viewMonth}
                  onChange={e => setViewMonth(Number(e.target.value))}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i).map(m => (
                    <option key={m} value={m} className="text-gray-800 bg-white">
                      {m + 1}월
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={nextMonth} className="text-white text-lg font-bold w-6 text-center hover:opacity-70 leading-none">
                ›
              </button>
            </div>

            <div className="text-center text-[10px] py-1.5 border-b border-gray-100 font-bold text-gray-400">
              {selecting === 'start' ? '시작일을 선택하세요' : '종료일을 선택하세요'}
            </div>

            <div className="grid grid-cols-7 px-2 pt-2">
              {DAY_NAMES.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-bold pb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 pb-2">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e${idx}`} className="h-7" />
                const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                const isToday = dateStr === todayStr
                const dow = (firstDay + day - 1) % 7
                const isStart = dateStr === effStart
                const isEnd = dateStr === effEnd
                const isSelected = isStart || isEnd
                const isSingleDay = effStart === effEnd
                const inRange = !isSingleDay && effStart && effEnd && dateStr > effStart && dateStr < effEnd
                const isRangeStart = isStart && !isSingleDay
                const isRangeEnd = isEnd && !isSingleDay

                return (
                  <div key={day} className="relative h-7 flex items-center justify-center">
                    {(inRange || isRangeStart || isRangeEnd) && (
                      <div
                        className={`absolute inset-y-1 bg-orange-100
                                            ${inRange ? 'inset-x-0' : ''}
                                            ${isRangeStart ? 'left-1/2 right-0' : ''}
                                            ${isRangeEnd ? 'right-1/2 left-0' : ''}
                                        `}
                      />
                    )}
                    <button
                      onClick={() => handleDayClick(dateStr)}
                      onMouseEnter={() => selecting === 'end' && setHoverDate(dateStr)}
                      onMouseLeave={() => selecting === 'end' && setHoverDate(null)}
                      className={`relative z-10 h-7 w-7 flex items-center justify-center text-[11px] font-semibold rounded-full transition-colors
                                            ${
                                              isSelected
                                                ? 'bg-letusOrange text-white'
                                                : isToday
                                                  ? 'border border-letusOrange text-letusOrange'
                                                  : dow === 0
                                                    ? 'text-red-400 hover:bg-orange-50'
                                                    : dow === 6
                                                      ? 'text-blue-400 hover:bg-orange-50'
                                                      : 'text-gray-700 hover:bg-orange-50'
                                            }`}
                    >
                      {day}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 flex items-center justify-between px-3 py-1.5">
              <button
                onClick={() => {
                  onChange('', '')
                  setIsOpen(false)
                  setHoverDate(null)
                  setSelecting('start')
                }}
                className="text-[11px] text-gray-400 hover:text-gray-600 font-bold"
              >
                지우기
              </button>
              <div className="flex gap-1">
                {[
                  { label: '1주일', type: '1w' },
                  { label: '1개월', type: '1m' },
                  { label: '6개월', type: '6m' },
                ].map(({ label, type }) => (
                  <button
                    key={type}
                    onClick={() => handlePreset(type)}
                    className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-letusOrange hover:text-letusOrange font-bold transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  onChange(todayStr, todayStr)
                  setIsOpen(false)
                  setHoverDate(null)
                  setSelecting('start')
                }}
                className="text-[11px] text-letusOrange hover:opacity-70 font-bold"
              >
                오늘
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
