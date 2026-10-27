import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { kcalByDate } from '../../lib/calories.js'
import { useSettings } from '../../context/SettingsContext.jsx'

const pad = n => String(n).padStart(2, '0')
const daysAgoStr = n => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 웹앱 전용 소모 칼로리 추이 — 운동한 날의 하루 합계(저장된 값의 합)를 막대로 보여준다. (PWA는 components/mobile/CalorieTrendChart.jsx)
export default function CalorieTrendChart() {
  const { logs, bodyRecords, profileWeightKg } = useWorkoutLogs()
  const { settings } = useSettings()
  const data = kcalByDate(logs, bodyRecords, profileWeightKg, settings.calorieCalibration)
  const hasCompleted = logs.some(l => l.isCompleted && l.performedSets?.length)

  // 최근 7일 합계 (오늘 포함)
  const weekStart = daysAgoStr(6)
  const week = data.filter(d => d.date >= weekStart)
  const weekTotal = week.reduce((a, d) => a + d.kcal, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-bold text-slate-700">
          소모 칼로리 추이 <span className="text-xs font-normal text-gray-400">(kcal, 추정)</span>
        </h3>
        {week.length > 0 && <span className="text-xs font-bold text-orange-600">최근 7일 합계 약 {weekTotal.toLocaleString()} kcal</span>}
      </div>

      {data.length === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-sm text-gray-400 font-bold text-center">
          {hasCompleted ? '체중이 없어 칼로리를 계산하지 못했습니다. 신체 기록에 몸무게를 입력해 주세요.' : '완료한 운동이 없습니다.'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.map(d => ({ date: d.date.slice(5), kcal: d.kcal }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={v => [`약 ${v} kcal`, '소모 칼로리']} />
            <Bar dataKey="kcal" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
