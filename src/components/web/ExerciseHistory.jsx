import { useExerciseStats } from '../../hooks/useExerciseStats.js'
import { formatKg } from '../../lib/exerciseStats.js'
import { summarizePerformed } from '../../lib/progression.js'
import Sparkline from '../Sparkline.jsx'

const shortDate = d => d.slice(5).replace('-', '/')

// 운동별 내 기록 — 개인 기록(최고 무게·예상 1RM / 맨몸은 최대 횟수), 추이, 최근 기록. 계산은 lib/exerciseStats.js(웹앱·PWA 공용).
// 웹앱용 글자 크기(text-ui-*). PWA는 components/ExerciseHistory.jsx.
export default function ExerciseHistory({ name }) {
  const { sessions, pr, trend } = useExerciseStats(name)
  if (!sessions.length) return <p className="text-ui-body text-gray-400">아직 완료한 기록이 없어요.</p>

  const cards = []
  if (pr.weight) cards.push({ label: '최고 무게', value: formatKg(pr.weight.value), date: pr.weight.date })
  if (pr.e1rm) cards.push({ label: '예상 1RM', value: formatKg(pr.e1rm.value), date: pr.e1rm.date })
  if (pr.reps) cards.push({ label: '최대 횟수', value: `${pr.reps.value}회`, date: pr.reps.date })
  const recent = sessions.slice(-5).reverse()
  const first = trend.points[0]
  const last = trend.points[trend.points.length - 1]
  const fmt = v => (trend.kind === 'reps' ? `${v}회` : formatKg(v))

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {cards.map(c => (
          <div key={c.label} className="flex-1 min-w-0 rounded-lg bg-white border border-gray-200 px-3 py-2">
            <div className="text-ui-caption font-bold text-gray-400">{c.label}</div>
            <div className="text-ui-title font-black text-gray-800">{c.value}</div>
            <div className="text-ui-caption text-gray-400">{shortDate(c.date)}</div>
          </div>
        ))}
      </div>

      {trend.points.length >= 2 && (
        <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-ui-caption font-bold text-gray-400">
            <span>
              {trend.kind === 'reps' ? '최대 횟수 추이' : '예상 1RM 추이'} · 최근 {trend.points.length}회
            </span>
            <span className="shrink-0">
              {fmt(first.value)} → {fmt(last.value)}
            </span>
          </div>
          <Sparkline points={trend.points} className="text-letusBlue mt-1" />
        </div>
      )}

      <div>
        <div className="text-ui-caption font-bold text-gray-400 mb-1">최근 기록</div>
        <ul className="space-y-1">
          {recent.map(s => (
            <li key={s.id} className="flex items-baseline justify-between gap-2 text-ui-body">
              <span className="text-gray-400 shrink-0">{shortDate(s.date)}</span>
              <span className="font-bold text-gray-700 text-right">{summarizePerformed(s.sets)}</span>
            </li>
          ))}
        </ul>
      </div>
      {pr.e1rm && <p className="text-ui-caption text-gray-400 leading-relaxed">예상 1RM은 12회 이하 세트로 추정한 값이에요(직접 든 기록이 아니에요).</p>}
    </div>
  )
}
