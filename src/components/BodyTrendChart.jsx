import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BODY_METRICS } from '../lib/bodyMetrics.js'

// 신체 기록(키 제외)의 항목을 골라서 날짜별 추이를 보여주는 그래프. 기본은 몸무게.
export default function BodyTrendChart({ records }) {
  const [metricKey, setMetricKey] = useState('weightKg')
  const metric = BODY_METRICS.find(m => m.key === metricKey)

  const data = records
    .filter(r => r[metricKey] != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ date: r.date.slice(5), value: r[metricKey] }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-base font-bold text-slate-700 mb-3">
        {metric.label} 추이
        {metric.unit && <span className="text-xs font-normal text-gray-400 ml-1">({metric.unit})</span>}
      </h3>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {BODY_METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetricKey(m.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
              m.key === metricKey ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 font-bold">
          {records.length === 0 ? '신체 기록이 없습니다. 기록 화면에서 신체 기록을 추가해 주세요.' : `${metric.label} 기록이 없습니다.`}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
            <Tooltip formatter={v => [`${v}${metric.unit}`, metric.label]} />
            <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
