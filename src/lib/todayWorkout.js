// "오늘 운동하기" 로직 — 웹앱 대시보드 카드(`components/web/TodayWorkoutCard`)가 쓴다. 서버 연결이 없는 순수 함수.
// PWA 메인 메뉴(`pages/mobile/MobileMenuScreen`)도 같은 규칙으로 동작한다(그쪽은 화면 파일 안에 같은 로직이 있다 — 규칙을 바꿀 때는 두 곳을 함께 본다).
//
//  · 오늘 상태: 아직 안 한(예정) 루틴 운동이 있으면 그 루틴으로 바로 시작, 없으면 즉석 운동을 등록하고 시작.
//    건너뜀(루틴 종료·운동 건너뛰기)은 "아직 할 운동"에 세지 않는다.
//  · 즉석 운동은 반복 요일이 없는 1회성 루틴("즉석 운동", 비활성)으로 만든다. 매주 반복할 루틴은 루틴 화면에서 따로 등록한다.
import { targetRepsOf } from './progression.js'
import { isPending, isSkipped } from './logStatus.js'

// 오늘의 운동 상태. kind: 'pending'(할 운동이 남음) | 'done'(오늘 한 운동이 있음) | 'ended'(루틴을 종료함) | 'none'(예정 없음)
export function todayWorkoutStatus(logs, routines, todayDate) {
  const todayLogs = logs.filter(l => l.date === todayDate)
  const pendingToday = todayLogs.find(l => l.routineId && isPending(l))
  const routine = pendingToday ? routines.find(r => r.id === pendingToday.routineId) : null
  const sessionLogs = pendingToday ? todayLogs.filter(l => l.routineId === pendingToday.routineId) : []
  const doneCount = sessionLogs.filter(l => l.isCompleted).length
  let kind
  let subtitle
  if (pendingToday) {
    kind = 'pending'
    subtitle = `${routine?.name || '오늘 루틴'} · ${doneCount}/${sessionLogs.length} 완료`
  } else if (todayLogs.some(l => l.isCompleted)) {
    kind = 'done'
    subtitle = '오늘 운동을 마쳤어요 · 추가 운동 시작'
  } else if (todayLogs.some(isSkipped)) {
    kind = 'ended'
    subtitle = '오늘 루틴을 종료했어요 · 추가 운동 시작'
  } else {
    kind = 'none'
    subtitle = '오늘 예정된 루틴이 없어요 · 바로 등록하고 시작'
  }
  return { kind, subtitle, routineId: pendingToday?.routineId ?? null, routineName: routine?.name ?? '', doneCount, totalCount: sessionLogs.length }
}

// 오늘 날짜로 그 루틴의 운동 기록(예정)을 만든다 — 기존 루틴 불러오기·즉석 등록 공통
export function buildTodayLogs(routineId, exerciseList, todayDate, defaultRestSeconds, newId = () => crypto.randomUUID()) {
  return exerciseList.map(ex => ({
    id: newId(),
    date: todayDate,
    exercise: ex.exercise,
    routineId,
    targetSets: ex.sets,
    targetReps: targetRepsOf(ex),
    targetWeight: ex.weight,
    restSeconds: ex.restSeconds ?? defaultRestSeconds,
    linkedToNext: !!ex.linkedToNext,
    performedSets: [],
    fatigue: null,
    isCompleted: false,
  }))
}

// 즉석 운동용 1회성 루틴
export function buildQuickRoutine(exerciseList, newId = () => crypto.randomUUID()) {
  return { id: newId(), name: '즉석 운동', isActive: false, repeatDays: [], exercises: exerciseList }
}
