// 신체 측정 기록 알림 — 대시보드 "내 목표" 카드(웹앱·PWA 공용 로직, UI 아님). 서버 연결이 없는 순수 함수.
//
// 마지막 신체 기록 날짜로부터 14일이 지나면(마지막 기록일 + 14일 이후) 다시 측정해서 기록하라고 알려 준다.
// 신체 기록이 하나도 없어도 알린다. 알림만 띄우고 푸시·자동 입력은 없다. 값을 저장하면(기록이 생기면) 사라진다.
// ※ 14일은 요청으로 정한 값이다(체중계 하루 오차를 줄이려고 추세를 볼 때 2주 간격이 쓸 만하다는 정도의 근거).

export const BODY_CHECK_INTERVAL_DAYS = 14

const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayNumber = s => Math.round(new Date(`${s}T00:00:00`).getTime() / 86400000) // 날짜 문자열 → 일 단위 번호(시간대·서머타임 오차는 반올림으로 흡수)

// 알릴 때: { noRecord, lastDate, daysSince, dueDate } / 아직 때가 아니면 null
//   noRecord: 신체 기록이 하나도 없음(lastDate·daysSince·dueDate는 null)
//   lastDate: 마지막 신체 기록 날짜(YYYY-MM-DD) / daysSince: 마지막 기록일부터 오늘까지 지난 일수 / dueDate: 마지막 기록일 + 14일
export function bodyCheckReminder(bodyRecords, today = new Date(), intervalDays = BODY_CHECK_INTERVAL_DAYS) {
  const dates = (bodyRecords ?? []).map(r => r?.date).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (!dates.length) return { noRecord: true, lastDate: null, daysSince: null, dueDate: null }
  const lastDate = dates.reduce((a, b) => (a >= b ? a : b))
  const daysSince = dayNumber(dateStr(today)) - dayNumber(lastDate)
  if (daysSince < intervalDays) return null // 미래 날짜로 기록한 경우(음수)도 여기로 온다
  const due = new Date(`${lastDate}T00:00:00`)
  due.setDate(due.getDate() + intervalDays)
  return { noRecord: false, lastDate, daysSince, dueDate: dateStr(due) }
}

const md = s => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

// 화면에 보여 줄 문장
export function describeBodyCheckReminder(r) {
  if (!r) return ''
  if (r.noRecord) return '아직 신체 기록이 없어요. 몸무게·체지방률을 측정해서 기록해 주세요.'
  return `마지막 신체 기록이 ${md(r.lastDate)}(${r.daysSince}일 전)이에요. 2주가 지났으니 다시 측정해서 기록해 주세요.`
}
