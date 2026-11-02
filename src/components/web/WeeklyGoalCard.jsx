import { useWeeklyGoal } from '../../hooks/useWeeklyGoal.js'

const md = s => s.slice(5).replace('-', '/')

// 주간 운동 목표 카드 (웹앱용 화면) — 이번 주(월~일) 운동한 날 / 목표, 연속 달성 주, 최근 8주. 목표가 없으면 안 보인다. 계산은 lib/weeklyGoal.js(웹앱과 공용).
export default function WeeklyGoalCard() {
  const g = useWeeklyGoal()
  if (!g) return null
  const { week, streak, bestStreak, weeks } = g

  let status
  if (week.hit) status = <span className="font-bold text-emerald-700">이번 주 목표 달성! 🎉</span>
  else if (week.canReach) status = <span className="font-bold text-gray-700">목표까지 {week.needed}일 · 남은 {week.daysLeft}일</span>
  else status = <span className="font-bold text-orange-600">이번 주는 목표에 닿기 어려워요(필요 {week.needed}일, 남은 {week.daysLeft}일). 다음 주에 다시 도전해요.</span>

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-ui-title font-bold text-gray-800">주간 운동 목표</h3>
        <span className="text-ui-caption text-gray-400">
          이번 주 · {md(week.start)}~{md(week.end)}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <div className="text-xl font-black text-gray-800 tabular-nums">
          {week.days}
          <span className="text-ui-body font-bold text-gray-400"> / {g.goal}일</span>
        </div>
        <div className="flex gap-1.5 pb-1.5" aria-hidden="true">
          {Array.from({ length: g.goal }, (_, i) => (
            <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < week.days ? 'bg-letusBlue' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>
      <div className="mt-1.5 text-ui-body leading-snug">{status}</div>

      <div className="mt-3 flex items-center gap-1.5" role="img" aria-label="최근 8주 달성 현황">
        {weeks.map(w => (
          <span
            key={w.start}
            title={`${md(w.start)} 주 · ${w.days}일`}
            className={`flex-1 h-5 rounded ${w.hit ? 'bg-letusBlue' : w.days > 0 ? 'bg-blue-100' : 'bg-gray-100'} ${w.current ? 'ring-2 ring-offset-1 ring-letusBlue/40' : ''}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-ui-caption text-gray-400">
        <span>8주 전</span>
        <span>이번 주</span>
      </div>

      <div className="mt-2 text-ui-body font-bold text-gray-700">
        {streak > 0 ? (
          <>
            🔥 {streak}주 연속 달성
            {!week.hit && <span className="font-normal text-gray-400"> · 이번 주를 채우면 {streak + 1}주</span>}
          </>
        ) : (
          <span className="font-normal text-gray-400">연속 달성 0주{bestStreak > 0 ? '' : ' · 목표를 채우면 연속이 쌓여요'}</span>
        )}
        {bestStreak > streak && <span className="font-normal text-gray-400"> · 최고 {bestStreak}주</span>}
      </div>
    </div>
  )
}
