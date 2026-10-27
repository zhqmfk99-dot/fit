import { useEffect, useState } from 'react'
import { useSettings } from '../../context/SettingsContext.jsx'
import { useBodyGoal } from '../../hooks/useBodyGoal.js'
import { GOAL_LIMITS, todayStr } from '../../lib/bodyGoal.js'

// 숫자 입력: 입력하는 동안은 글자 그대로 두고, 칸을 벗어나거나 Enter를 눌렀을 때 설정에 저장한다(비우면 목표 해제).
function NumberField({ title, desc, unit, value, min, max, onCommit }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const commit = () => {
    const t = String(text).trim()
    if (t === '') return onCommit(null)
    const n = Number(t)
    if (!Number.isFinite(n)) return setText(value ?? '')
    onCommit(n)
  }
  return (
    <div className="min-h-[52px] px-4 py-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-m-body font-bold text-gray-800">{title}</div>
        {desc && <div className="mt-0.5 text-m-caption text-gray-400 leading-relaxed">{desc}</div>}
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={min}
          max={max}
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="미설정"
          aria-label={title}
          className="w-24 border border-gray-300 rounded-[4px] px-3 py-2 text-m-body text-right bg-white focus:outline-none focus:border-letusBlue"
        />
        <span className="text-m-body text-gray-500">{unit}</span>
      </div>
    </div>
  )
}

// 설정의 "내 목표" 항목들 (PWA용 화면): 목표 체중·목표 체지방률·목표일(선택) + 지금 몸 상태. 웹앱은 components/web/GoalSettingsFields.jsx.
export default function GoalSettingsFields() {
  const { settings, update } = useSettings()
  const goal = useBodyGoal()
  const { weight, fat } = goal.current
  const stale = c => (c?.stale && c.daysAgo != null ? ` (${c.daysAgo}일 전 기록)` : c?.fromProfile ? ' (내 정보 값)' : '')
  const nowText = [weight && `체중 ${weight.value}kg${stale(weight)}`, fat && `체지방률 ${fat.value}%${stale(fat)}`].filter(Boolean).join(' · ')

  return (
    <>
      <NumberField title="목표 체중" unit="kg" min={GOAL_LIMITS.weightMin} max={GOAL_LIMITS.weightMax} value={settings.goalWeightKg} onCommit={v => update({ goalWeightKg: v })} />
      <NumberField title="목표 체지방률" unit="%" min={GOAL_LIMITS.fatMin} max={GOAL_LIMITS.fatMax} value={settings.goalBodyFatPct} onCommit={v => update({ goalBodyFatPct: v })} />
      <div className="min-h-[52px] px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-m-body font-bold text-gray-800">목표일 (선택)</div>
          <div className="mt-0.5 text-m-caption text-gray-400 leading-relaxed">정하면 "이 속도로 목표일 안에 닿는지"를 대시보드에서 알려줘요.</div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <input
            type="date"
            min={todayStr()}
            value={settings.goalDate}
            onChange={e => update({ goalDate: e.target.value })}
            aria-label="목표일"
            className="border border-gray-300 rounded-[4px] px-2 py-2 text-m-body bg-white focus:outline-none focus:border-letusBlue"
          />
          {settings.goalDate && (
            <button type="button" onClick={() => update({ goalDate: '' })} aria-label="목표일 지우기" className="w-8 h-8 text-gray-400 text-m-body active:text-gray-600">
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-3 text-m-caption text-gray-400 leading-relaxed">
        {nowText ? `지금 몸 상태(최근 신체 기록 평균): ${nowText}. ` : '신체 기록이 없어 지금 몸 상태를 알 수 없어요. 기록 화면에서 신체 기록을 추가해 주세요. '}
        목표는 대시보드의 진행 카드·신체 추이 그래프, AI 루틴 만들기의 목표 칩·섞는 비율에 쓰여요. 비워 두면 해당 목표는 쓰지 않아요.
      </div>
    </>
  )
}
