// 루틴을 캘린더에 추가 — 웹앱·PWA 공용 로직(UI 아님).
//   · 구글 캘린더: 미리 채워진 "새 일정" 화면을 새 창으로 연다(로그인·키 불필요, 저장은 사용자가 누름).
//     text·dates·details·ctz는 널리 쓰이는 형식이지만, 반복(recur)은 공식 문서에서 확인하지 못했다 → 반복이 안 보이면 .ics 파일을 쓴다.
//   · .ics 파일: 표준(RFC 5545)이라 구글·애플(아이폰)·삼성 등 대부분의 캘린더가 가져온다. 반복(RRULE)·알림(VALARM)을 담는다.
//   앱에는 운동 시간대가 없어서, 캘린더에 넣는 순간 사용자가 시간·길이를 고른다.

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_CODE = { 일: 'SU', 월: 'MO', 화: 'TU', 수: 'WE', 목: 'TH', 금: 'FR', 토: 'SA' }
const WEEK_ORDER = ['월', '화', '수', '목', '금', '토', '일']

const pad = n => String(n).padStart(2, '0')
const fmtLocal = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const fmtUtc = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

// "HH:MM" → { h, m } (형식이 틀리면 null)
function parseTime(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '')
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? { h, m: mi } : null
}

// 반복 요일 중 지금 이후로 가장 가까운 날짜·시각. 오늘이 반복 요일이어도 정한 시각이 이미 지났으면 다음 반복일로 넘긴다.
export function nextOccurrence(repeatDays, time, now = new Date()) {
  const t = parseTime(time)
  if (!t || !repeatDays?.length) return null
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, t.h, t.m, 0)
    if (repeatDays.includes(DOW_LABELS[d.getDay()]) && d > now) return d
  }
  return null
}

const exerciseLine = ex => `${ex.exercise} ${ex.sets}세트 × ${ex.reps}회${Number(ex.weight) > 0 ? ` × ${ex.weight}kg` : ''}`

// 일정 정보 만들기. options: { time: "19:00", minutes: 60, date: "2026-10-30"(반복 요일이 없는 루틴일 때만 씀) }
// 시작 시각을 정할 수 없으면(시간 형식 오류·날짜 없음) null.
export function buildRoutineEvent(routine, { time, minutes = 60, date } = {}, now = new Date()) {
  let start = null
  if (routine.repeatDays?.length) {
    start = nextOccurrence(routine.repeatDays, time, now)
  } else {
    const t = parseTime(time)
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '')
    if (t && dm) start = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), t.h, t.m, 0)
  }
  if (!start || Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + Math.max(5, Number(minutes) || 60) * 60000)

  const byDay = WEEK_ORDER.filter(d => routine.repeatDays?.includes(d)).map(d => DAY_CODE[d])
  const lines = (routine.exercises || []).map(exerciseLine)
  return {
    title: `${routine.name} (운동)`,
    description: `${lines.join('\n')}${lines.length ? '\n\n' : ''}TRAINING 앱에서 추가한 일정`,
    start,
    end,
    recurrence: byDay.length ? `FREQ=WEEKLY;BYDAY=${byDay.join(',')}` : null,
  }
}

export function googleCalendarUrl(ev) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    details: ev.description,
    dates: `${fmtLocal(ev.start)}/${fmtLocal(ev.end)}`,
  })
  try {
    params.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    /* 시간대를 못 읽으면 구글이 보는 사람의 시간대를 쓴다 */
  }
  if (ev.recurrence) params.set('recur', `RRULE:${ev.recurrence}`)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// .ics 텍스트 값 이스케이프: 역슬래시·세미콜론·쉼표·줄바꿈
const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// 한 줄이 75옥텟을 넘으면 접는다(다음 줄은 공백으로 시작). 한글은 3옥텟이라 글자 단위로 바이트를 센다.
function fold(line) {
  const enc = new TextEncoder()
  const out = []
  let cur = ''
  let bytes = 0
  const limit = () => (out.length === 0 ? 75 : 74)
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > limit()) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n')
}

// 시간대 정의 없이 "떠 있는 현지 시각"으로 적는다 — 가져오는 캘린더의 시간대로 해석된다.
export function buildIcs(ev, now = new Date()) {
  const uid = `${globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${Math.random().toString(16).slice(2)}`}@fit-training`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TRAINING//fit//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(now)}`,
    `DTSTART:${fmtLocal(ev.start)}`,
    `DTEND:${fmtLocal(ev.end)}`,
    ...(ev.recurrence ? [`RRULE:${ev.recurrence}`] : []),
    `SUMMARY:${icsText(ev.title)}`,
    `DESCRIPTION:${icsText(ev.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT30M',
    `DESCRIPTION:${icsText(ev.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export const icsFilename = name => `${String(name).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || '루틴'}.ics`

export function downloadIcs(filename, text) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 미리보기 문구: "매주 월·수 19:00~20:00 · 첫 일정 10/28(화)"
export function describeEvent(ev, routine) {
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const first = `${ev.start.getMonth() + 1}/${ev.start.getDate()}(${DOW_LABELS[ev.start.getDay()]})`
  const days = WEEK_ORDER.filter(d => routine.repeatDays?.includes(d)).join('·')
  return ev.recurrence ? `매주 ${days} ${hm(ev.start)}~${hm(ev.end)} · 첫 일정 ${first}` : `${first} ${hm(ev.start)}~${hm(ev.end)} (한 번)`
}
