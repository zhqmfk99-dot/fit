import assert from 'node:assert/strict'
import { bodyCheckReminder, describeBodyCheckReminder, BODY_CHECK_INTERVAL_DAYS } from '../src/lib/bodyCheckReminder.js'

const at = s => new Date(`${s}T12:00:00`) // 하루 중간 시각(시각이 있어도 날짜 기준으로 센다)
const rec = (...dates) => dates.map((date, i) => ({ id: `b${i}`, date, weightKg: 70 }))

assert.equal(BODY_CHECK_INTERVAL_DAYS, 14)

// 마지막 기록일 + 14일부터 알린다(13일째까지는 안 보임)
assert.equal(bodyCheckReminder(rec('2026-11-01'), at('2026-11-14')), null) // 13일 지남
const r = bodyCheckReminder(rec('2026-11-01'), at('2026-11-15'))         // 14일 지남 = 마지막 기록일 + 14일
assert.deepEqual(r, { noRecord: false, lastDate: '2026-11-01', daysSince: 14, dueDate: '2026-11-15' })
assert.equal(bodyCheckReminder(rec('2026-11-01'), at('2026-11-20')).daysSince, 19)
// 같은 날·오늘 기록이면 안 보임
assert.equal(bodyCheckReminder(rec('2026-11-15'), at('2026-11-15')), null)
// 여러 기록 중 가장 최근 날짜가 기준(입력 순서와 무관)
assert.equal(bodyCheckReminder(rec('2026-10-01', '2026-11-10', '2026-09-01'), at('2026-11-20')), null) // 10일 지남
assert.equal(bodyCheckReminder(rec('2026-11-10', '2026-10-01'), at('2026-11-24')).lastDate, '2026-11-10')
// 미래 날짜로 기록한 경우는 알리지 않는다
assert.equal(bodyCheckReminder(rec('2026-12-01'), at('2026-11-15')), null)
// 신체 기록이 없으면 알린다
assert.deepEqual(bodyCheckReminder([], at('2026-11-15')), { noRecord: true, lastDate: null, daysSince: null, dueDate: null })
assert.equal(bodyCheckReminder(undefined, at('2026-11-15')).noRecord, true)
// 날짜 형식이 이상한 기록은 무시한다
assert.equal(bodyCheckReminder([{ date: '잘못' }, { date: null }, {}], at('2026-11-15')).noRecord, true)
assert.equal(bodyCheckReminder([{ date: '잘못' }, ...rec('2026-11-10')], at('2026-11-15')), null)
// 달·해를 넘겨도 날짜 기준으로 센다(12/25 → 1/8은 14일)
assert.equal(bodyCheckReminder(rec('2026-12-25'), at('2027-01-07')), null)
assert.equal(bodyCheckReminder(rec('2026-12-25'), at('2027-01-08')).dueDate, '2027-01-08')
// 간격을 바꿀 수 있다
assert.equal(bodyCheckReminder(rec('2026-11-01'), at('2026-11-08'), 7).daysSince, 7)

// 문장
assert.equal(describeBodyCheckReminder(null), '')
assert.match(describeBodyCheckReminder(bodyCheckReminder([], at('2026-11-15'))), /아직 신체 기록이 없어요/)
assert.equal(describeBodyCheckReminder(r), '마지막 신체 기록이 11/1(14일 전)이에요. 2주가 지났으니 다시 측정해서 기록해 주세요.')

console.log('OK: 신체 기록 알림 전부 통과')
