import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizePoints, eventLabel, workoutDaysKey, POINT_WORKOUT_DAY, POINT_WEEKLY_GOAL } from '../src/lib/points.js'

// 2026-11-05(목) 기준, 이번 주 월요일은 2026-11-02
const TODAY = '2026-11-05'
const ev = (kind, ref, points, created_at) => ({ kind, ref, points, created_at })

test('규칙 상수는 서버(points.sql)와 같다', () => {
  assert.equal(POINT_WORKOUT_DAY, 10)
  assert.equal(POINT_WEEKLY_GOAL, 30)
})

test('요약: 잔액·번 포인트·쓴 포인트·이번 주', () => {
  const events = [
    ev('workout_day', '2026-10-28', 10, '2026-10-28T10:00:00Z'), // 지난주
    ev('weekly_goal', '2026-10-26', 30, '2026-10-30T10:00:00Z'), // 지난주 목표
    ev('workout_day', '2026-11-02', 10, '2026-11-02T10:00:00Z'), // 이번 주
    ev('workout_day', '2026-11-05', 10, '2026-11-05T10:00:00Z'),
    ev('weekly_goal', '2026-11-02', 30, '2026-11-05T10:00:01Z'), // 이번 주 목표
    ev('pet_feed', 'p1:a', -25, '2026-11-05T11:00:00Z'),
  ]
  const s = summarizePoints(events, TODAY)
  assert.equal(s.earned, 90)
  assert.equal(s.spent, 25)
  assert.equal(s.balance, 65)
  assert.equal(s.weekEarned, 50) // 10 + 10 + 30
  assert.equal(s.recent.length, 5)
  assert.equal(s.recent[0].kind, 'pet_feed') // 최신순
})

test('요약: 일요일·월요일 경계 (월요일 시작 주)', () => {
  const events = [ev('workout_day', '2026-11-01', 10, 'a'), ev('workout_day', '2026-11-02', 10, 'b')] // 일(지난주), 월(이번 주)
  assert.equal(summarizePoints(events, '2026-11-02').weekEarned, 10)
  assert.equal(summarizePoints(events, '2026-11-01').weekEarned, 10) // 11/1이 속한 주(10/26~)의 11/1만
})

test('요약: 비었거나 잘못된 값', () => {
  assert.deepEqual(summarizePoints([], TODAY), { balance: 0, earned: 0, spent: 0, weekEarned: 0, recent: [] })
  assert.equal(summarizePoints(null, TODAY).balance, 0)
  assert.equal(summarizePoints([null, { kind: 'workout_day', ref: '2026-11-05', points: 'x' }], TODAY).balance, 0)
})

test('내역 문구', () => {
  assert.equal(eventLabel(ev('workout_day', '2026-11-05', 10)), '11/5 운동')
  assert.equal(eventLabel(ev('weekly_goal', '2026-11-02', 30)), '11/2 주 운동 목표 달성')
  assert.equal(eventLabel(ev('pet_feed', 'p1:a', -25)), '펫 먹이')
  assert.equal(eventLabel(ev('pet_egg', 'p1', -50)), '새 알 받기')
})

test('운동한 날 키: 완료·세트 있음·오늘 이전만, 같은 날은 한 번, 순서 무관', () => {
  const l = (date, reps, isCompleted = true) => ({ date, isCompleted, performedSets: [{ reps }] })
  const logs = [l('2026-11-05', 8), l('2026-11-05', 5), l('2026-11-03', 0), l('2026-11-02', 8, false), l('2026-11-06', 8), l('2026-11-01', 6)]
  assert.equal(workoutDaysKey(logs, TODAY), '2026-11-01,2026-11-05')
  assert.equal(workoutDaysKey([], TODAY), '')
  assert.equal(workoutDaysKey([{ date: TODAY, isCompleted: true }], TODAY), '')
})
