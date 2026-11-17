import test from 'node:test'
import assert from 'node:assert/strict'
import { missingRoutineExercises, restoreMissingLogs } from '../src/lib/restoreMissing.js'
import { rescheduleGroup } from '../src/lib/reschedule.js'
import { generateScheduledLogs } from '../src/lib/scheduleGenerator.js'

const ex = (exercise, extra = {}) => ({ exercise, sets: 3, reps: 8, weight: 20, restSeconds: 90, ...extra })
const routine = { id: 'r1', name: '등+어깨', isActive: true, repeatDays: ['일', '월', '화', '수', '목', '금', '토'], exercises: [ex('랫 풀다운'), ex('덤벨 로우', { weight: 24 }), ex('시티드 로우'), ex('페이스 풀')] }
const log = (exercise, date = '2026-11-17', extra = {}) => ({ id: `id-${exercise}-${date}`, date, exercise, routineId: 'r1', isCompleted: false, performedSets: [], ...extra })
let seq = 0
const newId = () => `new-${++seq}`
const names = logs => logs.filter(l => l.routineId === 'r1' && l.date === '2026-11-17').map(l => l.exercise)

test('빠진 운동 찾기: 루틴 순서대로', () => {
  const group = [log('랫 풀다운'), log('시티드 로우'), log('페이스 풀')] // 덤벨 로우가 지워짐
  assert.deepEqual(missingRoutineExercises(routine, group).map(e => e.exercise), ['덤벨 로우'])
  assert.deepEqual(missingRoutineExercises(routine, []).map(e => e.exercise), ['랫 풀다운', '덤벨 로우', '시티드 로우', '페이스 풀'])
  assert.deepEqual(missingRoutineExercises(routine, routine.exercises.map(e => log(e.exercise))), [])
  assert.deepEqual(missingRoutineExercises(null, []), [])
})

test('이미 한 기록·건너뜀 기록은 "있는" 것으로 센다', () => {
  const group = [log('랫 풀다운', undefined, { isCompleted: true, performedSets: [{ reps: 8, weight: 40 }] }), log('덤벨 로우', undefined, { skipped: true }), log('시티드 로우'), log('페이스 풀')]
  assert.deepEqual(missingRoutineExercises(routine, group), [])
})

test('루틴에 같은 운동이 두 번 있으면 두 번 있어야 있는 것', () => {
  const twice = { ...routine, exercises: [ex('스쿼트'), ex('벤치프레스'), ex('스쿼트', { weight: 60 })] }
  assert.deepEqual(missingRoutineExercises(twice, [log('스쿼트'), log('벤치프레스')]).map(e => [e.exercise, e.weight]), [['스쿼트', 60]])
})

test('다시 채우기: 빠진 운동만 예정으로 만들고 루틴 순서 자리에 끼운다 (목표는 루틴 값)', () => {
  const logs = [log('랫 풀다운', undefined, { isCompleted: true, performedSets: [{ reps: 8, weight: 40 }] }), log('시티드 로우'), log('페이스 풀')]
  const next = restoreMissingLogs(logs, [routine], routine, '2026-11-17', 90, newId)
  assert.deepEqual(names(next), ['랫 풀다운', '덤벨 로우', '시티드 로우', '페이스 풀'])
  const restored = next.find(l => l.exercise === '덤벨 로우')
  assert.equal(restored.isCompleted, false)
  assert.deepEqual([restored.routineId, restored.date, restored.targetSets, restored.targetReps, restored.targetWeight, restored.restSeconds], ['r1', '2026-11-17', 3, 8, 24, 90])
  assert.equal(next.find(l => l.exercise === '랫 풀다운').isCompleted, true) // 이미 한 기록은 그대로
  assert.equal(next.length, logs.length + 1)
})

test('더할 게 없으면 같은 배열을 돌려준다', () => {
  const logs = routine.exercises.map(e => log(e.exercise))
  assert.equal(restoreMissingLogs(logs, [routine], routine, '2026-11-17', 90, newId), logs)
  assert.equal(restoreMissingLogs(logs, [routine], null, '2026-11-17', 90, newId), logs)
})

test('다른 날짜·다른 루틴의 기록은 건드리지 않고 그 날짜 묶음만 본다', () => {
  const other = { id: 'r2', name: '하체', isActive: true, repeatDays: [], exercises: [ex('스쿼트')] }
  const logs = [log('랫 풀다운'), log('덤벨 로우', '2026-11-18'), log('스쿼트', '2026-11-17', { routineId: 'r2' })]
  const next = restoreMissingLogs(logs, [routine, other], routine, '2026-11-17', 90, newId)
  assert.equal(next.filter(l => l.routineId === 'r1' && l.date === '2026-11-17').length, 4) // 이 날 묶음은 4개가 됨(덤벨 로우·시티드 로우·페이스 풀 추가)
  assert.equal(next.filter(l => l.routineId === 'r1' && l.date === '2026-11-18').length, 1) // 다음 날은 그대로
  assert.equal(next.filter(l => l.routineId === 'r2').length, 1)
})

test('날짜를 바꾼 묶음: 옮겨 간 날짜의 묶음을 채우고, 원래 날짜 표시를 새 기록에도 이어 준다', () => {
  // 오늘(11-17) 세션을 11-19로 옮긴 뒤, 덤벨 로우만 지운 상태
  let logs = routine.exercises.map(e => log(e.exercise))
  logs = rescheduleGroup(logs, 'r1', '2026-11-17', '2026-11-19')
  logs = logs.filter(l => l.exercise !== '덤벨 로우')
  const next = restoreMissingLogs(logs, [routine], routine, '2026-11-19', 90, newId)
  const group = next.filter(l => l.date === '2026-11-19')
  assert.deepEqual(group.map(l => l.exercise), ['랫 풀다운', '덤벨 로우', '시티드 로우', '페이스 풀'])
  assert.deepEqual(group.find(l => l.exercise === '덤벨 로우').movedFrom, ['2026-11-17']) // 새 기록에도 표시가 이어진다
  assert.equal(next.some(l => l.date === '2026-11-17'), false) // 원래 날짜에는 아무것도 생기지 않는다
  // 앱을 다시 열어도(예정 기록 생성) 원래 날짜(11-17)는 다시 채워지지 않는다
  const generated = generateScheduledLogs([routine], next)
  assert.equal(generated.some(l => l.date === '2026-11-17'), false)
})

test('옛 동작: 한 날짜 묶음에서 운동을 지워도 예정 기록 생성은 채우지 않는다(그래서 이 기능이 필요하다)', () => {
  const today = (() => {
    const d = new Date()
    const p = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })()
  const logs = routine.exercises.filter(e => e.exercise !== '덤벨 로우').map(e => log(e.exercise, today))
  assert.equal(generateScheduledLogs([routine], logs).some(l => l.date === today), false)
  const restored = restoreMissingLogs(logs, [routine], routine, today, 90, newId)
  assert.ok(restored.some(l => l.exercise === '덤벨 로우' && l.date === today))
})
