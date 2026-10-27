import { useState } from 'react'
import { Sparkles, Undo2 } from 'lucide-react'
import { useAiRoutine } from '../hooks/useAiRoutine.js'
import { AI_INSTRUCTION_MAX, AI_REFINE_SUGGESTIONS } from '../lib/aiRoutine.js'

// AI 루틴 만들기로 만든 초안을 말로 고치는 상자 (PWA용 화면) — 루틴 등록 화면 안에 떠 있다.
//   request: 초안을 만들 때의 조건(draft.request) / rows: 지금 화면의 운동 행들
//   onApply(rows, summary): 수정 결과를 화면에 반영 / canUndo·onUndo: 방금 수정 되돌리기
export default function AiRefineBox({ request, rows, onApply, canUndo, onUndo }) {
  const { loading, error, refine } = useAiRoutine()
  const [text, setText] = useState('')

  const handleSubmit = async () => {
    const instruction = text.trim()
    if (!instruction) return
    const out = await refine(request, rows, instruction)
    if (out) {
      onApply(out.rows, out.summary)
      setText('')
    }
  }

  return (
    <div className="bg-white border border-blue-100 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-m-body font-bold text-gray-700">
          <Sparkles className="w-4 h-4 text-letusBlue" />
          AI에게 수정 요청
        </div>
        {canUndo && (
          <button type="button" onClick={onUndo} disabled={loading} className="flex items-center gap-1 text-m-caption font-bold text-gray-500 underline disabled:opacity-40">
            <Undo2 className="w-3.5 h-3.5" />
            방금 수정 되돌리기
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {AI_REFINE_SUGGESTIONS.map(s => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => setText(s)}
            className="px-2.5 min-h-[28px] rounded-full bg-gray-100 text-gray-500 text-m-caption font-bold active:bg-gray-200 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, AI_INSTRUCTION_MAX))}
        rows={2}
        disabled={loading}
        placeholder="예: 벤치프레스를 빼고 다른 가슴 운동을 넣어 주세요"
        className="w-full border border-gray-300 rounded-[4px] px-3 py-2 text-m-body focus:outline-none focus:border-letusBlue bg-white resize-none disabled:opacity-60"
      />
      {error && <p className="text-m-caption font-bold text-red-500 leading-relaxed">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-m-caption text-gray-400 leading-relaxed">무게는 바꾸지 않아요. 요청 문장이 Google Gemini로 전송돼요.</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="shrink-0 px-4 min-h-[36px] bg-letusBlue text-white text-m-body font-bold rounded-[3px] disabled:opacity-50"
        >
          {loading ? '수정 중… (최대 30초)' : '수정 요청'}
        </button>
      </div>
    </div>
  )
}
