import { useState, useMemo } from 'react'
import Model from 'react-body-highlighter'
import { computeMuscleFatigue, buildHighlighterData, FATIGUE_COLORS, MUSCLE_LABELS } from '../lib/muscleMap.js'

const LEGEND = [
  { label: '낮음', color: FATIGUE_COLORS[0] },
  { label: '보통', color: FATIGUE_COLORS[2] },
  { label: '높음', color: FATIGUE_COLORS[4] },
  { label: '기록 없음', color: '#e2e8f0' },
]

export default function MuscleFatigueMap({ logs, exercises, selectedMuscle, onSelectMuscle }) {
  const [view, setView] = useState('anterior')

  const data = useMemo(() => {
    const muscleFatigue = computeMuscleFatigue(logs, exercises)
    return buildHighlighterData(muscleFatigue)
  }, [logs, exercises])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-bold text-slate-700">부위별 피로도</h3>
        <span className="text-xs font-bold text-gray-400">최근일수록 크게 반영</span>
      </div>

      <div className="flex justify-center gap-1.5 mb-3">
        {[
          { id: 'anterior', label: '정면' },
          { id: 'posterior', label: '후면' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              view === t.id ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <Model
          type={view}
          data={data}
          highlightedColors={FATIGUE_COLORS}
          bodyColor="#e2e8f0"
          style={{ width: '9rem', padding: 0 }}
          onClick={({ muscle }) => onSelectMuscle(muscle)}
        />
      </div>

      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-xs text-gray-400 font-bold">{l.label}</span>
          </div>
        ))}
      </div>

      {selectedMuscle && (
        <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-50">
          <span className="text-sm font-bold text-letusBlue">
            {MUSCLE_LABELS[selectedMuscle] || selectedMuscle} 선택됨 — 아래 볼륨 추이에 반영
          </span>
          <button onClick={() => onSelectMuscle(null)} className="text-sm font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2">
            전체 보기
          </button>
        </div>
      )}
    </div>
  )
}
