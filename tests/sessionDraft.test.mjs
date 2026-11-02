import assert from 'node:assert/strict'
import { draftKey, saveDraft, loadDraft, clearDraft, pruneOldDrafts, draftSummary, resumeStepIndex } from '../src/lib/sessionDraft.js'

class MemStorage {
  constructor() { this.m = new Map() }
  get length() { return this.m.size }
  key(i) { return [...this.m.keys()][i] ?? null }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null }
  setItem(k, v) { this.m.set(k, String(v)) }
  removeItem(k) { this.m.delete(k) }
}
const st = new MemStorage()
const key = draftKey('u1', 'r1', '2026-10-28')
assert.equal(key, 'fit-session-draft:u1:r1:2026-10-28')
assert.equal(draftKey(null, 'r1', 'd'), 'fit-session-draft:anon:r1:d')
const set = (reps, w = 40) => ({ reps, weight: w, durationSeconds: 40, restBeforeSeconds: 90, startedAt: 1, endedAt: 2 })
const logs = [
  { id: 'a', exercise: '벤치프레스', targetSets: 4, isCompleted: false },
  { id: 'b', exercise: '랫풀다운', targetSets: 3, isCompleted: false },
  { id: 'c', exercise: '스쿼트', targetSets: 3, isCompleted: true },
]
const opt = { storage: st, now: 1_000_000 }

// 저장 → 읽기
assert.equal(saveDraft(key, { a: [set(8), set(8)] }, opt), true)
let d = loadDraft(key, logs, opt)
assert.deepEqual(Object.keys(d.performedByLog), ['a']); assert.equal(d.performedByLog.a.length, 2)
assert.deepEqual(draftSummary(d, logs), [{ exercise: '벤치프레스', sets: 2 }])

// 빈 기록(또는 빈 세트 배열)을 저장하면 지운다
assert.equal(saveDraft(key, {}, opt), false); assert.equal(st.getItem(key), null)
saveDraft(key, { a: [set(8)] }, opt); saveDraft(key, { a: [] }, opt); assert.equal(st.getItem(key), null)

// 이미 끝난 운동·없는 운동·세트가 목표 이상인 운동은 걸러지고, 남는 게 없으면 null
saveDraft(key, { a: [set(8)], c: [set(8)], zzz: [set(8)], b: [set(8), set(8), set(8)] }, opt)
d = loadDraft(key, logs, opt)
assert.deepEqual(Object.keys(d.performedByLog), ['a'])                       // c(완료)·zzz(없음)·b(3세트=목표)는 제외
saveDraft(key, { c: [set(8)] }, opt)
assert.equal(loadDraft(key, logs, opt), null)

// 오래된 것(사흘 초과)·형식 오류·다른 버전은 null
saveDraft(key, { a: [set(8)] }, { storage: st, now: 0 })
assert.equal(loadDraft(key, logs, { storage: st, now: 4 * 24 * 3600 * 1000 }), null)
assert.ok(loadDraft(key, logs, { storage: st, now: 2 * 24 * 3600 * 1000 }))
st.setItem(key, 'not json'); assert.equal(loadDraft(key, logs, opt), null)
st.setItem(key, JSON.stringify({ v: 2, savedAt: 1_000_000, performedByLog: { a: [set(8)] } })); assert.equal(loadDraft(key, logs, opt), null)
st.setItem(key, JSON.stringify({ v: 1, savedAt: 1_000_000, performedByLog: { a: [{ reps: 'x', weight: 1 }] } })); assert.equal(loadDraft(key, logs, opt), null) // 잘못된 세트
st.setItem(key, JSON.stringify({ v: 1, savedAt: 1_000_000, performedByLog: { a: [{ reps: -1, weight: 1 }] } })); assert.equal(loadDraft(key, logs, opt), null)

// 정리: 오래된 것·읽을 수 없는 것만 지우고, 다른 키와 최근 것은 남긴다
const st2 = new MemStorage()
st2.setItem('other', '1')
saveDraft('fit-session-draft:u:r:1', { a: [set(1)] }, { storage: st2, now: 0 })
saveDraft('fit-session-draft:u:r:2', { a: [set(1)] }, { storage: st2, now: 10 * 24 * 3600 * 1000 })
st2.setItem('fit-session-draft:u:r:3', 'broken')
assert.equal(pruneOldDrafts({ storage: st2, now: 10 * 24 * 3600 * 1000 + 1 }), 2)
assert.deepEqual([...st2.m.keys()].sort(), ['fit-session-draft:u:r:2', 'other'])

// clearDraft
saveDraft(key, { a: [set(8)] }, opt); clearDraft(key, { storage: st }); assert.equal(st.getItem(key), null)

// 저장소가 없거나 던져도 안전
assert.equal(saveDraft(key, { a: [set(8)] }, { storage: null }), false)
assert.equal(loadDraft(key, logs, { storage: null }), null)
const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') }, length: 0, key: () => null }
assert.equal(saveDraft(key, { a: [set(8)] }, { storage: broken }), false)
assert.equal(loadDraft(key, logs, { storage: broken }), null)
clearDraft(key, { storage: broken }); pruneOldDrafts({ storage: broken })

// 이어서 할 지점: 단독 운동(4세트 중 2세트 기록 → 3번째 단계) / 수퍼세트(번갈아) / 모두 기록 → -1
const flatSolo = [0, 1, 2, 3].map(round => ({ logId: 'a', round }))
assert.equal(resumeStepIndex(flatSolo, { a: [1, 2] }), 2)
assert.equal(resumeStepIndex(flatSolo, { a: [] }), 0)
assert.equal(resumeStepIndex(flatSolo, { a: [1, 2, 3, 4] }), -1)
const flatSuper = [{ logId: 'a', round: 0 }, { logId: 'b', round: 0 }, { logId: 'a', round: 1 }, { logId: 'b', round: 1 }, { logId: 'a', round: 2 }] // 세트 수가 다른 수퍼세트(a 3세트, b 2세트)
assert.equal(resumeStepIndex(flatSuper, { a: [1], b: [1] }), 2)        // a 1세트·b 1세트 끝 → 다음은 a의 2번째
assert.equal(resumeStepIndex(flatSuper, { a: [1, 2], b: [1] }), 3)     // a 2·b 1 → b의 2번째
assert.equal(resumeStepIndex(flatSuper, { a: [1] }), 1)                // a만 1세트 → b의 1번째
assert.equal(resumeStepIndex(flatSuper, { a: [1, 2], b: [1, 2] }), 4)  // 공통 라운드 끝 → a의 3번째
console.log('OK: 세션 임시 저장 전부 통과')

// 건너뜀(skipped)으로 표시된 운동의 임시 저장은 무시한다(루틴 종료 뒤 이어서 하기가 뜨지 않게)
{
  const st3 = new MemStorage()
  const logs3 = [{ id: 'a', exercise: '벤치프레스', targetSets: 4, isCompleted: false, skipped: true }, { id: 'b', exercise: '랫풀다운', targetSets: 3, isCompleted: false, skipped: false }]
  saveDraft(key, { a: [set(8)], b: [set(8)] }, { storage: st3, now: 1_000_000 })
  const d3 = loadDraft(key, logs3, { storage: st3, now: 1_000_000 })
  assert.deepEqual(Object.keys(d3.performedByLog), ['b'])
  saveDraft(key, { a: [set(8)] }, { storage: st3, now: 1_000_000 })
  assert.equal(loadDraft(key, logs3, { storage: st3, now: 1_000_000 }), null)
  console.log('OK: 건너뜀 임시 저장 무시 통과')
}