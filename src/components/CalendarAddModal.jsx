import { useMemo, useState } from 'react'
import { CalendarPlus, Download, ExternalLink, X } from 'lucide-react'
import { useBackHandler } from '../context/BackNavigationContext.jsx'
import { buildRoutineEvent, googleCalendarUrl, buildIcs, icsFilename, downloadIcs, describeEvent } from '../lib/calendarExport.js'

const MINUTES = [30, 45, 60, 90]
const PREFS_KEY = 'fit-calendar-prefs'
const pad = n => String(n).padStart(2, '0')
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 마지막으로 고른 시간·길이를 이 기기에 기억한다(저장소를 못 쓰면 기본값)
const loadPrefs = () => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY))
    return { time: /^\d{2}:\d{2}$/.test(p?.time) ? p.time : '19:00', minutes: MINUTES.includes(p?.minutes) ? p.minutes : 60 }
  } catch {
    return { time: '19:00', minutes: 60 }
  }
}
const savePrefs = prefs => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* 기억하지 않는다 */
  }
}

// 루틴을 캘린더에 추가하는 창 (PWA용 화면): 시간·길이를 고르고 구글 캘린더 또는 .ics 파일(아이폰·삼성 등)로 추가한다.
export default function CalendarAddModal({ routine, onClose }) {
  useBackHandler(onClose) // 뒤로가기(제스처)로 이 창을 닫는다
  const initial = useMemo(loadPrefs, [])
  const [time, setTime] = useState(initial.time)
  const [minutes, setMinutes] = useState(initial.minutes)
  const [date, setDate] = useState(todayStr())
  const [message, setMessage] = useState('')

  const hasRepeat = routine.repeatDays?.length > 0
  const ev = useMemo(() => buildRoutineEvent(routine, { time, minutes, date }), [routine, time, minutes, date])

  const addGoogle = () => {
    if (!ev) return
    savePrefs({ time, minutes })
    window.open(googleCalendarUrl(ev), '_blank', 'noopener,noreferrer')
    setMessage('구글 캘린더 창을 열었어요. 저장을 눌러 주세요. 반복이 안 보이면 "파일로 받기"를 써 주세요.')
  }
  const addFile = () => {
    if (!ev) return
    savePrefs({ time, minutes })
    downloadIcs(icsFilename(routine.name), buildIcs(ev))
    setMessage('파일을 내려받았어요. 열어서 캘린더에 추가해 주세요. (아이폰·삼성·구글 캘린더 모두 가져올 수 있어요)')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[110] backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] overflow-hidden flex flex-col slide-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-m-body font-bold text-gray-800 flex items-center gap-1.5">
            <CalendarPlus className="w-4 h-4 text-letusBlue" />
            캘린더에 추가
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 bg-slate-50 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="text-m-body font-bold text-gray-800">{routine.name}</div>

          {!hasRepeat && (
            <div className="flex flex-col gap-1.5">
              <label className="text-m-body font-bold text-gray-700">날짜</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body bg-white focus:outline-none focus:border-letusBlue" />
              <span className="text-m-caption text-gray-400">반복 요일이 없는 루틴이라 하루짜리 일정으로 추가돼요.</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-m-body font-bold text-gray-700">시작 시간</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body bg-white focus:outline-none focus:border-letusBlue" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-m-body font-bold text-gray-700">운동 시간</label>
            <div className="flex flex-wrap gap-1.5">
              {MINUTES.map(m => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={`px-3 min-h-[32px] rounded-full text-m-body font-bold transition-colors ${minutes === m ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'}`}
                >
                  {m}분
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white border border-gray-100 px-3 py-2.5 text-m-body font-bold text-gray-700">
            {ev ? describeEvent(ev, routine) : <span className="text-red-500">{hasRepeat ? '시작 시간을 입력해 주세요.' : '날짜와 시작 시간을 입력해 주세요.'}</span>}
          </div>

          {message && <p className="text-m-caption font-bold text-letusBlue leading-relaxed">{message}</p>}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white space-y-2">
          <button
            type="button"
            onClick={addGoogle}
            disabled={!ev}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-letusBlue text-white text-m-body font-bold rounded-lg disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            구글 캘린더에 추가
          </button>
          <button
            type="button"
            onClick={addFile}
            disabled={!ev}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] border border-gray-300 text-gray-700 text-m-body font-bold rounded-lg active:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            파일로 받기 (아이폰·삼성 등)
          </button>
        </div>
      </div>
    </div>
  )
}
