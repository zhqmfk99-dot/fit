import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BODY_METRICS } from '../lib/bodyMetrics.js'

// 단위·크기가 비슷한 항목끼리 한 그래프로 묶는다. (키는 제외)
const GROUPS = [
  { title: '몸무게 · 근육 (kg)', keys: ['weightKg', 'muscleMassKg', 'skeletalMuscleKg', 'boneMassKg'] },
  { title: '체성분 비율 (%)', keys: ['bodyFatPct', 'musclePct', 'proteinPct', 'waterPct'] },
  { title: 'BMI', keys: ['bmi'] },
  { title: 'BMR (kcal)', keys: ['bmr'] },
]

const COLORS = ['#059669', '#2563eb', '#f59e0b', '#ef4444']

function GroupChart({ group, records }) {
  const metrics = group.keys.map(k => BODY_METRICS.find(m => m.key === k))
  const data = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(r => metrics.some(m => r[m.key] != null))
    .map(r => ({ date: r.date.slice(5), ...Object.fromEntries(metrics.map(m => [m.key, r[m.key]])) }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-base font-bold text-slate-700 mb-3">{group.title}</h3>
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 font-bold">기록이 없습니다.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
            <Tooltip />
            {metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {metrics.map((m, i) => (
              <Line key={m.key} type="monotone" name={m.label} dataKey={m.key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function BodyTrendChart({ records }) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-base font-bold text-slate-700 mb-3">신체 추이</h3>
        <div className="h-[120px] flex items-center justify-center text-sm text-gray-400 font-bold">신체 기록이 없습니다. 기록 화면에서 신체 기록을 추가해 주세요.</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {GROUPS.map(group => (
        <GroupChart key={group.title} group={group} records={records} />
      ))}
    </div>
  )
}
