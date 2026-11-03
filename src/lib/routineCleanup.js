// 루틴을 지울 때 남는 "예정 기록" 정리 — 웹앱·PWA 공용 로직(UI 아님), 서버 연결이 없는 순수 함수.
//
// 앱은 활성 루틴의 반복 요일마다 오늘부터 2주치 "예정" 기록(아직 안 한 운동)을 미리 만들어 둔다(lib/scheduleGenerator.js).
// 예전에는 루틴을 지워도 이 예정 기록은 그대로 남아서, 기록 화면에 이름 없는 "루틴" 묶음으로 계속 보이고 지울 방법도 번거로웠다.
//   · 루틴을 지우면 그 루틴의 앞으로 예정된(오늘 이후, 아직 안 한) 기록도 함께 지운다. 이미 완료한 기록은 그대로 둔다.
//   · 이미 남아 있는 "삭제된 루틴"의 예정 기록은 기록 화면에서 날짜별 묶음 단위로 한 번에 지운다(완료한 기록은 그대로).
// "아직 안 한" = isCompleted가 아닌 기록(예정·건너뜀 모두).

const notDone = l => !l.isCompleted

// 루틴 하나의 앞으로 예정된 기록(오늘 포함, 아직 안 한 것)
export const upcomingPendingLogs = (logs, routineId, today) => logs.filter(l => l.routineId === routineId && notDone(l) && l.date >= today)

// 루틴을 지울 때: 그 루틴의 오늘 이후 아직 안 한 기록을 뺀 기록 목록
export const withoutUpcomingPending = (logs, routineId, today) => logs.filter(l => !(l.routineId === routineId && notDone(l) && l.date >= today))

// 같은 루틴·같은 날짜 묶음에서 아직 안 한 기록(예정·건너뜀)
export const pendingInGroup = (logs, routineId, date) => logs.filter(l => l.routineId === routineId && l.date === date && notDone(l))

// 묶음 하나를 지울 때: 그 묶음의 아직 안 한 기록을 뺀 기록 목록(완료한 기록은 남는다)
export const withoutPendingInGroup = (logs, routineId, date) => logs.filter(l => !(l.routineId === routineId && l.date === date && notDone(l)))
