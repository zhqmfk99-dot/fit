import { useMemo } from 'react'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { buildWeeklyReport } from '../../lib/weeklyReport.js'
import { formatDuration } from '../../lib/workoutTime.js'

const md = s => s.slice(5).replace('-', '/')

// 지난주 대비 변화 표시: 지난주 값이 0이면 비교하지 않는다
function Delta({ cur, prev, unit = '' }) {
  if (!prev) return <span className="text-ui-caption text-gray-300">지난주 기록 없음</span>
  const diff = cur - prev
  if (diff === 0) return <span className="text-ui-caption text-gray-400">지난주와 같음</span>
  const pct = Math.round((Math.abs(diff) / prev) * 100)
  return (
    <span className={`text-ui-caption font-bold ${diff > 0 ? 'text-letusBlue' : 'text-gray-400'}`}>
      {diff > 0 ? '▲' : '▼'} {pct}%{unit && ` (${prev}${unit})`}
    </span>
  )
}

const HIGHLIGHT_STYLE = {
  up: { icon: '▲', color: 'text-letusBlue' },
  down: { icon: '▼', color: 'text-gray-500' },
  record: { icon: '🏆', color: 'text-gray-700' },
  warn: { icon: '!', color: 'text-orange-600' },
}

// 주간 리포트 카드 (웹앱용 화면) — 최근 7일을 그 전 7일과 비교한다. 계산은 lib/weeklyReport.js(웹앱과 공용)
export default function WeeklyReportCard() {
  const { logs, exercises } = useWorkoutLogs()
  const report = useMemo(() => buildWeeklyReport(logs, exercises), [logs, exercises])
  const { cur, prev } = report
  const maxSets = Math.max(1, ...report.groups.map(g => g.sets))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-ui-title font-bold text-gray-800">주간 리포트</h3>
        <span className="text-ui-caption text-gray-400">
          최근 7일 · {md(report.period.from)}~{md(report.period.to)}
        </span>
      </div>

      {report.empty ? (
        <p className="mt-3 text-ui-body text-gray-400 font-bold">최근 7일에 완료한 운동이 없어요. 운동을 하고 나면 요약이 여기에 나와요.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <div className="text-ui-caption text-gray-400 font-bold">운동한 날</div>
              <div className="text-ui-title font-black text-gray-800">{cur.sessions}<span className="text-ui-caption font-bold text-gray-400 ml-0.5">일</span></div>
              <Delta cur={cur.sessions} prev={prev.sessions} unit="일" />
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <div className="text-ui-caption text-gray-400 font-bold">총 세트</div>
              <div className="text-ui-title font-black text-gray-800">{cur.sets}<span className="text-ui-caption font-bold text-gray-400 ml-0.5">세트</span></div>
              <Delta cur={cur.sets} prev={prev.sets} unit="세트" />
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <div className="text-ui-caption text-gray-400 font-bold">총 볼륨</div>
              <div className="text-ui-title font-black text-gray-800">{cur.volume.toLocaleString()}<span className="text-ui-caption font-bold text-gray-400 ml-0.5">kg</span></div>
              <Delta cur={cur.volume} prev={prev.volume} />
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <div className="text-ui-caption text-gray-400 font-bold">운동 시간</div>
              <div className="text-ui-title font-black text-gray-800">{cur.seconds != null ? formatDuration(cur.seconds) : '-'}</div>
              {cur.seconds != null ? <Delta cur={cur.seconds} prev={prev.seconds} /> : <span className="text-ui-caption text-gray-300">시각 기록 없음</span>}
            </div>
          </div>
          {cur.kcal > 0 && <div className="mt-2 text-ui-caption font-bold text-orange-600">소모 칼로리 약 {cur.kcal.toLocaleString()} kcal (추정)</div>}

          <div className="mt-4">
            <div className="text-ui-body font-bold text-gray-700 mb-2">부위별 세트</div>
            <div className="space-y-1.5">
              {report.groups.map(g => (
                <div key={g.label} className="flex items-center gap-2">
                  <span className={`w-9 shrink-0 text-ui-caption font-bold ${g.sets === 0 ? 'text-gray-300' : 'text-gray-600'}`}>{g.label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-letusBlue" style={{ width: `${(g.sets / maxSets) * 100}%` }} />
                  </div>
                  <span className={`w-8 shrink-0 text-right text-ui-caption font-bold ${g.sets === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{g.sets}</span>
                </div>
              ))}
            </div>
          </div>

          {report.highlights.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {report.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-ui-body leading-snug">
                  <span className={`shrink-0 w-5 text-center font-black ${HIGHLIGHT_STYLE[h.kind].color}`}>{HIGHLIGHT_STYLE[h.kind].icon}</span>
                  <span className="text-gray-700">{h.text}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
