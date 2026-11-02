// 앱 상태(운동 기록·루틴·운동 리스트·신체 기록)를 Supabase에 저장하는 동기화 로직.
//
// 핵심: 변경분은 "직전 화면 상태"가 아니라 **마지막으로 저장에 성공한 상태**와 비교해서 올린다.
//   예전에는 직전 화면 상태와 비교해서, 저장이 한 번 실패하면(오프라인·약한 신호 등) 그 변경이 영영 올라가지 않았다
//   (이후 저장도 "이미 반영된 화면 상태"와만 비교하므로). 지금은 실패한 변경이 성공 상태에 반영되지 않은 채 남아 있어서
//   다음 저장·재시도 때 자동으로 다시 올라간다.

// 키 순서가 달라도 같은 내용이면 같은 문자열이 되게 한다(불필요한 upsert 방지)
const stable = v =>
  JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map(key => [key, val[key]])) : val))

// 이전 → 다음 상태에서 바뀐(추가·수정) 행과 사라진 행의 id
export function diffOf(prev, next) {
  const prevById = new Map(prev.map(x => [x.id, x]))
  const nextIds = new Set(next.map(x => x.id))
  const changed = next.filter(x => !prevById.has(x.id) || stable(prevById.get(x.id)) !== stable(x))
  const removedIds = prev.filter(x => !nextIds.has(x.id)).map(x => x.id)
  return { changed, removedIds }
}

export const isEmptyDiff = d => !d.changed.length && !d.removedIds.length

// 서버에서 읽은 상태(base)에 저장 못 한 변경(pending)을 다시 얹는다 — 같은 id는 pending이 이기고(행 단위 마지막 쓰기 우선), 새 행은 앞에 둔다.
export function applyPending(base, pending) {
  if (!pending || isEmptyDiff(pending)) return base
  const removed = new Set(pending.removedIds)
  const changedById = new Map(pending.changed.map(x => [x.id, x]))
  const kept = base.filter(x => !removed.has(x.id)).map(x => changedById.get(x.id) ?? x)
  const baseIds = new Set(base.map(x => x.id))
  const added = pending.changed.filter(x => !baseIds.has(x.id) && !removed.has(x.id))
  return [...added, ...kept]
}

// 이전/다음 상태를 id로 비교해 바뀐 행만 upsert, 사라진 행은 delete 한다.
export async function persistDiff(client, table, prev, next, toRow) {
  const { changed, removedIds } = diffOf(prev, next)

  if (changed.length) {
    const { error } = await client.from(table).upsert(changed.map(toRow))
    if (error) throw error
  }
  if (removedIds.length) {
    const { error } = await client.from(table).delete().in('id', removedIds)
    if (error) throw error
  }
}

// 테이블 하나의 동기화기.
//   getTarget(): 지금 화면의 최신 상태(저장해야 할 목표) / queue: { current: Promise } — 테이블들이 하나의 큐를 공유해 저장 순서가 뒤바뀌지 않게 한다
//   run(): 저장을 큐에 넣는다(여러 번 불러도 안전 — 항상 "저장된 상태 → 최신 상태" 차이만 올린다). 실패하면 onError(e, table), 성공하면 onSaved(table).
//   markPersisted(state): 서버에서 막 읽어온 상태를 "저장된 상태"로 기록한다(저장 요청 없이).
//   store(선택): 저장 못 한 변경을 기기에 보관한다(lib/pendingStore.js). 올리기 전에 변경분을 먼저 보관하고 성공하면 지운다
//     — 앱이 중간에 종료돼도 다음에 열 때 다시 올릴 수 있게. store.save(table, diff | null)는 던지지 않는다.
export function createSyncer({ client, table, toRow, getTarget, queue, onError, onSaved, store }) {
  let persisted = []
  let stored = false
  const run = () => {
    queue.current = queue.current
      .then(async () => {
        const target = getTarget()
        const diff = diffOf(persisted, target)
        if (!isEmptyDiff(diff)) {
          await store?.save(table, diff)
          stored = true
        }
        await persistDiff(client, table, persisted, target, toRow)
        persisted = target
        if (stored) {
          stored = false
          await store?.save(table, null)
        }
        onSaved?.(table)
      })
      .catch(e => onError?.(e, table))
    return queue.current
  }
  return { run, markPersisted: state => (persisted = state) }
}
