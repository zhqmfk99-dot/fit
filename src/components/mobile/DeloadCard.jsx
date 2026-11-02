import { useDeloadAdvice } from '../../hooks/useDeloadAdvice.js'
import { DELOAD_TIP } from '../../lib/deload.js'

// 회복 주간(디로드) 제안 카드 (PWA용 화면) — 규칙 기반 제안일 뿐 목표 무게는 자동으로 바꾸지 않는다. 계산은 lib/deload.js(웹앱과 공용).
export default function DeloadCard() {
  const { advice, hidden, snooze } = useDeloadAdvice()
  if (!advice.show || hidden) return null
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-m-title font-bold text-orange-800">{advice.level === 'recommend' ? '이번 주는 쉬어 가요' : '쉬어 갈 때일 수 있어요'}</h3>
        <span className="text-m-caption font-bold text-orange-700">회복 주간 제안</span>
      </div>
      <ul className="mt-2 space-y-1">
        {advice.signals.map(s => (
          <li key={s.kind} className="text-m-body text-gray-700 leading-snug">
            · {s.text}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-m-body font-bold text-gray-800 leading-relaxed">{DELOAD_TIP}</p>
      <p className="mt-1 text-m-caption text-gray-500 leading-relaxed">참고용 제안이에요. 앱이 목표 무게를 자동으로 바꾸지는 않아요. 컨디션이 좋으면 그대로 해도 돼요.</p>
      <button type="button" onClick={snooze} className="mt-2 min-h-[36px] px-4 rounded-full border border-orange-200 bg-white text-m-caption font-bold text-orange-700 active:bg-orange-100">
        7일 동안 숨기기
      </button>
    </div>
  )
}