import { useState } from 'react'
import { usePoints } from '../../context/PointsContext.jsx'
import { EGG_COST, MAX_XP, petView, feedOptions, collectionEmoji, SPECIES } from '../../lib/pet.js'

// 펫 키우기 카드 (PWA용 화면) — 포인트로 먹이를 줘서 알 → 아기 → 청소년 → 다 자란 단계로 키운다. 다 키우면 도감에 모인다.
// 가격·부화·종류(무작위) 결정은 서버가 한다(supabase/points.sql). 계산은 lib/pet.js(웹앱·PWA 공용).
export default function PetCard() {
  const { supported, loaded, summary, pets, adoptPet, feedPet } = usePoints()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!supported || !loaded) return null

  const active = pets.find(p => !p.completed_at)
  const collection = pets.filter(p => p.completed_at)
  const balance = summary.balance
  const firstEgg = pets.length === 0
  const eggCost = firstEgg ? 0 : EGG_COST

  const run = async fn => {
    setBusy(true)
    setMessage((await fn()) ?? '')
    setBusy(false)
  }

  const v = active ? petView(active) : null
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-m-title font-bold text-gray-800">내 펫</h3>
        <span className="text-m-caption text-gray-400">
          도감 {new Set(collection.map(p => p.species)).size}/{Object.keys(SPECIES).length}종
        </span>
      </div>

      {active ? (
        <div className="mt-2 flex items-center gap-4">
          <div className="text-6xl leading-none select-none" role="img" aria-label={v.stage === 0 ? '알' : `${v.speciesName} ${v.stageName}`}>
            {v.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-m-body font-bold text-gray-800">
              {v.stage === 0 ? '알' : `${v.speciesName} · ${v.stageName}`}
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v.progress * 100)}>
              <div className="h-full bg-amber-500" style={{ width: `${Math.round(v.progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-m-caption text-gray-400">
              경험치 {v.xp}/{MAX_XP}
              {v.nextAt != null && ` · 다음 단계까지 ${v.toNext}`}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-m-body text-gray-600">{firstEgg ? '첫 알은 무료예요. 알을 받아서 키워 보세요!' : `다 키웠어요! 새 알은 ${EGG_COST}P예요.`}</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {active ? (
          feedOptions(balance, active.xp).map(o => (
            <button
              key={o.amount}
              type="button"
              disabled={busy || o.disabled}
              onClick={() => run(() => feedPet(o.amount))}
              className="px-3.5 py-2 min-h-[36px] rounded-lg bg-amber-50 border border-amber-200 text-m-body font-bold text-amber-700 active:bg-amber-100 disabled:opacity-40"
            >
              먹이 {o.amount}P
            </button>
          ))
        ) : (
          <button
            type="button"
            disabled={busy || balance < eggCost}
            onClick={() => run(adoptPet)}
            className="px-3.5 py-2 min-h-[36px] rounded-lg bg-amber-500 text-white text-m-body font-bold active:bg-amber-600 disabled:opacity-40"
          >
            🥚 알 받기{eggCost > 0 ? ` (${eggCost}P)` : ' (무료)'}
          </button>
        )}
        <span className="text-m-caption text-gray-400">내 포인트 {balance.toLocaleString()}P</span>
      </div>
      {message && (
        <div role="alert" className="mt-2 text-m-body font-bold text-orange-600">
          {message}
        </div>
      )}
      {!active && !firstEgg && balance < EGG_COST && <div className="mt-1 text-m-caption text-gray-400">포인트가 {EGG_COST - balance}P 더 필요해요.</div>}

      {collection.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-m-caption text-gray-400">도감</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-3xl leading-none">
            {collection.map(p => (
              <span key={p.id} title={`${SPECIES[p.species]?.name ?? '?'} · ${p.completed_at.slice(0, 10)}`} className="select-none">
                {collectionEmoji(p)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}