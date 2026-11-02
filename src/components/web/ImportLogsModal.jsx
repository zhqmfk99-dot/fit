import { X } from 'lucide-react'
import { useLogImport } from '../../hooks/useLogImport.js'

const SAMPLE = '날짜,운동,세트,횟수,무게(kg)\n2026-03-05,벤치프레스,1,8,60\n2026-03-05,벤치프레스,2,8,60'

// 운동 기록 가져오기 창 (웹앱용 화면) — CSV 파일·붙여넣은 표를 미리 보고 가져온다. 읽기 규칙은 lib/importData.js(웹앱과 공용). PWA는 components/mobile/ImportLogsModal.jsx.
export default function ImportLogsModal({ onClose }) {
  const imp = useLogImport()
  const p = imp.preview
  const s = p?.stats

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center backdrop-blur-sm p-4 fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[520px] max-h-[88vh] flex flex-col slide-up">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h3 className="text-ui-title font-black text-gray-800">운동 기록 가져오기</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 -mr-1 flex items-center justify-center text-gray-400 active:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {imp.done ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="text-ui-body font-bold text-emerald-700">
                운동 {imp.done.groups}개({imp.done.sets}세트)를 가져왔어요.
              </div>
              <div className="mt-1 text-ui-caption text-emerald-700/80 leading-relaxed">소모 칼로리는 지금 체중으로 계산해 채워져요. 점진 과부하·개인 기록·추이에 바로 쓰여요.</div>
            </div>
          ) : (
            <>
              <p className="text-ui-caption text-gray-500 leading-relaxed">
                이 앱에서 내려받은 CSV를 그대로 가져올 수 있고, 엑셀·구글 시트에서 표를 복사해 붙여넣어도 돼요. 첫 줄은 열 이름이고 <b>날짜·운동·횟수</b>는 꼭 있어야 해요(세트·무게(kg)는 선택).
                같은 날짜·같은 운동 기록이 이미 있으면 건너뛰어서 여러 번 가져와도 안전해요.
              </p>
              <pre className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-ui-caption text-gray-600 overflow-x-auto">{SAMPLE}</pre>

              <label className="inline-flex items-center min-h-[32px] px-4 rounded-full border border-gray-300 text-ui-body font-bold text-gray-700 active:bg-gray-50 cursor-pointer">
                CSV 파일 선택
                <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={e => imp.loadFile(e.target.files?.[0])} />
              </label>
              {imp.fileError && <div className="text-ui-caption font-bold text-red-500">{imp.fileError}</div>}

              <textarea
                value={imp.text}
                onChange={e => imp.setText(e.target.value)}
                rows={6}
                placeholder="여기에 표를 붙여넣어도 돼요"
                aria-label="가져올 운동 기록"
                className="w-full border border-gray-300 rounded-[4px] px-3 py-2 text-ui-caption font-mono bg-white focus:outline-none focus:border-letusBlue"
              />
              <button
                type="button"
                onClick={imp.runPreview}
                disabled={!imp.text.trim()}
                className="w-full min-h-[36px] rounded-xl bg-letusBlue text-white text-ui-body font-bold active:bg-blue-600 disabled:opacity-40"
              >
                미리보기
              </button>

              {p?.headerError && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-ui-caption font-bold text-red-600 leading-relaxed">{p.headerError}</div>}

              {p && !p.headerError && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="text-ui-body font-bold text-gray-800">
                      가져올 기록 {s.groups}개 · {s.sets}세트
                    </div>
                    {s.from && (
                      <div className="text-ui-caption text-gray-400">
                        {s.from} ~ {s.to}
                      </div>
                    )}
                    {s.duplicates > 0 && <div className="mt-1 text-ui-caption text-gray-500">이미 있는 기록 {s.duplicates}개는 건너뛰어요.</div>}
                  </div>
                  {s.weightMissing && <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-ui-caption font-bold text-orange-700 leading-relaxed">무게 열이 없어서 모두 맨몸(0kg)으로 가져와요.</div>}
                  {s.unknown.length > 0 && (
                    <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-ui-caption text-orange-700 leading-relaxed">
                      <b>운동 리스트에 없는 운동 {s.unknown.length}개</b>는 적은 이름 그대로 가져와요(부위·근육 통계에서는 빠져요): {s.unknown.join(', ')}
                    </div>
                  )}
                  {s.errorCount > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-ui-caption text-red-600 leading-relaxed">
                      <b>읽지 못한 줄 {s.errorCount}개</b>는 건너뛰어요.
                      <ul className="mt-1 space-y-0.5">
                        {s.errors.slice(0, 5).map(e => (
                          <li key={e.line}>
                            {e.line}줄: {e.message}
                          </li>
                        ))}
                      </ul>
                      {s.errorCount > 5 && <div className="mt-0.5">… 외 {s.errorCount - 5}개</div>}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={imp.commit}
                    disabled={s.groups === 0}
                    className="w-full min-h-[40px] rounded-xl bg-letusBlue text-white text-ui-body font-bold active:bg-blue-600 disabled:opacity-40"
                  >
                    {s.groups === 0 ? '가져올 기록이 없어요' : `${s.groups}개 기록 가져오기`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
