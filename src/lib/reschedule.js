// 루틴 날짜 변경 — 웹앱·PWA 공용 로직(UI 아님), 서버 연결이 없는 순수 함수.
//
// 앱은 활성 루틴의 반복 요일마다 오늘부터 2주치 "예정" 기록을 미리 만들고(lib/scheduleGenerator.js), 앱을 열 때마다 "그 루틴에 그 날짜 기록이 하나도 없으면" 채운다.
// 예전에는 루틴 세션을 다른 날짜로 옮기면 원래 날짜가 텅 비어서, 다음에 앱을 열 때(자정이 지난 뒤 등) 원래 날짜에 같은 운동이 다시 생겼다.
// 그래서 옮긴 기록에 "이 날짜에서 옮겨 왔다"는 표시(movedFrom, 날짜 목록)를 남기고, 예정 기록 생성은 그 날짜를 건너뛴다.
// 다시 원래 날짜로 옮겨도 되고(그 날짜에 기록이 있으니 건너뜀), 여러 번 옮겨도 지나온 날짜가 모두 남는다. 기록을 지우면 표시도 같이 사라진다.

const MAX_MARKS = 20 // 한 기록에 남기는 "옮겨 온 날짜" 최대 개수(오래된 것부터 버림)

// 옮겨 온 날짜 목록에 oldDate를 더한다(중복 없이, 날짜순)
export function addMovedFrom(movedFrom, oldDate) {
  const list = Array.isArray(movedFrom) ? movedFrom : []
  if (!oldDate || list.includes(oldDate)) return list
  return [...list, oldDate].sort().slice(-MAX_MARKS)
}

// 같은 루틴·같은 날짜의 기록 전부를 newDate로 옮긴다. 옮긴 기록에는 비운 날짜를 남긴다.
export function rescheduleGroup(logs, routineId, oldDate, newDate) {
  if (!newDate || newDate === oldDate) return logs
  return logs.map(l => (l.routineId === routineId && l.date === oldDate ? { ...l, date: newDate, movedFrom: addMovedFrom(l.movedFrom, oldDate) } : l))
}

// 기록 하나를 수정해서 날짜가 바뀐 경우(기록 수정 창): 루틴에 속한 기록이면 비운 날짜를 남긴다.
export function withMovedMark(prev, saved) {
  if (!prev || !saved.routineId || prev.date === saved.date) return saved
  return { ...saved, movedFrom: addMovedFrom(saved.movedFrom ?? prev.movedFrom, prev.date) }
}

// 예정 기록을 만들 때: 이 루틴의 어떤 기록이 이 날짜에서 옮겨 갔다면 true(다시 만들지 않는다)
export const wasMovedAway = (logs, routineId, date) => logs.some(l => l.routineId === routineId && Array.isArray(l.movedFrom) && l.movedFrom.includes(date))
