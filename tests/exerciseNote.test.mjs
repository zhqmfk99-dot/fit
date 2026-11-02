import assert from 'node:assert/strict'
import { cleanNote, NOTE_MAX } from '../src/lib/exerciseNote.js'

assert.equal(NOTE_MAX, 300)
assert.equal(cleanNote('  벤치 높이 3  '), '벤치 높이 3')
assert.equal(cleanNote('줄1\n줄2'), '줄1\n줄2') // 줄바꿈은 유지
assert.equal(cleanNote(''), '')
assert.equal(cleanNote('   '), '')
assert.equal(cleanNote(null), '')
assert.equal(cleanNote(undefined), '')
assert.equal(cleanNote(123), '')
assert.equal(cleanNote({}), '')
// 최대 길이로 자르고 끝 공백도 정리
assert.equal(cleanNote('a'.repeat(400)).length, 300)
assert.equal(cleanNote('a'.repeat(299) + ' ' + 'b'.repeat(10)), 'a'.repeat(299))

console.log('OK: 운동 메모 규칙 통과')
