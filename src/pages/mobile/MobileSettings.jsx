import { useEffect, useState } from 'react'
import { ChevronRight, LogOut, Smartphone } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import ProfileModal from '../../components/ProfileModal.jsx'
import { useAuth, MIN_PASSWORD_LENGTH } from '../../context/AuthContext.jsx'
import { useSettings, SETTING_LIMITS } from '../../context/SettingsContext.jsx'
import { supabase } from '../../lib/supabase.js'

const THEME_OPTIONS = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

function Section({ title, children }) {
  return (
    <section>
      <h3 className="px-1 mb-2 text-m-caption font-bold text-gray-500">{title}</h3>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">{children}</div>
    </section>
  )
}

// 한 줄: 왼쪽에 제목·설명, 오른쪽에 조작부(스위치·버튼·값). onClick을 주면 줄 전체가 눌린다.
function Row({ title, desc, right, onClick, tone }) {
  const body = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <div className={`text-m-body font-bold ${tone === 'danger' ? 'text-red-500' : 'text-gray-800'}`}>{title}</div>
        {desc && <div className="mt-0.5 text-m-caption text-gray-400 leading-relaxed">{desc}</div>}
      </div>
      {right}
    </>
  )
  const cls = 'w-full min-h-[52px] px-4 py-3 flex items-center gap-3'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:bg-gray-50`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

// 켜짐/꺼짐 스위치 (손잡이는 라이트·다크 모두 흰색)
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-letusBlue' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#ffffff] shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function MobileSettings() {
  const { user, signOut, updatePassword } = useAuth()
  const { settings, update, accountSync, saveError } = useSettings()
  const [showProfile, setShowProfile] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwMessage, setPwMessage] = useState({ text: '', ok: false })
  const [busy, setBusy] = useState(false)
  const [aiUsed, setAiUsed] = useState(null)

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

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

  const changeRest = delta => update({ defaultRestSeconds: settings.defaultRestSeconds + delta })

  const handleLogout = () => {
    if (confirm('로그아웃할까요?')) signOut()
  }

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

  const handleWithdraw = async () => {
    if (!confirm('정말 탈퇴할까요?\n운동 기록, 루틴, 운동 리스트 등 모든 데이터가 삭제되며 되돌릴 수 없습니다.')) return
    setBusy(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setBusy(false)
      return alert(error.message)
    }
    await signOut()
  }

  const inputClass = 'w-full border border-gray-300 rounded-[4px] px-3.5 py-2 text-m-body bg-white focus:outline-none focus:border-letusBlue'

  return (
    <div className="min-h-screen pb-10">
      <PageHeader title="설정" color="bg-slate-500" />
      <div className="px-4 pt-2 space-y-5">
        <Section title="화면">
          <div className="px-4 py-3">
            <div className="text-m-body font-bold text-gray-800">화면 테마</div>
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="화면 테마">
              {THEME_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={settings.theme === o.value}
                  onClick={() => update({ theme: o.value })}
                  className={`min-h-[40px] rounded-lg text-m-body font-bold transition-colors ${
                    settings.theme === o.value ? 'bg-letusBlue text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {settings.theme === 'system' && <div className="mt-2 text-m-caption text-gray-400">기기의 라이트/다크 설정을 따라가요.</div>}
          </div>
        </Section>

        <Section title="계정">
          <Row title="아이디" right={<span className="text-m-caption text-gray-400 truncate max-w-[55%]">{user?.email}</span>} />
          <Row title="내 정보" desc="이름·성별·나이·키·몸무게" onClick={() => setShowProfile(true)} right={<ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />} />
          <Row
            title="비밀번호 변경"
            onClick={() => {
              setShowPassword(v => !v)
              setPwMessage({ text: '', ok: false })
            }}
            right={<ChevronRight className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${showPassword ? 'rotate-90' : ''}`} />}
          />
          {showPassword && (
            <div className="px-4 py-3 space-y-2 bg-gray-50">
              <input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} placeholder={`새 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`} autoComplete="new-password" className={inputClass} />
              <input type="password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} placeholder="새 비밀번호 확인" autoComplete="new-password" className={inputClass} />
              {pwMessage.text && <p className={`text-m-caption font-bold ${pwMessage.ok ? 'text-emerald-600' : 'text-red-500'}`}>{pwMessage.text}</p>}
              <button type="button" onClick={handlePasswordChange} disabled={busy} className="w-full min-h-[40px] bg-letusBlue text-white text-m-body font-bold rounded-lg disabled:opacity-60">
                {busy ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}
          <Row title="로그아웃" onClick={handleLogout} right={<LogOut className="w-4 h-4 text-gray-400 shrink-0" />} />
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
                  className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 text-m-title font-bold active:bg-gray-200 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-12 text-center text-m-body font-bold text-gray-800">{settings.defaultRestSeconds}초</span>
                <button
                  type="button"
                  aria-label="휴식 시간 늘리기"
                  disabled={settings.defaultRestSeconds >= SETTING_LIMITS.restMax}
                  onClick={() => changeRest(SETTING_LIMITS.restStep)}
                  className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 text-m-title font-bold active:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            }
          />
          <Row title="운동 중 화면 꺼짐 방지" desc="운동 진행 화면이 켜져 있는 동안 화면이 자동으로 꺼지지 않게 해요. 배터리를 더 써요." right={<Switch checked={settings.keepAwake} onChange={v => update({ keepAwake: v })} label="운동 중 화면 꺼짐 방지" />} />
          <Row
            title="점진 과부하 자동 적용"
            desc="운동을 끝내면 수행 결과를 평가해서 다음 목표(세트·횟수·무게)를 루틴에 자동 반영해요. 끄면 직접 관리하고, 시작 화면의 추천은 보고 직접 적용할 수 있어요."
            right={<Switch checked={settings.autoProgression} onChange={v => update({ autoProgression: v })} label="점진 과부하 자동 적용" />}
          />
        </Section>

        <Section title="AI 루틴 만들기">
          <Row title="내 운동 기록 참고" desc="자주 한 운동과 최근 안 쓴 부위를 참고해요. 운동 이름·부위만 보내요." right={<Switch checked={settings.aiUseHistory} onChange={v => update({ aiUseHistory: v })} label="내 운동 기록 참고" />} />
          <Row title="체형 정보 함께 보내기" desc="키·몸무게·성별·나이를 참고해요. 건강 정보라 켠 때만 보내요." right={<Switch checked={settings.aiUseBody} onChange={v => update({ aiUseBody: v })} label="체형 정보 함께 보내기" />} />
          {aiUsed != null && <Row title="최근 24시간 사용" right={<span className="text-m-body font-bold text-gray-500">{aiUsed}회</span>} />}
        </Section>

        <Section title="앱 정보">
          <Row
            title="실행 상태"
            right={<span className={`text-m-caption font-bold ${standalone ? 'text-emerald-600' : 'text-gray-400'}`}>{standalone ? '앱으로 실행 중' : '브라우저에서 실행 중'}</span>}
          />
          <Row
            title="앱으로 설치하기"
            desc="홈 화면에서 주소창 없이 앱처럼 열려요"
            onClick={() => setShowInstall(v => !v)}
            right={<Smartphone className="w-4 h-4 text-gray-400 shrink-0" />}
          />
          {showInstall && (
            <div className="px-4 py-3 bg-gray-50 text-m-caption text-gray-500 leading-relaxed space-y-2">
              <p>
                <b className="text-gray-700">Android</b> — 크롬에서 열고 메뉴(⋮) → <b>앱 설치</b>(또는 홈 화면에 추가 → <b>설치</b>)를 고르세요. 기존에 만든 바로가기가 있으면 먼저 지우세요.
              </p>
              <p>
                <b className="text-gray-700">iPhone</b> — 사파리에서 열고 공유 버튼 → <b>홈 화면에 추가</b>를 고르세요. 크롬 등 다른 브라우저는 앱으로 추가되지 않아요.
              </p>
              <p>네이버 웨일처럼 앱 설치를 지원하지 않는 브라우저나 카카오톡 같은 앱 안의 브라우저에서는 주소창이 있는 바로가기만 만들어질 수 있어요.</p>
            </div>
          )}
        </Section>

        <Section title="위험 영역">
          <Row title="회원 탈퇴" desc="운동 기록, 루틴, 운동 리스트 등 모든 데이터가 삭제되며 되돌릴 수 없어요." tone="danger" onClick={handleWithdraw} />
        </Section>

        <p className="px-1 text-m-caption text-gray-400 leading-relaxed">
          {accountSync === true && '설정은 계정에 저장돼서 다른 기기에서도 같게 적용돼요.'}
          {accountSync === false && '설정이 이 기기에만 저장되고 있어요. (계정 저장은 supabase/user_settings.sql 실행 후 사용할 수 있어요)'}
        </p>
        {saveError && <p className="px-1 text-m-caption font-bold text-red-500">{saveError}</p>}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}
