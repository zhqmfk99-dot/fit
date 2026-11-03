// 기록 화면 캘린더 칸의 운동 dot — 웹앱·PWA 공용 로직(UI 아님), 서버 연결이 없는 순수 함수.
//
// 예전에는 운동 하나에 dot 하나라서 루틴 하나(운동 7개)가 dot 7개로 보였다. 이제 **한 묶음이 dot 1개**다:
//   · 같은 날짜·같은 루틴(routineId)의 운동들 = 묶음 하나 = dot 1개
//   · 루틴에 속하지 않은 수동 운동은 각각 dot 1개
// 묶음 dot의 모양: 한 개라도 완료했으면 완료한 운동들의 **평균 피로도 색**(done), 하나도 안 했으면 예정이 있으면 빈 동그라미(pending),
// 전부 건너뜀이면 주황(skipped). 일부만 완료한 묶음은 완료 색으로 보이고 툴팁에 "3/7 완료"가 나온다.
import { isSkipped } from './logStatus.js'

const validFatigue = l => (Number(l.fatigue) > 0 ? Number(l.fatigue) : null)

// 완료한 기록들의 평균 피로도(1~5로 반올림). 피로도가 없으면 보통(3).
export function averageFatigue(doneLogs) {
  const values = doneLogs.map(validFatigue).filter(v => v != null)
  if (!values.length) return 3
  return Math.min(5, Math.max(1, Math.round(values.reduce((a, b) => a + b, 0) / values.length)))
}

// 묶음 하나(같은 루틴의 그날 기록들)의 상태
function groupDot(key, logs, name) {
  const done = logs.filter(l => l.isCompleted)
  const label = name || '루틴'
  if (done.length) {
    const fatigue = averageFatigue(done)
    return { key, kind: 'done', fatigue, count: logs.length, doneCount: done.length, title: `${label} · ${done.length}/${logs.length} 완료 · 평균 피로 ${fatigue}` }
  }
  if (logs.every(isSkipped)) return { key, kind: 'skipped', count: logs.length, doneCount: 0, title: `${label} · 건너뜀` }
  return { key, kind: 'pending', count: logs.length, doneCount: 0, title: `${label} · 예정 0/${logs.length}` }
}

// dayLogs: 그 날짜의 기록들(순서 유지) / routineNameOf(routineId): 루틴 이름(없으면 "루틴")
// 반환: [{ key, kind: 'done' | 'skipped' | 'pending', fatigue?, count, doneCount, title }] — 처음 나온 순서
export function buildDayDots(dayLogs, routineNameOf = () => '') {
  const dots = []
  const groups = new Map()
  for (const log of dayLogs) {
    if (!log.routineId) {
      dots.push({ log })
      continue
    }
    if (!groups.has(log.routineId)) {
      const g = { routineId: log.routineId, logs: [] }
      groups.set(log.routineId, g)
      dots.push({ group: g })
    }
    groups.get(log.routineId).logs.push(log)
  }
  return dots.map(d => {
    if (d.group) return groupDot(`r-${d.group.routineId}`, d.group.logs, routineNameOf(d.group.routineId))
    const l = d.log
    if (l.isCompleted) return { key: l.id, kind: 'done', fatigue: l.fatigue, count: 1, doneCount: 1, title: `${l.exercise} (피로 ${l.fatigue})` }
    if (isSkipped(l)) return { key: l.id, kind: 'skipped', count: 1, doneCount: 0, title: `${l.exercise} (건너뜀)` }
    return { key: l.id, kind: 'pending', count: 1, doneCount: 0, title: `${l.exercise} (예정)` }
  })
}
