import assert from 'node:assert/strict'
import { persistDiff, createSyncer } from '../src/lib/persistedSync.js'

// 가짜 Supabase 클라이언트: online 플래그로 실패를 흉내 낸다. 호출 기록과 "서버 상태"를 같이 유지한다.
function fakeClient() {
  const db = { t: new Map() }
  const calls = []
  const c = {
    online: true,
    failDelete: false,
    db, calls,
    from: table => ({
      upsert: async rows => {
        calls.push(['upsert', rows.map(r => r.id)])
        if (!c.online) return { error: new Error('network') }
        rows.forEach(r => db.t.set(r.id, r))
        return { error: null }
      },
      delete: () => ({ in: async (_col, ids) => {
        calls.push(['delete', ids])
        if (!c.online || c.failDelete) return { error: new Error('network') }
        ids.forEach(id => db.t.delete(id))
        return { error: null }
      } }),
    }),
  }
  return c
}
const toRow = x => ({ id: x.id, v: x.v })
const setup = () => {
  const client = fakeClient()
  const state = { current: [] }
  const errors = [], saved = []
  const syncer = createSyncer({ client, table: 't', toRow, getTarget: () => state.current, queue: { current: Promise.resolve() }, onError: (e, t) => errors.push(t), onSaved: t => saved.push(t) })
  const set = next => { state.current = next; return syncer.run() }
  return { client, state, errors, saved, syncer, set }
}

// 1. 정상 저장
let s = setup()
s.syncer.markPersisted([{ id: 'a', v: 1 }]); s.state.current = [{ id: 'a', v: 1 }]
await s.set([{ id: 'a', v: 1 }, { id: 'b', v: 2 }])
assert.deepEqual([...s.client.db.t.keys()], ['b'])      // 새로 생긴 b만 올라감(a는 변경 없음)
assert.deepEqual(s.saved, ['t']); assert.equal(s.errors.length, 0)

// 2. 오프라인에서 실패 → 새 변경 없이도 복구 후 재시도하면 올라간다(예전 구조에서는 영영 누락)
s = setup(); s.client.online = false
await s.set([{ id: 'a', v: 1 }])
assert.equal(s.errors.length, 1); assert.equal(s.client.db.t.size, 0)
s.client.online = true
await s.syncer.run()
assert.deepEqual([...s.client.db.t.keys()], ['a'])
assert.equal(s.saved.length, 1)

// 3. 연속 변경이 모두 실패해도 복구 후 한 번에 모두 올라간다(마지막 상태 기준)
s = setup(); s.client.online = false
await s.set([{ id: 'a', v: 1 }])
await s.set([{ id: 'a', v: 2 }, { id: 'b', v: 1 }])
await s.set([{ id: 'a', v: 3 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }])
assert.equal(s.errors.length, 3)
s.client.online = true
await s.syncer.run()
assert.deepEqual([...s.client.db.t.values()].map(r => `${r.id}:${r.v}`).sort(), ['a:3', 'b:1', 'c:1'])

// 4. 오프라인 중 삭제도 복구 후 반영
s = setup(); await s.set([{ id: 'a', v: 1 }, { id: 'b', v: 1 }])
s.client.online = false
await s.set([{ id: 'a', v: 1 }])
assert.deepEqual([...s.client.db.t.keys()].sort(), ['a', 'b'])
s.client.online = true; await s.syncer.run()
assert.deepEqual([...s.client.db.t.keys()], ['a'])

// 5. 일부만 실패(upsert는 성공, delete는 실패) → 재시도에서 delete가 마무리된다(upsert 재전송은 안전)
s = setup(); await s.set([{ id: 'a', v: 1 }, { id: 'b', v: 1 }])
s.client.failDelete = true
await s.set([{ id: 'a', v: 9 }])
assert.equal(s.errors.length, 1)
assert.equal(s.client.db.t.get('a').v, 9); assert.ok(s.client.db.t.has('b'))
s.client.failDelete = false; await s.syncer.run()
assert.ok(!s.client.db.t.has('b'))

// 6. 실패한 뒤에도 큐는 멈추지 않는다: 실패 → 같은 큐의 다음 저장은 정상 실행
s = setup(); s.client.online = false
const p1 = s.set([{ id: 'a', v: 1 }])
s.client.online = true
const p2 = s.set([{ id: 'a', v: 1 }, { id: 'b', v: 1 }])   // 큐에서 p1 다음 순서
await Promise.all([p1, p2])
assert.deepEqual([...s.client.db.t.keys()].sort(), ['a', 'b'])

// 7. 변경이 없으면 요청을 보내지 않는다 / 키 순서만 다른 같은 내용도 보내지 않는다
s = setup(); s.syncer.markPersisted([{ id: 'a', v: 1, extra: { x: 1, y: 2 } }])
s.client.calls.length = 0
await s.set([{ extra: { y: 2, x: 1 }, v: 1, id: 'a' }])
assert.equal(s.client.calls.length, 0, `불필요한 요청 ${JSON.stringify(s.client.calls)}`)
await s.set([{ id: 'a', v: 1, extra: { x: 1, y: 3 } }])  // 값이 바뀌면 보낸다
assert.equal(s.client.calls.length, 1)

// 8. 서버에서 읽은 상태를 markPersisted하면 그 행은 다시 올리지 않는다
s = setup(); s.syncer.markPersisted([{ id: 'a', v: 1 }, { id: 'b', v: 1 }]); s.state.current = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }]
await s.syncer.run()
assert.equal(s.client.calls.length, 0)

// 9. persistDiff 단독: 새 행 / 삭제 / 변경
const c9 = fakeClient()
await persistDiff(c9, 't', [{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'a', v: 2 }, { id: 'c', v: 1 }], toRow)
assert.deepEqual(c9.calls, [['upsert', ['a', 'c']], ['delete', ['b']]])
console.log('OK: 저장 동기화 전부 통과')
