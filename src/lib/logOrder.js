// 같은 루틴·같은 날짜의 운동 기록을 루틴에 등록한 운동 순서대로 정렬한다 — 웹앱·PWA 공용 로직(UI 아님), 서버 연결이 없는 순수 함수.
//
// 왜 필요한가: 예정 기록은 루틴 순서대로 한 번에(같은 시각에) 저장되는데, 서버에서 다시 불러올 때
// 같은 시각의 기록은 순서가 보장되지 않아(created_at이 같음) 기록 화면·운동 진행 순서가 루틴과 다르게 보이는 일이 있었다.
// 그래서 불러온 뒤 같은 루틴·같은 날짜 묶음 안에서만 루틴의 운동 순서로 다시 정렬한다(묶음 밖 기록의 자리는 그대로).
//   · 루틴에 없는 이름의 기록(운동 진행 중 "오늘만 바꾸기"로 이름이 바뀐 것 등)은 묶음 맨 뒤에 원래 순서대로 둔다.
//   · 삭제된 루틴의 기록·루틴 없는 개별 기록은 건드리지 않는다.
//   · 같은 이름이 루틴에 여러 번 있으면 먼저 나온 자리를 쓴다. 정렬은 안정적이라 같은 자리끼리는 원래 순서가 유지된다.

const NOT_IN_ROUTINE = 1e9

export function orderLogsByRoutine(logs, routines) {
  const routineById = new Map((routines ?? []).map(r => [r.id, r]))
  const groups = new Map() // `${routineId}|${date}` → [{ index, log }]
  logs.forEach((log, index) => {
    if (!log.routineId || !routineById.has(log.routineId)) return
    const key = `${log.routineId}|${log.date}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ index, log })
  })

  const out = logs.slice()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const order = new Map()
    ;(routineById.get(group[0].log.routineId).exercises ?? []).forEach((e, i) => {
      if (!order.has(e.exercise)) order.set(e.exercise, i)
    })
    const rank = log => order.get(log.exercise) ?? NOT_IN_ROUTINE
    const sorted = [...group].sort((a, b) => rank(a.log) - rank(b.log) || a.index - b.index)
    group.forEach((slot, k) => {
      out[slot.index] = sorted[k].log // 이 묶음이 차지하던 자리(배열 위치)에 정렬된 기록을 차례로 채운다
    })
  }
  return out
}
