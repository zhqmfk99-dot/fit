import assert from 'node:assert/strict'
import { todayWorkoutStatus, buildTodayLogs, buildQuickRoutine } from '../src/lib/todayWorkout.js'

const TODAY = '2026-11-05'
const routines = [{ id: 'r1', name: '가슴+등', exercises: [] }, { id: 'r2', name: '팔', exercises: [] }]
const L = (id, routineId, extra = {}) => ({ id, routineId, date: TODAY, exercise: `운동${id}`, isCompleted: false, ...extra })

// 오늘 기록이 없으면 예정 없음
{
  const s = todayWorkoutStatus([], routines, TODAY)
  assert.equal(s.kind, 'none')
  assert.equal(s.routineId, null)
  assert.match(s.subtitle, /예정된 루틴이 없어요/)
}
// 오늘 아직 안 한 루틴 운동이 있으면 그 루틴, 진행 현황 문구
{
  const logs = [L('a', 'r1', { isCompleted: true }), L('b', 'r1'), L('c', 'r1'), L('x', 'r2', { date: '2026-11-06' })]
  const s = todayWorkoutStatus(logs, routines, TODAY)
  assert.equal(s.kind, 'pending')
  assert.equal(s.routineId, 'r1')
  assert.equal(s.routineName, '가슴+등')
  assert.deepEqual([s.doneCount, s.totalCount], [1, 3])
  assert.equal(s.subtitle, '가슴+등 · 1/3 완료')
}
// 삭제된 루틴이어도 "오늘 루틴"으로 진행 가능
assert.equal(todayWorkoutStatus([L('a', 'gone')], routines, TODAY).subtitle, '오늘 루틴 · 0/1 완료')
// 건너뜀은 "아직 할 운동"이 아니다: 전부 건너뛰면 종료, 하나라도 완료했으면 마침
assert.equal(todayWorkoutStatus([L('a', 'r1', { skipped: true }), L('b', 'r1', { skipped: true })], routines, TODAY).kind, 'ended')
assert.match(todayWorkoutStatus([L('a', 'r1', { skipped: true })], routines, TODAY).subtitle, /오늘 루틴을 종료했어요/)
assert.equal(todayWorkoutStatus([L('a', 'r1', { isCompleted: true }), L('b', 'r1', { skipped: true })], routines, TODAY).kind, 'done')
// 루틴 없는 개별 기록은 "할 운동"으로 세지 않는다(루틴이 있어야 진행 화면으로 갈 수 있다)
assert.equal(todayWorkoutStatus([L('a', undefined)], routines, TODAY).kind, 'none')
// 다른 날 기록은 무시
assert.equal(todayWorkoutStatus([L('a', 'r1', { date: '2026-11-04' })], routines, TODAY).kind, 'none')
// 두 루틴이 남아 있으면 먼저 나온 루틴
assert.equal(todayWorkoutStatus([L('a', 'r2'), L('b', 'r1')], routines, TODAY).routineId, 'r2')

// 오늘 기록 만들기: 목표 횟수·무게·휴식(없으면 기본값)·수퍼세트, 맨몸의 보정된 목표 횟수
{
  let n = 0
  const logs = buildTodayLogs(
    'r1',
    [
      { exercise: '벤치프레스', sets: 3, reps: 8, weight: 60, restSeconds: 120, linkedToNext: true },
      { exercise: '푸시업', sets: 2, reps: 12, weight: 0, progressReps: 8 },
    ],
    TODAY,
    90,
    () => `id${n++}`,
  )
  assert.equal(logs.length, 2)
  assert.deepEqual(logs[0], { id: 'id0', date: TODAY, exercise: '벤치프레스', routineId: 'r1', targetSets: 3, targetReps: 8, targetWeight: 60, restSeconds: 120, linkedToNext: true, performedSets: [], fatigue: null, isCompleted: false })
  assert.equal(logs[1].restSeconds, 90) // 비어 있으면 설정의 기본 휴식
  assert.equal(logs[1].targetReps, 8) // 맨몸은 앱이 맞춘 목표(progressReps)
  assert.equal(logs[1].linkedToNext, false)
  assert.ok(logs.every(l => l.performedSets.length === 0 && !l.isCompleted))
}
// 즉석 운동 루틴: 반복 없는 1회성, 비활성
{
  const r = buildQuickRoutine([{ exercise: 'A' }], () => 'q1')
  assert.deepEqual(r, { id: 'q1', name: '즉석 운동', isActive: false, repeatDays: [], exercises: [{ exercise: 'A' }] })
}

console.log('OK: 오늘 운동하기 전부 통과')
