// 저장하지 못한 변경(오프라인·약한 신호)을 이 기기에 보관한다 — UI 아님.
//
// lib/persistedSync.js가 올리기 전에 "저장된 상태 → 지금 상태"의 차이(바뀐 행 + 지운 id)를 여기에 쓰고, 서버 저장에 성공하면 지운다.
// 저장 전에 앱이 종료·새로고침되면 다음에 열 때 서버에서 읽은 값 위에 이 차이를 다시 얹어 올린다(WorkoutLogsContext).
// 보관 위치는 IndexedDB(localStorage보다 용량이 크고 비동기). 쓸 수 없는 환경(사생활 보호 모드 등)이면 보관 없이 동작한다.
//
// 키: <사용자 id>:<테이블> / 값(JSON 문자열): { v: 1, savedAt: ms, changed: [...], removedIds: [...] }
// 다른 기기에서 같은 행을 고쳤다면 이 기기의 변경이 이긴다(행 단위 마지막 쓰기 우선). 2주가 지난 보관본은 버린다.

const DB_NAME = 'fit-pending'
const STORE = 'pending'
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

// IndexedDB 백엔드: { get(key), set(key, value), del(key) } (Promise). 쓸 수 없으면 null.
export function idbBackend(idb = globalThis.indexedDB) {
  if (!idb) return null
  let dbp = null
  const open = () => {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = idb.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        req.onblocked = () => reject(new Error('IndexedDB blocked'))
      })
      dbp.catch(() => (dbp = null)) // 열기에 실패하면 다음에 다시 시도
    }
    return dbp
  }
  const tx = async (mode, fn) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(req?.result)
      t.onerror = t.onabort = () => reject(t.error)
    })
  }
  return {
    get: key => tx('readonly', s => s.get(key)),
    set: (key, value) => tx('readwrite', s => s.put(value, key)),
    del: key => tx('readwrite', s => s.delete(key)),
  }
}

// backend가 null이면 아무것도 보관하지 않는다(available=false).
// IndexedDB가 응답하지 않는 환경(일부 브라우저·사생활 보호 모드)에서도 앱이 멈추지 않게, 한 동작이 timeoutMs 안에 안 끝나면 실패로 보고
// 그 뒤로는 보관소를 아예 쓰지 않는다(저장 흐름이 응답 없는 보관소를 기다리며 서버 저장까지 막히는 일이 없도록).
export function createPendingStore(backend = idbBackend(), { now = () => Date.now(), timeoutMs = 2000 } = {}) {
  const keyOf = (userId, table) => `${userId}:${table}`
  let chain = Promise.resolve() // 쓰기 순서가 뒤바뀌지 않게 하나씩 처리
  let broken = false

  const withTimeout = p =>
    Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('pending store timeout')), timeoutMs))]).catch(e => {
      if (/timeout/.test(e?.message)) broken = true
      throw e
    })

  const enqueue = op => {
    const result = chain.then(() => (broken ? Promise.reject(new Error('pending store unavailable')) : withTimeout(op()))) // 앞 동작이 멈췄다고 판정됐으면 줄 서 있던 동작도 기다리지 않고 바로 실패
    chain = result.catch(() => {})
    return result
  }

  return {
    get available() {
      return !!backend && !broken
    },
    // pending이 null이면 지운다. 성공 여부를 돌려주고 던지지 않는다.
    save(userId, table, pending) {
      if (!backend || broken || !userId) return Promise.resolve(false)
      return enqueue(async () => {
        if (pending) await backend.set(keyOf(userId, table), JSON.stringify({ v: 1, savedAt: now(), changed: pending.changed, removedIds: pending.removedIds }))
        else await backend.del(keyOf(userId, table))
        return true
      }).catch(() => false)
    },
    // 보관된 변경(없거나 형식이 이상하거나 오래됐으면 null)
    load(userId, table) {
      if (!backend || broken || !userId) return Promise.resolve(null)
      return enqueue(async () => {
        const raw = await backend.get(keyOf(userId, table))
        if (!raw) return null
        const d = JSON.parse(raw)
        const okRows = a => Array.isArray(a) && a.every(x => x && typeof x === 'object' && typeof x.id === 'string')
        if (!d || d.v !== 1 || typeof d.savedAt !== 'number' || now() - d.savedAt > MAX_AGE_MS) return null
        if (!okRows(d.changed) || !Array.isArray(d.removedIds) || !d.removedIds.every(id => typeof id === 'string')) return null
        return { changed: d.changed, removedIds: d.removedIds }
      }).catch(() => null)
    },
  }
}
