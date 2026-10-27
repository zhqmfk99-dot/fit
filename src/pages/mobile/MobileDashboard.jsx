import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CalendarCheck, TrendingUp, Flame } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import StatCard from '../../components/mobile/StatCard.jsx'
import MuscleFatigueMap from '../../components/mobile/MuscleFatigueMap.jsx'
import BodyTrendChart from '../../components/mobile/BodyTrendChart.jsx'
import CalorieTrendChart from '../../components/mobile/CalorieTrendChart.jsx'
import WeeklyReportCard from '../../components/mobile/WeeklyReportCard.jsx'
import GoalProgressCard from '../../components/mobile/GoalProgressCard.jsx'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { totalVolume } from '../../lib/workoutMetrics.js'
import { exercisesForMuscle, MUSCLE_LABELS } from '../../lib/muscleMap.js'

function buildVolumeTrend(logs) {
  const byDate = {}
  logs.forEach(l => {
    byDate[l.date] = (byDate[l.date] || 0) + totalVolume(l)
  })
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, volume]) => ({ date: date.slice(5), volume }))
}

// PWA(모바일) 전용 대시보드. 글자 크기는 모바일 표준(text-m-*)을 쓴다. (웹앱은 pages/WorkoutDashboard.jsx)
export default function MobileDashboard() {
  const { logs, exercises, bodyRecords } = useWorkoutLogs()
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  // 아직 완료 전인 "예정" 기록은 실제로 한 게 아니라서 통계에서 제외한다
  const completedLogs = logs.filter(l => l.isCompleted)
  const sessionCount = new Set(completedLogs.map(l => l.date)).size
  const avgFatigue = completedLogs.length ? (completedLogs.reduce((sum, l) => sum + l.fatigue, 0) / completedLogs.length).toFixed(1) : '0.0'
  const totalVolumeSum = completedLogs.reduce((sum, l) => sum + totalVolume(l), 0)

  // 인체도에서 부위를 선택하면, 그 부위를 쓰는 운동만 걸러서 볼륨 추이를 다시 그린다
  const targetExercises = selectedMuscle ? exercisesForMuscle(selectedMuscle, exercises) : null
  const trendLogs = targetExercises ? completedLogs.filter(l => targetExercises.includes(l.exercise)) : completedLogs
  const trend = buildVolumeTrend(trendLogs)

  return (
    <div>
      <PageHeader title="대시보드" color="bg-letusBlue" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="운동 횟수" value={sessionCount} unit="회" icon={CalendarCheck} color="text-blue-600" />
          <StatCard label="총 볼륨" value={totalVolumeSum.toLocaleString()} unit="kg" icon={TrendingUp} color="text-indigo-600" />
          <StatCard label="평균 피로도" value={avgFatigue} unit="/5" icon={Flame} color="text-orange-500" />
        </div>

        <WeeklyReportCard />
        <GoalProgressCard />

        <BodyTrendChart records={bodyRecords} />

        <CalorieTrendChart />

        <MuscleFatigueMap logs={logs} exercises={exercises} selectedMuscle={selectedMuscle} onSelectMuscle={setSelectedMuscle} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-m-title font-bold text-slate-700 mb-3">
            볼륨 추이
            {selectedMuscle && <span className="text-letusBlue"> · {MUSCLE_LABELS[selectedMuscle] || selectedMuscle}</span>}
          </h3>
          {targetExercises && targetExercises.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-m-body text-gray-400 font-bold text-center px-4">이 부위에 해당하는 운동 기록이 없습니다.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="volume" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
