import test from 'node:test'
import assert from 'node:assert/strict'
import { addMovedFrom, rescheduleGroup, withMovedMark, wasMovedAway } from '../src/lib/reschedule.js'
import { generateScheduledLogs } from '../src/lib/scheduleGenerator.js'

const pad = n => String(n).padStart(2, '0')
const dayStr = offset => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const ALL_DAYS = ['일', '월', '화', '수', '목', '금', '토'] // 어느 날짜든 반복 요일이 되도록
const routine = { id: 'r1', isActive: true, repeatDays: ALL_DAYS, exercises: [{ exercise: '벤치프레스', sets: 3, reps: 8, weight: 60 }] }
const log = (id, date, extra = {}) => ({ id, date, exercise: '벤치프레스', routineId: 'r1', isCompleted: false, performedSets: [], ...extra })

test('옮겨 온 날짜 목록: 중복 없이 날짜순, 잘못된 값은 안전하게', () => {
  assert.deepEqual(addMovedFrom(undefined, '2026-11-05'), ['2026-11-05'])
  assert.deepEqual(addMovedFrom(['2026-11-09'], '2026-11-05'), ['2026-11-05', '2026-11-09'])
  assert.deepEqual(addMovedFrom(['2026-11-05'], '2026-11-05'), ['2026-11-05'])
  assert.deepEqual(addMovedFrom('이상한 값', '2026-11-05'), ['2026-11-05'])
  assert.deepEqual(addMovedFrom([], ''), [])
  const many = Array.from({ length: 25 }, (_, i) => `2026-01-${pad(i + 1)}`)
  assert.equal(many.reduce((acc, d) => addMovedFrom(acc, d), []).length, 20) // 오래된 것부터 버린다
})

test('세션 옮기기: 같은 루틴·같은 날짜만 옮기고 원래 날짜를 남긴다', () => {
  const logs = [log('a', '2026-11-05'), log('b', '2026-11-05'), log('c', '2026-11-06'), log('d', '2026-11-05', { routineId: 'r2' })]
  const next = rescheduleGroup(logs, 'r1', '2026-11-05', '2026-11-08')
  assert.deepEqual(next.map(l => l.date), ['2026-11-08', '2026-11-08', '2026-11-06', '2026-11-05'])
  assert.deepEqual(next[0].movedFrom, ['2026-11-05'])
  assert.equal(next[2].movedFrom, undefined) // 안 옮긴 기록은 그대로
  assert.equal(next[3].movedFrom, undefined) // 다른 루틴도 그대로
  assert.equal(rescheduleGroup(logs, 'r1', '2026-11-05', '2026-11-05'), logs) // 같은 날짜면 변화 없음
  assert.equal(rescheduleGroup(logs, 'r1', '2026-11-05', ''), logs)
})

test('두 번 옮겨도 지나온 날짜가 모두 남는다', () => {
  let logs = [log('a', '2026-11-05')]
  logs = rescheduleGroup(logs, 'r1', '2026-11-05', '2026-11-08')
  logs = rescheduleGroup(logs, 'r1', '2026-11-08', '2026-11-10')
  assert.equal(logs[0].date, '2026-11-10')
  assert.deepEqual(logs[0].movedFrom, ['2026-11-05', '2026-11-08'])
})

test('기록 수정 창에서 날짜를 바꾼 경우: 루틴 기록만 표시를 남긴다', () => {
  const prev = log('a', '2026-11-05')
  assert.deepEqual(withMovedMark(prev, { ...prev, date: '2026-11-07' }).movedFrom, ['2026-11-05'])
  const same = { ...prev, exercise: '인클라인' }
  assert.equal(withMovedMark(prev, same), same) // 날짜가 안 바뀌면 그대로
  const manual = { id: 'm', date: '2026-11-05', exercise: '푸시업' } // 루틴에 속하지 않은 기록
  const movedManual = { ...manual, date: '2026-11-06' }
  assert.equal(withMovedMark(manual, movedManual), movedManual)
})

test('예정 기록 생성: 날짜를 옮긴 원래 날짜는 다시 만들지 않는다 (자정 뒤 앱을 다시 열어도)', () => {
  const today = dayStr(0)
  const later = dayStr(3)
  // 오늘 예정이던 세션을 3일 뒤로 옮긴 상태
  const logs = rescheduleGroup([log('a', today)], 'r1', today, later)
  const made = generateScheduledLogs([routine], logs)
  assert.equal(made.some(l => l.date === today), false, '원래 날짜에 같은 운동이 다시 생기면 안 됨')
  assert.equal(made.some(l => l.date === later), false, '옮겨 간 날짜에는 이미 기록이 있어 만들지 않음')
  assert.ok(made.some(l => l.date === dayStr(1)), '다른 반복 날짜는 그대로 만들어진다')
})

test('예전 기록(표시 없음)은 옛 동작 그대로 — 원래 날짜가 비면 다시 채운다', () => {
  const today = dayStr(0)
  const legacy = [log('a', dayStr(3))] // 오늘에서 옮겨 간 기록이지만 표시가 없다
  const made = generateScheduledLogs([routine], legacy)
  assert.equal(made.some(l => l.date === today), true)
})

test('옮겼다가 원래 날짜로 되돌리면 그 날짜에 기록이 있으므로 중복 생성 없음', () => {
  const today = dayStr(0)
  let logs = [log('a', today)]
  logs = rescheduleGroup(logs, 'r1', today, dayStr(3))
  logs = rescheduleGroup(logs, 'r1', dayStr(3), today)
  assert.equal(logs[0].date, today)
  const made = generateScheduledLogs([routine], logs)
  assert.equal(made.filter(l => l.date === today).length, 0)
  assert.equal(wasMovedAway(logs, 'r1', dayStr(3)), true) // 3일 뒤도 비웠으니 다시 만들지 않는다
  assert.equal(made.some(l => l.date === dayStr(3)), false)
})

test('다른 루틴의 옮긴 표시는 영향이 없다', () => {
  const today = dayStr(0)
  const logs = [log('a', dayStr(3), { routineId: 'r2', movedFrom: [today] })]
  assert.equal(wasMovedAway(logs, 'r1', today), false)
  assert.equal(generateScheduledLogs([routine], logs).some(l => l.date === today), true)
})
