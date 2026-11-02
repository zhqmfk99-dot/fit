import assert from 'node:assert/strict'
import { isSkipped, isPending } from '../src/lib/logStatus.js'
const L = (isCompleted, skipped) => ({ isCompleted, skipped })
// 완료 / 건너뜀 / 예정
assert.deepEqual([isPending(L(false, false)), isSkipped(L(false, false))], [true, false])      // 예정
assert.deepEqual([isPending(L(false, true)), isSkipped(L(false, true))], [false, true])        // 건너뜀
assert.deepEqual([isPending(L(true, false)), isSkipped(L(true, false))], [false, false])       // 완료
assert.deepEqual([isPending(L(true, true)), isSkipped(L(true, true))], [false, false])         // 완료가 우선(건너뜀 표시가 남아 있어도 완료로 본다)
assert.deepEqual([isPending({}), isSkipped({})], [true, false])                                 // 표시 없는 옛 기록(undefined)은 예정
assert.deepEqual([isPending({ isCompleted: false, skipped: undefined }), isSkipped({ skipped: undefined })], [true, false])
console.log('OK: 기록 상태 판정 통과')