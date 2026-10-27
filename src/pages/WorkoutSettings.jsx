import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import ProfileModal from '../components/web/ProfileModal.jsx'
import { useAuth, MIN_PASSWORD_LENGTH } from '../context/AuthContext.jsx'
import { useSettings, SETTING_LIMITS } from '../context/SettingsContext.jsx'
import { supabase } from '../lib/supabase.js'
import { EQUIPMENT_OPTIONS } from '../lib/muscleMap.js'
import { useCalorieSettings } from '../hooks/useCalorieSettings.js'
import { useDataExport } from '../hooks/useDataExport.js'

function Section({ title, children }) {
  return (
    <section>
      <h3 className="px-1 mb-1.5 text-ui-body font-bold text-gray-500">{title}</h3>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-gray-100 overflow-hidden">{children}</div>
    </section>
  )
}

// 한 줄: 왼쪽에 제목·설명, 오른쪽에 조작부. onClick을 주면 줄 전체가 눌린다.
function Row({ title, desc, right, onClick }) {
  const body = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-ui-title font-bold text-gray-800">{title}</div>
        {desc && <div className="mt-0.5 text-ui-body text-gray-400 leading-relaxed">{desc}</div>}
      </div>
      {right}
    </>
  )
  const cls = 'w-full min-h-[48px] px-4 py-3 flex items-center gap-4'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-gray-50`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${checked ? 'bg-letusBlue' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-[#ffffff] shadow transition-transform ${checked ? 'translate-x-[18px]' : ''}`} />
    </button>
  )
}

// 웹앱(데스크탑) 설정 화면. 설정은 PWA와 같은 계정 설정(profiles.settings)을 함께 쓴다 — 여기서 바꾸면 모바일에도 반영된다.
// 운동 진행 화면(휴식 알림·화면 꺼짐 방지 등)과 다크 모드는 PWA 전용이라 여기에는 없다. (PWA는 MobileSettings.jsx)
export default function WorkoutSettings() {
  const { user } = useAuth()
  const { settings, update, accountSync, saveError } = useSettings()
  const [showProfile, setShowProfile] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwMessage, setPwMessage] = useState({ text: '', ok: false })
  const [busy, setBusy] = useState(false)
  const [aiUsed, setAiUsed] = useState(null)
  const cal = useCalorieSettings()
  const exp = useDataExport()
  const [cmp, setCmp] = useState({ app: '', watch: '' })
  const { updatePassword } = useAuth()

  // 최근 24시간 AI 루틴 만들기 사용 횟수 (ai_usage 테이블이 없으면 표시하지 않는다)
  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'routine')
      .gte('created_at', since)
      .then(({ count, error }) => {
        if (!error && count != null) setAiUsed(count)
      })
  }, [])

  const handlePasswordChange = async () => {
    if (pw.next.length < MIN_PASSWORD_LENGTH) return setPwMessage({ text: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`, ok: false })
    if (pw.next !== pw.confirm) return setPwMessage({ text: '비밀번호가 서로 다릅니다.', ok: false })
    setBusy(true)
    const { error } = await updatePassword(pw.next)
    setBusy(false)
    if (error) return setPwMessage({ text: error.message, ok: false })
    setPw({ next: '', confirm: '' })
    setPwMessage({ text: '비밀번호를 변경했어요.', ok: true })
  }

  const changeRest = delta => update({ defaultRestSeconds: settings.defaultRestSeconds + delta })
  const inputClass = 'w-full max-w-[280px] border border-gray-300 rounded-[4px] px-3 py-1.5 text-ui-title bg-white focus:outline-none focus:border-letusBlue'

  return (
    <div>
      <PageHeader title="설정" color="bg-slate-500" />
      <div className="p-4 space-y-5 max-w-[760px]">
        <Section title="계정">
          <Row title="아이디" right={<span className="text-ui-body text-gray-400">{user?.email}</span>} />
          <Row title="내 정보" desc="이름·성별·나이·키·몸무게, 회원 탈퇴" onClick={() => setShowProfile(true)} right={<span className="text-ui-body font-bold text-letusBlue">열기</span>} />
          <Row
            title="비밀번호 변경"
            onClick={() => {
              setShowPassword(v => !v)
              setPwMessage({ text: '', ok: false })
            }}
            right={<span className="text-ui-body font-bold text-letusBlue">{showPassword ? '접기' : '변경'}</span>}
          />
          {showPassword && (
            <div className="px-4 py-3 space-y-2 bg-gray-50">
              <input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} placeholder={`새 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`} autoComplete="new-password" className={inputClass} />
              <input type="password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} placeholder="새 비밀번호 확인" autoComplete="new-password" className={inputClass} />
              {pwMessage.text && <p className={`text-ui-body font-bold ${pwMessage.ok ? 'text-emerald-600' : 'text-red-500'}`}>{pwMessage.text}</p>}
              <button type="button" onClick={handlePasswordChange} disabled={busy} className="px-4 py-1.5 bg-letusBlue text-white text-ui-title font-bold rounded-lg disabled:opacity-60">
                {busy ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}
        </Section>

        <Section title="내 운동기구">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-ui-title font-bold text-gray-800">쓸 수 있는 기구</div>
              {settings.myEquipment.length > 0 && (
                <button type="button" onClick={() => update({ myEquipment: [] })} className="shrink-0 text-ui-body font-bold text-gray-500 underline">
                  모두 해제
                </button>
              )}
            </div>
            <div className="mt-0.5 text-ui-body text-gray-400 leading-relaxed">
              골라 두면 AI 루틴 만들기의 "사용할 장비"에 자동으로 선택돼요. 맨몸 운동은 기구가 필요 없어서 항상 포함돼요. 아무것도 안 고르면 모든 기구에서 골라요.
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="내 운동기구">
              {EQUIPMENT_OPTIONS.filter(o => o !== '맨몸').map(o => {
                const on = settings.myEquipment.includes(o)
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ myEquipment: on ? settings.myEquipment.filter(e => e !== o) : [...settings.myEquipment, o] })}
                    className={`px-3 py-1 rounded-full text-ui-body font-bold transition-colors ${on ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {o}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="운동">
          <Row
            title="기본 휴식 시간"
            desc="루틴에 휴식을 따로 적지 않은 운동에 쓰는 세트 간 휴식"
            right={
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="휴식 시간 줄이기"
                  disabled={settings.defaultRestSeconds <= SETTING_LIMITS.restMin}
                  onClick={() => changeRest(-SETTING_LIMITS.restStep)}
                  className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-ui-title font-bold hover:bg-gray-200 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-12 text-center text-ui-title font-bold text-gray-800">{settings.defaultRestSeconds}초</span>
                <button
                  type="button"
                  aria-label="휴식 시간 늘리기"
                  disabled={settings.defaultRestSeconds >= SETTING_LIMITS.restMax}
                  onClick={() => changeRest(SETTING_LIMITS.restStep)}
                  className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-ui-title font-bold hover:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            }
          />
          <Row
            title="점진 과부하 자동 적용"
            desc="운동 진행(모바일 앱)에서 운동을 끝내면 목표 달성 여부와 휴식·속도를 보고 다음에 무게를 올릴지 유지할지 정해서 루틴에 자동 반영해요."
            right={<Switch checked={settings.autoProgression} onChange={v => update({ autoProgression: v })} label="점진 과부하 자동 적용" />}
          />
        </Section>

        <Section title="소모 칼로리 보정">
          <Row
            title="보정 계수"
            desc="앱이 보여주는 소모 칼로리가 시계·운동 앱보다 늘 낮으면 올리고, 높으면 내려요. 새로 저장되는 기록부터 적용돼요."
            right={
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" aria-label="보정 계수 줄이기" disabled={cal.value <= cal.limits.calMin} onClick={() => cal.step(-cal.limits.calStep)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-ui-title font-bold hover:bg-gray-200 disabled:opacity-40">
                  −
                </button>
                <span className="w-14 text-center text-ui-title font-bold text-gray-800">×{cal.value.toFixed(2)}</span>
                <button type="button" aria-label="보정 계수 늘리기" disabled={cal.value >= cal.limits.calMax} onClick={() => cal.step(cal.limits.calStep)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-ui-title font-bold hover:bg-gray-200 disabled:opacity-40">
                  +
                </button>
              </div>
            }
          />
          <div className="px-4 py-3 space-y-2">
            <div className="text-ui-title font-bold text-gray-800">시계 값과 비교해서 맞추기</div>
            <div className="text-ui-body text-gray-400 leading-relaxed">같은 운동에 대해 앱이 보여준 값과 시계(또는 다른 운동 앱)가 보여준 값을 넣으면 계수를 계산해 줘요.</div>
            <div className="flex items-center gap-2">
              <input type="number" value={cmp.app} onChange={e => setCmp({ ...cmp, app: e.target.value })} placeholder="앱 값 (kcal)" aria-label="앱이 보여준 칼로리" className="w-36 border border-gray-300 rounded-[4px] px-3 py-1.5 text-ui-title bg-white focus:outline-none focus:border-letusBlue" />
              <input type="number" value={cmp.watch} onChange={e => setCmp({ ...cmp, watch: e.target.value })} placeholder="시계 값 (kcal)" aria-label="시계가 보여준 칼로리" className="w-36 border border-gray-300 rounded-[4px] px-3 py-1.5 text-ui-title bg-white focus:outline-none focus:border-letusBlue" />
              <button type="button" onClick={() => cal.fitFromWatch(cmp.app, cmp.watch) && setCmp({ app: '', watch: '' })} className="px-4 py-1.5 bg-letusBlue text-white text-ui-title font-bold rounded-lg">
                계수 계산해서 적용
              </button>
            </div>
          </div>
          <Row title="과거 기록 다시 계산" desc={`완료한 기록 ${cal.doneCount}건의 저장된 칼로리를 지금 계수로 다시 계산해 덮어써요.`} onClick={cal.recompute} right={<span className="text-ui-body font-bold text-letusBlue">실행</span>} />
          {cal.message && <div className="px-4 py-3 text-ui-body font-bold text-letusBlue bg-blue-50">{cal.message}</div>}
        </Section>

        <Section title="AI 루틴 만들기">
          <Row title="내 운동 기록 참고" desc="자주 한 운동과 최근 안 쓴 부위를 참고해요. 운동 이름·부위만 보내요." right={<Switch checked={settings.aiUseHistory} onChange={v => update({ aiUseHistory: v })} label="내 운동 기록 참고" />} />
          <Row title="체형 정보 함께 보내기" desc="키·몸무게·성별·나이를 참고해요. 건강 정보라 켠 때만 보내요." right={<Switch checked={settings.aiUseBody} onChange={v => update({ aiUseBody: v })} label="체형 정보 함께 보내기" />} />
          {aiUsed != null && <Row title="최근 24시간 사용" right={<span className="text-ui-title font-bold text-gray-500">{aiUsed}회</span>} />}
        </Section>

        <Section title="데이터">
          <Row title="운동 기록 내려받기" desc={`완료한 운동 ${exp.logCount}세트를 CSV 파일로 저장해요.`} onClick={exp.exportLogs} right={<span className="text-ui-body font-bold text-letusBlue">내려받기</span>} />
          <Row title="신체 기록 내려받기" desc={`신체 기록 ${exp.bodyCount}건을 CSV 파일로 저장해요.`} onClick={exp.exportBody} right={<span className="text-ui-body font-bold text-letusBlue">내려받기</span>} />
          {exp.message && <div className="px-4 py-3 text-ui-body font-bold text-letusBlue bg-blue-50">{exp.message}</div>}
        </Section>

        <p className="px-1 text-ui-body text-gray-400 leading-relaxed">
          {accountSync === true && '설정은 계정에 저장돼서 모바일 앱과 같게 적용돼요. 휴식 알림·화면 꺼짐 방지·다크 모드는 모바일 앱 설정에서 바꿔요.'}
          {accountSync === false && '설정이 이 기기에만 저장되고 있어요. (계정 저장은 supabase/user_settings.sql 실행 후 사용할 수 있어요)'}
        </p>
        {saveError && <p className="px-1 text-ui-body font-bold text-red-500">{saveError}</p>}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}
