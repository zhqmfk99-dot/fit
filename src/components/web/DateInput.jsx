import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const pad = n => String(n).padStart(2, '0')

export default function DateInput({ value, onChange, fullWidth = false, disabled = false, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
  const containerRef = useRef(null)
  const popupRef = useRef(null)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const [viewYear, setViewYear] = useState(() => (value ? parseInt(value.slice(0, 4)) : today.getFullYear()))
  const [viewMonth, setViewMonth] = useState(() => (value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth()))

  const handleOpen = () => {
    if (disabled) return
    if (value) {
      setViewYear(parseInt(value.slice(0, 4)))
      setViewMonth(parseInt(value.slice(5, 7)) - 1)
    }
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const popupW = 224
      const popupH = 260
      const left = rect.left + rect.width / 2 - popupW / 2
      const spaceBelow = window.innerHeight - rect.bottom - 4
      const top = spaceBelow >= popupH ? rect.bottom + 4 : rect.top - popupH - 4
      setPopupPos({
        top: Math.max(4, top),
        left: Math.max(4, Math.min(left, window.innerWidth - popupW - 4)),
      })
    }
    setIsOpen(o => !o)
  }

  useEffect(() => {
    if (!isOpen) return
    const onDown = e => {
      if (containerRef.current?.contains(e.target)) return
      if (popupRef.current?.contains(e.target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen])

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

  const widthClass = fullWidth ? 'w-full' : 'w-[110px]'
  const inputBase = disabled
    ? `border border-gray-100 rounded-[3px] text-ui-body px-2.5 h-[30px] ${widthClass} bg-gray-50 text-gray-400 cursor-not-allowed`
    : `border border-gray-200 rounded-[3px] text-ui-body px-2.5 h-[30px] ${widthClass} focus:outline-none focus:border-letusOrange cursor-pointer text-gray-700`

  return (
    <div ref={containerRef} className={fullWidth ? 'block w-full' : 'inline-block'}>
      <input
        type="text"
        readOnly
        disabled={disabled}
        value={value || ''}
        placeholder="날짜 선택"
        onClick={handleOpen}
        className={`${inputBase} ${className}`}
      />
      {!disabled &&
        isOpen &&
        createPortal(
          <div
            ref={popupRef}
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left }}
            className="z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl w-[224px] select-none overflow-hidden"
          >
            <div className="bg-letusOrange px-3 py-2 flex items-center justify-between">
              <button onClick={prevMonth} className="text-white text-ui-title font-bold w-6 text-center hover:opacity-70 leading-none">
                ‹
              </button>
              <div className="flex items-center gap-1">
                <select
                  value={viewYear}
                  onChange={e => setViewYear(Number(e.target.value))}
                  className="bg-transparent text-white text-ui-caption font-bold focus:outline-none cursor-pointer"
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
                  className="bg-transparent text-white text-ui-caption font-bold focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i).map(m => (
                    <option key={m} value={m} className="text-gray-800 bg-white">
                      {m + 1}월
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={nextMonth} className="text-white text-ui-title font-bold w-6 text-center hover:opacity-70 leading-none">
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 px-2 pt-2">
              {DAY_NAMES.map((d, i) => (
                <div key={d} className={`text-center text-ui-caption font-bold pb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e${idx}`} className="h-7" />
                const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                const isSelected = dateStr === value
                const isToday = dateStr === todayStr
                const dow = (firstDay + day - 1) % 7
                return (
                  <button
                    key={day}
                    onClick={() => {
                      onChange(dateStr)
                      setIsOpen(false)
                    }}
                    className={`h-7 w-full flex items-center justify-center text-ui-caption font-semibold rounded-full transition-colors
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
                )
              })}
            </div>
            <div className="border-t border-gray-100 flex justify-between px-3 py-1.5">
              <button
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                className="text-ui-caption text-gray-400 hover:text-gray-600 font-bold"
              >
                지우기
              </button>
              <button
                onClick={() => {
                  onChange(todayStr)
                  setIsOpen(false)
                }}
                className="text-ui-caption text-letusOrange hover:opacity-70 font-bold"
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
