import { usePoints } from '../../context/PointsContext.jsx'
import { POINT_WORKOUT_DAY, POINT_WEEKLY_GOAL } from '../../lib/points.js'

// 운동 포인트 카드 (웹앱용 화면) — 쓸 수 있는 포인트, 이번 주에 번 포인트, 최근 내역. 포인트 SQL을 실행하지 않았으면 안 보인다.
export default function PointsCard() {
  const { supported, loaded, summary } = usePoints()
  if (!supported || !loaded) return null
  const { balance, weekEarned, recent } = summary

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-ui-title font-bold text-gray-800">내 포인트</h3>
        <span className="text-ui-caption text-gray-400">이번 주 +{weekEarned}P</span>
      </div>

      <div className="mt-2 text-xl font-black text-amber-600 tabular-nums">
        {balance.toLocaleString()}
        <span className="text-ui-body font-bold text-gray-400"> P</span>
      </div>

      {recent.length > 0 ? (
        <ul className="mt-2 divide-y divide-gray-100">
          {recent.map(e => (
            <li key={`${e.kind}:${e.ref}`} className="flex justify-between py-1 text-ui-body">
              <span className="text-gray-700">{e.label}</span>
              <span className={`font-bold tabular-nums ${e.points < 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                {e.points > 0 ? '+' : ''}
                {e.points}P
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-ui-body text-gray-400">운동을 마치면 포인트가 쌓여요.</div>
      )}

      <div className="mt-2 text-ui-caption text-gray-400">
        운동한 날 +{POINT_WORKOUT_DAY}P · 주간 운동 목표를 채운 주 +{POINT_WEEKLY_GOAL}P (설정의 "내 목표"에서 주간 목표를 정해요)
      </div>
    </div>
  )
}
