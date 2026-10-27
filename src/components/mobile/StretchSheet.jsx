import { useEffect, useMemo, useState } from 'react'
import { X, Check, ExternalLink, Timer } from 'lucide-react'
import { useBackHandler } from '../../context/BackNavigationContext.jsx'
import { useSettings } from '../../context/SettingsContext.jsx'
import { notifyRestEnd, unlockAudio } from '../../lib/restAlert.js'
import { youtubeHowToUrl } from '../../lib/exerciseGuide.js'
import { stretchPlan, planMinutes } from '../../lib/stretchGuide.js'

const COPY = {
  warmup: {
    title: '운동 전 워밍업',
    note: '오래 늘리는 스트레칭 대신, 몸을 움직이며 데우는 동적 동작이에요. 각 운동의 첫 세트는 가벼운 무게로 시작하면 더 좋아요.',
  },
  cooldown: {
    title: '운동 후 스트레칭',
    note: '반동 없이 천천히, 아프기 직전까지만 늘려요. 숨은 참지 말고 편하게 쉬어요.',
  },
}

// 워밍업·스트레칭 시트 (PWA용 화면) — 오늘 하는 운동의 부위에 맞는 동작을 보여 주고 동작별 타이머를 쓴다.
//   kind: 'warmup' | 'cooldown' / muscles: 오늘 운동들의 근육 슬러그
// 타이머는 종료 시각 기준으로 계산하고(화면이 잠깐 멈춰도 정확), 좌우를 따로 하는 동작은 한쪽이 끝나면 자동으로 반대쪽으로 넘어간다.
export default function StretchSheet({ kind, muscles, onClose }) {
  useBackHandler(onClose) // 뒤로가기(제스처)로 이 시트를 닫는다
  const { settings } = useSettings()
  const musclesKey = muscles.join(',') // 부모가 다시 그려져도 같은 근육이면 동작 목록(과 타이머)이 바뀌지 않게
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => stretchPlan(kind, muscles), [kind, musclesKey])
  const minutes = planMinutes(items)
  const [active, setActive] = useState(null) // { id, side, endAt }
  const [done, setDone] = useState(() => new Set())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [active])

  // 시간이 다 되면: 좌우 동작이면 반대쪽으로, 아니면 완료 표시. 진동·소리는 휴식 종료 알림과 같은 설정을 따른다.
  useEffect(() => {
    if (!active || now < active.endAt) return
    const it = items.find(i => i.id === active.id)
    notifyRestEnd({ vibrate: settings.restAlertVibrate, sound: settings.restAlertSound })
    if (it?.perSide && active.side === 0) {
      setActive({ id: it.id, side: 1, endAt: Date.now() + it.seconds * 1000 })
    } else {
      setDone(prev => new Set(prev).add(active.id))
      setActive(null)
    }
  }, [now, active, items, settings.restAlertVibrate, settings.restAlertSound])

  const start = it => {
    unlockAudio() // 소리를 낼 수 있게, 화면을 누른 이 시점에 오디오를 열어 둔다
    setNow(Date.now())
    setActive({ id: it.id, side: 0, endAt: Date.now() + it.seconds * 1000 })
  }

  const noMuscleHint = items.length <= 1 // 부위 동작이 없고 기본 동작(가벼운 유산소 또는 심호흡)뿐

  return (
    <div className="fixed inset-0 bg-black/40 z-[110] flex items-end justify-center backdrop-blur-sm fade-in">
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-[460px] max-h-[88vh] flex flex-col slide-up">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-m-title font-black text-gray-800">{COPY[kind].title}</h3>
            <div className="text-m-caption font-bold text-gray-400">{items.length}가지 · 약 {minutes}분</div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-400 active:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-m-caption text-gray-500 leading-relaxed">{COPY[kind].note}</p>
          {noMuscleHint && <p className="text-m-caption font-bold text-gray-400 leading-relaxed">오늘 운동의 부위 정보가 없어 기본 동작만 보여 줘요.</p>}

          {items.map((it, idx) => {
            const isActive = active?.id === it.id
            const isDone = done.has(it.id)
            const remaining = isActive ? Math.max(0, Math.ceil((active.endAt - now) / 1000)) : 0
            return (
              <div key={it.id} className={`rounded-xl border p-3 space-y-2 ${isActive ? 'border-letusBlue bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-m-caption font-black ${isDone ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-m-body font-bold text-gray-800">{it.name}</div>
                    <div className="text-m-caption font-bold text-gray-400">{it.perSide ? `한쪽 ${it.seconds}초씩 · 양쪽` : `${it.seconds >= 60 ? `${Math.round(it.seconds / 60)}분` : `${it.seconds}초`}`}</div>
                    <p className="mt-1 text-m-caption text-gray-600 leading-relaxed">{it.how}</p>
                  </div>
                </div>

                {isActive ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      {it.perSide && <div className="text-m-caption font-bold text-letusBlue">{active.side === 0 ? '첫 번째 쪽' : '반대쪽'}</div>}
                      <div className="text-2xl font-black text-letusBlue tabular-nums">{remaining}초</div>
                    </div>
                    <button type="button" onClick={() => setActive(null)} className="shrink-0 px-4 min-h-[36px] rounded-full bg-white border border-gray-300 text-m-caption font-bold text-gray-600 active:bg-gray-100">
                      중지
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => start(it)} className="flex items-center gap-1 px-3 min-h-[36px] rounded-full bg-letusBlue text-white text-m-caption font-bold active:bg-blue-600">
                      <Timer className="w-3.5 h-3.5" />
                      {isDone ? '다시 하기' : '타이머 시작'}
                    </button>
                    <a
                      href={youtubeHowToUrl(it.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 min-h-[36px] rounded-full bg-white border border-gray-200 text-m-caption font-bold text-gray-700 active:bg-gray-100"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      영상
                    </a>
                  </div>
                )}
              </div>
            )
          })}

          <p className="text-m-caption text-gray-400 leading-relaxed pb-1">참고용 안내예요. 통증이 있으면 바로 멈추고, 불편이 계속되면 전문가와 상담하세요. 영상은 유튜브 검색 결과가 새 창으로 열려요.</p>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="w-full min-h-[44px] rounded-xl bg-gray-100 text-gray-700 text-m-body font-bold active:bg-gray-200">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
