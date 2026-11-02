import assert from 'node:assert/strict'
import { createPendingStore } from '../src/lib/pendingStore.js'
import { createSyncer, applyPending, diffOf, isEmptyDiff } from '../src/lib/persistedSync.js'

const memBackend = () => {
  const m = new Map()
  return { m, get: async k => m.get(k), set: async (k, v) => void m.set(k, v), del: async k => void m.delete(k) }
}

// ── 저장소: 저장 → 읽기 → 지우기, 사용자·테이블 분리
{
  const b = memBackend()
  const st = createPendingStore(b, { now: () => 1000 })
  assert.equal(st.available, true)
  const diff = { changed: [{ id: 'a', n: 1 }], removedIds: ['z'] }
  assert.equal(await st.save('u1', 'logs', diff), true)
  assert.deepEqual(await st.load('u1', 'logs'), diff)
  assert.equal(await st.load('u2', 'logs'), null) // 다른 사용자
  assert.equal(await st.load('u1', 'routines'), null) // 다른 테이블
  assert.equal(await st.save('u1', 'logs', null), true)
  assert.equal(await st.load('u1', 'logs'), null)
  assert.equal(b.m.size, 0)
}

// ── 오래된 것·깨진 값·형식 오류는 null
{
  const b = memBackend()
  let now = 0
  const st = createPendingStore(b, { now: () => now })
  await st.save('u', 't', { changed: [{ id: 'a' }], removedIds: [] })
  now = 15 * 24 * 3600 * 1000
  assert.equal(await st.load('u', 't'), null) // 2주 초과
  now = 13 * 24 * 3600 * 1000
  assert.ok(await st.load('u', 't'))
  b.m.set('u:t', 'not json'); assert.equal(await st.load('u', 't'), null)
  b.m.set('u:t', JSON.stringify({ v: 2, savedAt: now, changed: [], removedIds: [] })); assert.equal(await st.load('u', 't'), null)
  b.m.set('u:t', JSON.stringify({ v: 1, savedAt: now, changed: [{ x: 1 }], removedIds: [] })); assert.equal(await st.load('u', 't'), null) // id 없는 행
  b.m.set('u:t', JSON.stringify({ v: 1, savedAt: now, changed: [], removedIds: [1] })); assert.equal(await st.load('u', 't'), null)
}

// ── 쓸 수 없는 환경: 백엔드 없음 / 던지는 백엔드 / 사용자 없음
{
  const none = createPendingStore(null)
  assert.equal(none.available, false)
  assert.equal(await none.save('u', 't', { changed: [], removedIds: [] }), false)
  assert.equal(await none.load('u', 't'), null)
  const bad = { get: async () => { throw new Error('x') }, set: async () => { throw new Error('x') }, del: async () => { throw new Error('x') } }
  const st = createPendingStore(bad)
  assert.equal(await st.save('u', 't', { changed: [{ id: 'a' }], removedIds: [] }), false)
  assert.equal(await st.load('u', 't'), null)
  assert.equal(await createPendingStore(memBackend()).save(null, 't', { changed: [], removedIds: [] }), false)
}

// ── 쓰기 순서: 느린 저장 뒤에 온 지우기가 앞서지 않는다
{
  const m = new Map()
  const slow = { get: async k => m.get(k), set: async (k, v) => { await new Promise(r => setTimeout(r, 20)); m.set(k, v) }, del: async k => void m.delete(k) }
  const st = createPendingStore(slow)
  const p1 = st.save('u', 't', { changed: [{ id: 'a' }], removedIds: [] })
  const p2 = st.save('u', 't', null)
  await Promise.all([p1, p2])
  assert.equal(m.size, 0)
}

// ── applyPending: 같은 id는 pending이 이기고, 새 행은 앞, 지운 행은 빠진다
{
  const base = [{ id: 'a', v: 'server' }, { id: 'b', v: 'server' }, { id: 'c', v: 'server' }]
  const out = applyPending(base, { changed: [{ id: 'a', v: 'local' }, { id: 'n', v: 'new' }], removedIds: ['c', 'gone'] })
  assert.deepEqual(out, [{ id: 'n', v: 'new' }, { id: 'a', v: 'local' }, { id: 'b', v: 'server' }])
  assert.equal(applyPending(base, null), base)
  assert.equal(applyPending(base, { changed: [], removedIds: [] }), base)
  // 지운 행이 changed에도 있으면(드문 경우) 지운 쪽이 이긴다
  assert.deepEqual(applyPending([], { changed: [{ id: 'x' }], removedIds: ['x'] }), [])
  assert.equal(isEmptyDiff(diffOf(base, out)), false)
  assert.equal(isEmptyDiff(diffOf(base, base.map(x => ({ ...x })))), true)
}

// ── 동기화기 + 보관소: 올리기 전에 보관, 실패하면 남고, 성공하면 지운다 / 앱 종료 후 복원해서 올린다
{
  const server = new Map() // id → row
  let offline = true
  const client = {
    from: () => ({
      upsert: async rows => { if (offline) return { error: new Error('offline') }; rows.forEach(r => server.set(r.id, r)); return { error: null } },
      delete: () => ({ in: async (_col, ids) => { if (offline) return { error: new Error('offline') }; ids.forEach(i => server.delete(i)); return { error: null } } }),
    }),
  }
  const b = memBackend()
  const store = createPendingStore(b)
  const bound = { save: (t, p) => store.save('u', t, p) }
  let target = []
  const mk = () => createSyncer({ client, table: 't', toRow: x => x, getTarget: () => target, queue: { current: Promise.resolve() }, store: bound, onError: () => {}, onSaved: () => {} })

  // 앱 1: 오프라인에서 행 추가 → 저장 실패, 보관본은 남는다
  let s1 = mk()
  s1.markPersisted([])
  target = [{ id: 'a', n: 1 }]
  await s1.run()
  assert.equal(server.size, 0)
  assert.deepEqual(await store.load('u', 't'), { changed: [{ id: 'a', n: 1 }], removedIds: [] })

  // 앱 종료 → 앱 2: 서버 값([])을 읽고 보관본을 얹어 다시 올린다(연결 복구)
  offline = false
  const pending = await store.load('u', 't')
  const s2 = mk()
  const loaded = []
  s2.markPersisted(loaded)
  target = applyPending(loaded, pending)
  await s2.run()
  assert.deepEqual([...server.keys()], ['a'])
  assert.equal(await store.load('u', 't'), null) // 성공하면 지워진다

  // 보관 없는 정상 저장은 보관소를 건드리지 않는다
  b.m.clear()
  target = [...target, { id: 'b' }]
  await s2.run()
  assert.equal(server.size, 2)
  assert.equal(b.m.size, 0)

  // 삭제도 보관된다
  offline = true
  target = target.filter(x => x.id !== 'a')
  await s2.run()
  assert.deepEqual(await store.load('u', 't'), { changed: [], removedIds: ['a'] })
  offline = false
  await s2.run()
  assert.equal(server.has('a'), false)
  assert.equal(await store.load('u', 't'), null)
}

console.log('OK: 오프라인 보관 전부 통과')
