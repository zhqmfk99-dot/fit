import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { BODY_METRICS } from '../../lib/bodyMetrics.js'
import { useSettings } from '../../context/SettingsContext.jsx'

// 단위·크기가 비슷한 항목끼리 한 그래프로 묶고, 묶음별로 탭을 둔다. (키는 제외)
const GROUPS = [
  { id: 'weight', label: '몸무게 · 근육', unit: 'kg', keys: ['weightKg', 'muscleMassKg', 'skeletalMuscleKg', 'boneMassKg'] },
  { id: 'ratio', label: '체성분 비율', unit: '%', keys: ['bodyFatPct', 'musclePct', 'proteinPct', 'waterPct'] },
  { id: 'bmi', label: 'BMI', unit: '', keys: ['bmi'] },
  { id: 'bmr', label: 'BMR', unit: 'kcal', keys: ['bmr'] },
]

const COLORS = ['#059669', '#2563eb', '#f59e0b', '#ef4444']
// 설정의 내 목표(목표 체중·체지방률)를 그래프에 점선으로 그린다. 그 묶음에 해당 지표가 있을 때만.
const GOAL_LINES = [
  { key: 'weightKg', setting: 'goalWeightKg', label: '목표 체중' },
  { key: 'bodyFatPct', setting: 'goalBodyFatPct', label: '목표 체지방률' },
]

// PWA(모바일) 전용 신체 추이 그래프. (웹앱은 components/BodyTrendChart.jsx)
export default function BodyTrendChart({ records }) {
  const [groupId, setGroupId] = useState(GROUPS[0].id)
  const group = GROUPS.find(g => g.id === groupId)
  const metrics = group.keys.map(k => BODY_METRICS.find(m => m.key === k))
  const { settings } = useSettings()
  const goalLines = GOAL_LINES.filter(g => group.keys.includes(g.key) && settings[g.setting] != null).map(g => ({ ...g, value: settings[g.setting] }))
  const goalValues = goalLines.map(g => g.value)

  const data = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(r => metrics.some(m => r[m.key] != null))
    .map(r => ({ date: r.date.slice(5), ...Object.fromEntries(metrics.map(m => [m.key, r[m.key]])) }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-m-title font-bold text-slate-700 mb-3">
        신체 추이
        <span className="text-emerald-600"> · {group.label}</span>
        {group.unit && <span className="text-m-caption font-normal text-gray-400 ml-1">({group.unit})</span>}
      </h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {GROUPS.map(g => (
          <button
            key={g.id}
            onClick={() => setGroupId(g.id)}
            className={`px-3.5 py-2 rounded-full text-m-caption font-bold transition-colors ${
              g.id === groupId ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-m-body text-gray-400 font-bold text-center px-4">
          {records.length === 0 ? '신체 기록이 없습니다.' : `${group.label} 기록이 없습니다.`}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={goalValues.length ? [min => Math.floor(Math.min(min, ...goalValues) - 1), max => Math.ceil(Math.max(max, ...goalValues) + 1)] : ['auto', 'auto']} />
            <Tooltip />
            {metrics.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {goalLines.map(g => (
              <ReferenceLine key={g.key} y={g.value} stroke="#dc2626" strokeDasharray="5 4" label={{ value: `${g.label} ${g.value}`, position: 'insideTopRight', fontSize: 11, fill: '#dc2626' }} />
            ))}
            {metrics.map((m, i) => (
              <Line key={m.key} type="monotone" name={m.label} dataKey={m.key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
