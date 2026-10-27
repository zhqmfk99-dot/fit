import { useBodyGoal } from '../../hooks/useBodyGoal.js'
import { describeMetric } from '../../lib/bodyGoal.js'

const md = s => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

// 목표 한 가지(체중 또는 체지방률)의 진행 블록
function Block({ label, unit, m, info }) {
  if (!m.cur) {
    return (
      <div className="rounded-lg bg-gray-50 px-3 py-3 text-ui-body text-gray-400 font-bold leading-relaxed">
        {label} 목표 {m.target}{unit} · 지금 값을 알 수 없어요. 기록 화면에서 신체 기록을 추가해 주세요.
      </div>
    )
  }
  const d = describeMetric(m, unit, info)
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ui-body font-bold text-gray-700">{label}</span>
        <span className={`text-ui-caption font-bold ${m.reached ? 'text-green-600' : 'text-gray-500'}`}>{d.remain}</span>
      </div>
      <div className="text-ui-title font-black text-gray-800">
        {m.cur.value}{unit}
        <span className="ml-1.5 text-ui-caption font-bold text-gray-400">→ 목표 {m.target}{unit}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} 목표 진행률`}>
        <div className="h-full rounded-full bg-letusBlue" style={{ width: `${m.pct}%` }} />
      </div>
      <div className="text-ui-caption text-gray-400 font-bold">진행 {m.pct}% (시작 {m.start}{unit})</div>
      <div className="text-ui-caption text-gray-500 leading-relaxed space-y-0.5">
        <div>{d.trend}</div>
        {d.project && <div className="font-bold text-gray-700">{d.project}</div>}
        {d.deadline && <div className="font-bold text-letusBlue">{d.deadline}</div>}
        {d.stale && <div className="font-bold text-orange-600">{d.stale}</div>}
      </div>
    </div>
  )
}

// 내 목표 진행 카드 (웹앱용 화면) — 설정의 목표 체중·체지방률과 신체 기록을 비교한다. 계산은 lib/bodyGoal.js(웹앱과 공용). 목표가 없으면 보이지 않는다.
export default function GoalProgressCard() {
  const goal = useBodyGoal()
  if (!goal.hasGoal) return null
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-ui-title font-bold text-gray-800">내 목표</h3>
        {goal.goalDate && <span className="text-ui-caption text-gray-400">목표일 {md(goal.goalDate)}</span>}
      </div>
      <div className="mt-3 space-y-2.5">
        {goal.weight && <Block label="체중" unit="kg" m={goal.weight} info={goal} />}
        {goal.fat && <Block label="체지방률" unit="%" m={goal.fat} info={goal} />}
      </div>
      <p className="mt-3 text-ui-caption text-gray-400 leading-relaxed">지금 값은 최근 30일 신체 기록 중 마지막 3개의 평균이에요. 추세는 날짜 기준으로 계산해서 기록이 불규칙해도 쓸 수 있어요. 추정이라 실제와 다를 수 있어요.</p>
    </div>
  )
}
