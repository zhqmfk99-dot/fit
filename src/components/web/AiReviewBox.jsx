import { ClipboardCheck, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { useRoutineReview } from '../../hooks/useRoutineReview.js'
import { AI_GOALS, AI_LEVELS } from '../../lib/aiRoutine.js'

const VERDICT = {
  good: { label: '적절해요', badge: 'bg-emerald-50 text-emerald-700' },
  ok: { label: '아쉬워요', badge: 'bg-orange-50 text-orange-700' },
  poor: { label: '바꾸기 권장', badge: 'bg-red-50 text-red-600' },
}

// 루틴 점검 상자 (웹앱용 화면) — 루틴 등록 화면의 운동 목록 아래에 있다.
//  위: 규칙으로 계산한 균형 점검(즉시·무료) / 아래: AI가 운동별로 적절한지 판정(버튼을 눌렀을 때만 호출)
//  rows: 지금 화면의 운동 행들 / request: AI 초안의 조건(없으면 직접 만드는 루틴) / onReplace(oldName, patch): 제안한 운동으로 바꾸기
export default function AiReviewBox({ rows, request, onReplace }) {
  const r = useRoutineReview(rows, request)
  const hasRows = rows.some(x => x.exercise?.trim())

  return (
    <div className="bg-white border border-blue-100 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-ui-body font-bold text-gray-700">
        <ClipboardCheck className="w-4 h-4 text-letusBlue" />
        루틴 점검
      </div>

      {!hasRows ? (
        <p className="text-ui-caption text-gray-400 leading-relaxed">운동을 넣으면 균형을 점검해 드려요.</p>
      ) : r.checks.length === 0 ? (
        <p className="text-ui-caption font-bold text-emerald-700 leading-relaxed">균형 점검: 눈에 띄는 문제가 없어요.</p>
      ) : (
        <ul className="space-y-1.5">
          {r.checks.map((c, i) => (
            <li key={i} className={`flex items-start gap-1.5 text-ui-caption leading-relaxed ${c.level === 'warn' ? 'font-bold text-orange-700' : 'text-gray-500'}`}>
              {c.level === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-ui-body font-bold text-gray-700">
          <Sparkles className="w-4 h-4 text-letusBlue" />
          AI에게 운동 검토받기
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-ui-caption font-bold text-gray-500">
            목표
            <select value={r.goal} onChange={e => r.setGoal(e.target.value)} disabled={r.loading} className="border border-gray-300 rounded-[4px] px-2 min-h-[30px] text-ui-body font-normal text-gray-700 bg-white">
              <option value="">지정 안 함</option>
              {r.draftGoals.length > 1 && <option value="draft">{r.draftGoals.join(' + ')} (초안 조건)</option>}
              {AI_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-ui-caption font-bold text-gray-500">
            경력
            <select value={r.level} onChange={e => r.setLevel(e.target.value)} disabled={r.loading} className="border border-gray-300 rounded-[4px] px-2 min-h-[30px] text-ui-body font-normal text-gray-700 bg-white">
              <option value="">지정 안 함</option>
              {AI_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
        {r.skippedCount > 0 && <p className="text-ui-caption text-gray-400 leading-relaxed">운동 리스트에 없는 운동 {r.skippedCount}개는 검토에서 빠져요.</p>}
        {r.overLimit && <p className="text-ui-caption text-gray-400 leading-relaxed">앞의 12개 운동만 검토해요.</p>}
        {r.error && <p className="text-ui-caption font-bold text-red-500 leading-relaxed">{r.error}</p>}
        <button
          type="button"
          onClick={r.run}
          disabled={r.loading || !hasRows}
          className="w-full min-h-[34px] bg-letusBlue text-white text-ui-body font-bold rounded-[3px] disabled:opacity-50"
        >
          {r.loading ? '검토 중… (최대 30초)' : '운동 검토받기'}
        </button>
        <p className="text-ui-caption text-gray-400 leading-relaxed">운동 이름과 위 조건이 Google Gemini로 전송돼요. 참고용 의견이며 통증·부상은 전문가와 상담하세요.</p>
      </div>

      {r.result && (
        <div className="space-y-2">
          {r.result.overall && <div className="bg-slate-50 border border-gray-100 rounded-lg p-2.5 text-ui-body text-gray-700 leading-relaxed">{r.result.overall}</div>}
          {r.items.map(item => {
            const v = VERDICT[item.verdict]
            return (
              <div key={item.exercise} className="border border-gray-100 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ui-body font-bold text-gray-800 min-w-0 truncate">{item.exercise}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-ui-caption font-bold ${v.badge}`}>{v.label}</span>
                </div>
                <p className="text-ui-caption text-gray-600 leading-relaxed">{item.reason}</p>
                {item.alternatives.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="text-ui-caption font-bold text-gray-500">이런 운동은 어때요?</div>
                    {item.alternatives.map(a => (
                      <div key={a.name} className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-ui-body font-bold text-gray-800">{a.name}</div>
                          <div className="text-ui-caption text-gray-600 leading-relaxed">{a.reason}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onReplace(item.exercise, r.replacement(a.name))}
                          className="shrink-0 px-3 min-h-[26px] bg-letusBlue text-white text-ui-caption font-bold rounded-[3px]"
                        >
                          바꾸기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {r.result.remaining != null && <p className="text-ui-caption text-gray-400">오늘 검토 {r.result.remaining}회 남았어요.</p>}
        </div>
      )}
    </div>
  )
}
