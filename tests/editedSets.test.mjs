import test from 'node:test'
import assert from 'node:assert/strict'
import { editedPerformedSets } from '../src/lib/editedSets.js'

const timedSets = [
  { reps: 8, weight: 60, durationSeconds: 30, restBeforeSeconds: null, startedAt: 1000, endedAt: 31000 },
  { reps: 6, weight: 62.5, durationSeconds: 28, restBeforeSeconds: 90, startedAt: 121000, endedAt: 149000 },
  { reps: 5, weight: 62.5, durationSeconds: 25, restBeforeSeconds: 90, startedAt: 239000, endedAt: 264000 },
]
const row = { id: 'a', performedSets: timedSets }
const initial = { sets: 3, reps: 6, weight: 61.7 } // setCount / avgReps / avgWeight로 만든 창의 처음 입력값

test('세 칸을 안 바꾸면 기존 세트를 그대로 둔다 (시각·세트마다 다른 횟수·무게 유지) — 이름이나 날짜만 고쳐도 마찬가지', () => {
  const saved = editedPerformedSets(row, { sets: 3, reps: 6, weight: 61.7 }, initial)
  assert.equal(saved, timedSets) // 같은 배열 그대로
  // 폼 값이 문자열이어도(입력칸) 같은 값이면 안 바뀐 것
  assert.equal(editedPerformedSets(row, { sets: '3', reps: '6', weight: '61.7' }, { sets: '3', reps: '6', weight: '61.7' }), timedSets)
})

test('횟수나 무게를 바꾸면 입력값으로 균일하게 채우되 같은 번째 세트의 시각·세트 시간·휴식은 이어받는다', () => {
  const saved = editedPerformedSets(row, { sets: 3, reps: 10, weight: 65 }, initial)
  assert.equal(saved.length, 3)
  assert.deepEqual(saved.map(s => [s.reps, s.weight]), [[10, 65], [10, 65], [10, 65]])
  assert.deepEqual(saved.map(s => s.startedAt), [1000, 121000, 239000])
  assert.deepEqual(saved.map(s => s.endedAt), [31000, 149000, 264000])
  assert.deepEqual(saved.map(s => s.durationSeconds), [30, 28, 25])
  assert.deepEqual(saved.map(s => s.restBeforeSeconds), [null, 90, 90])
})

test('세트 수를 늘리면 새 세트에는 시각이 없고, 줄이면 남은 세트만 이어받는다', () => {
  const more = editedPerformedSets(row, { sets: 4, reps: 6, weight: 61.7 }, initial)
  assert.equal(more.length, 4)
  assert.equal(more[3].startedAt, undefined)
  assert.equal(more[3].durationSeconds, null)
  assert.equal(more[0].startedAt, 1000)
  const fewer = editedPerformedSets(row, { sets: 2, reps: 6, weight: 61.7 }, initial)
  assert.deepEqual(fewer.map(s => s.startedAt), [1000, 121000])
})

test('시각이 없는 기록·새 기록은 예전처럼 균일하게 채운다(시각 키 없음)', () => {
  const manual = { id: 'm', performedSets: [{ reps: 5, weight: 10, durationSeconds: null, restBeforeSeconds: null }] }
  const saved = editedPerformedSets(manual, { sets: 3, reps: 8, weight: 20 }, { sets: 1, reps: 5, weight: 10 })
  assert.equal(saved.length, 3)
  assert.equal('startedAt' in saved[0], false)
  assert.deepEqual(saved[0], { reps: 8, weight: 20, durationSeconds: null, restBeforeSeconds: null })
  const created = editedPerformedSets(undefined, { sets: '', reps: '', weight: '' }, { sets: '', reps: '', weight: '' })
  assert.equal(created.length, 1) // 빈 값도 최소 1세트
  assert.equal(editedPerformedSets(null, { sets: 2, reps: 5, weight: 50 }, { sets: '', reps: '', weight: '' }).length, 2)
})

test('예정 기록(세트 없음)을 고치면 입력값으로 세트가 생긴다', () => {
  const planned = { id: 'p', performedSets: [] }
  const saved = editedPerformedSets(planned, { sets: 3, reps: 8, weight: 60 }, { sets: 3, reps: 8, weight: 60 })
  assert.equal(saved.length, 3) // 세트가 없어서 "안 바뀐 것"으로 보지 않는다(예전 동작 유지)
})
