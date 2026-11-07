import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLogsCsv, sortLogsForExport } from '../src/lib/exportData.js'

const log = (id, date, exercise, sets, extra = {}) => ({ id, date, exercise, isCompleted: true, performedSets: sets, ...extra })
const set = (startedAt, reps = 8) => ({ reps, weight: 50, startedAt, endedAt: startedAt == null ? undefined : startedAt + 30000 })
const names = logs => logs.map(l => l.exercise)

test('같은 날은 실제로 시작한 시각 순 (id 순이 아니다)', () => {
  // id를 일부러 시간 순서와 반대로 둔다
  const logs = [log('z', '2026-11-05', '벤치프레스', [set(3000)]), log('m', '2026-11-05', '인클라인', [set(2000)]), log('a', '2026-11-05', '푸시다운', [set(1000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['푸시다운', '인클라인', '벤치프레스'])
})

test('날짜가 먼저, 그다음 날 안의 순서', () => {
  const logs = [log('1', '2026-11-06', 'B', [set(500)]), log('2', '2026-11-05', 'A2', [set(2000)]), log('3', '2026-11-05', 'A1', [set(1000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['A1', 'A2', 'B'])
})

test('수퍼세트는 각 운동의 첫 세트 시작 순', () => {
  const logs = [log('b', '2026-11-05', '케이블 푸시다운', [set(1100), set(1300)]), log('a', '2026-11-05', '덤벨 로우', [set(1000), set(1200)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['덤벨 로우', '케이블 푸시다운'])
})

test('시각이 없는 기록은 가진 순서를 지키고 시각 있는 기록 뒤에 둔다', () => {
  const logs = [log('x', '2026-11-05', '직접입력2', [{ reps: 5, weight: 10 }]), log('y', '2026-11-05', '진행1', [set(1000)]), log('w', '2026-11-05', '직접입력1', [{ reps: 5, weight: 10 }])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['진행1', '직접입력2', '직접입력1'])
})

test('시각이 전혀 없으면 배열 순서(루틴 순서) 그대로 — id 순으로 섞지 않는다', () => {
  const logs = [log('z', '2026-11-05', '첫째', [{ reps: 5 }]), log('a', '2026-11-05', '둘째', [{ reps: 5 }]), log('m', '2026-11-05', '셋째', [{ reps: 5 }])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['첫째', '둘째', '셋째'])
})

test('시작 시각이 같으면 배열 순서 (안정 정렬)', () => {
  const logs = [log('b', '2026-11-05', '먼저', [set(1000)]), log('a', '2026-11-05', '나중', [set(1000)])]
  assert.deepEqual(names(sortLogsForExport(logs)), ['먼저', '나중'])
})

test('원본 배열은 바꾸지 않는다', () => {
  const logs = [log('b', '2026-11-05', 'B', [set(2000)]), log('a', '2026-11-05', 'A', [set(1000)])]
  const before = names(logs)
  sortLogsForExport(logs)
  assert.deepEqual(names(logs), before)
})

test('CSV 줄 순서: 미완료는 빠지고 운동한 순서대로 세트가 나온다', () => {
  const logs = [
    log('z', '2026-11-05', '벤치프레스', [set(3000, 8), set(3100, 7)]),
    log('q', '2026-11-05', '미완료', [set(500)], { isCompleted: false }),
    log('a', '2026-11-05', '스쿼트', [set(1000, 5)]),
  ]
  const { csv, count } = buildLogsCsv(logs, [])
  const lines = csv.replace('﻿', '').trim().split('\r\n').slice(1)
  assert.equal(count, 3)
  assert.deepEqual(lines.map(l => l.split(',')[2]), ['스쿼트', '벤치프레스', '벤치프레스'])
})
