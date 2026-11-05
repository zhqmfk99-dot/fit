import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { WorkoutLogsProvider } from './context/WorkoutLogsContext.jsx'
import { PointsProvider } from './context/PointsContext.jsx'
import { SettingsProvider, useIsDark, useIsWebDark, useSystemDark, LAST_THEME_KEY, LAST_WEB_THEME_KEY } from './context/SettingsContext.jsx'
import { BackNavigationProvider } from './context/BackNavigationContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import WorkoutDashboard from './pages/WorkoutDashboard.jsx'
import WorkoutLog from './pages/WorkoutLog.jsx'
import WorkoutRoutine from './pages/WorkoutRoutine.jsx'
import WorkoutExercises from './pages/WorkoutExercises.jsx'
import WorkoutSettings from './pages/WorkoutSettings.jsx'
import WorkoutSessionWeb from './pages/WorkoutSession.jsx'
import WorkoutPet from './pages/WorkoutPet.jsx'
import MobileDashboard from './pages/mobile/MobileDashboard.jsx'
import MobileMenuScreen from './pages/mobile/MobileMenuScreen.jsx'
import MobileLog from './pages/mobile/MobileLog.jsx'
import MobileRoutines from './pages/mobile/MobileRoutines.jsx'
import MobileExercises from './pages/mobile/MobileExercises.jsx'
import WorkoutSession from './pages/mobile/WorkoutSession.jsx'
import MobileSettings from './pages/mobile/MobileSettings.jsx'
import MobilePet from './pages/mobile/MobilePet.jsx'

// 설정의 테마(라이트/다크/시스템)를 <html>에 반영한다. PWA(/mobile)는 `theme`, 웹앱(데스크탑)은 `webTheme`(기본 라이트)을 쓰고,
// 화면을 떠나면 뗀다. 상태 표시줄 색(theme-color)도 같이 맞춘다.
function useThemeClass(dark) {
  useEffect(() => {
    const root = document.documentElement
    const meta = document.querySelector('meta[name="theme-color"]')
    const original = meta?.getAttribute('content')
    root.classList.toggle('dark', dark)
    if (meta && dark) meta.setAttribute('content', '#0f172a')
    return () => {
      root.classList.remove('dark')
      if (meta && original) meta.setAttribute('content', original)
    }
  }, [dark])
}

// 로그인 전 화면(로그인·비밀번호 재설정·불러오는 중)의 테마: 설정을 아직 못 불러오니 마지막으로 쓴 테마를 따른다(없으면 시스템).
// 휴대폰 화면(PWA)에서만 적용하고 데스크탑 웹앱의 로그인은 항상 라이트다.
function AuthTheme() {
  const systemDark = useSystemDark()
  const mobile = window.innerWidth < 768 || window.location.pathname.startsWith('/mobile')
  // 휴대폰 화면은 PWA 테마(기본 시스템), 데스크탑은 웹앱 테마(기본 라이트)를 마지막으로 쓴 값으로 따른다
  let theme = mobile ? 'system' : 'light'
  try {
    theme = localStorage.getItem(mobile ? LAST_THEME_KEY : LAST_WEB_THEME_KEY) || theme
  } catch {
    /* 저장소를 못 쓰면 기본값 */
  }
  useThemeClass(theme === 'dark' || (theme === 'system' && systemDark))
  return null
}

// 데스크탑 화면 전용 — 사이드바/헤더가 있는 공용 레이아웃을 통과한다
function DesktopApp() {
  useThemeClass(useIsWebDark()) // 웹앱 테마 설정(기본 라이트)
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/workout/dashboard" replace />} />        <Route path="/workout/dashboard" element={<WorkoutDashboard />} />
        <Route path="/workout/log" element={<WorkoutLog />} />
        <Route path="/workout/routine" element={<WorkoutRoutine />} />
        <Route path="/workout/exercises" element={<WorkoutExercises />} />
        <Route path="/workout/settings" element={<WorkoutSettings />} />
        <Route path="/workout/session" element={<WorkoutSessionWeb />} />
        <Route path="/workout/pet" element={<WorkoutPet />} />
      </Routes>
    </Layout>
  )
}

// 모바일 전용 화면 — 데스크탑 레이아웃을 아예 거치지 않는 독립 라우트 트리.
// 메인 메뉴(허브)에서 버튼을 눌러 각 화면으로 들어가고, 각 화면은 PageHeader의 뒤로가기로 메뉴에 복귀한다.
// 나중에 모바일 전용 화면이 늘어나면 여기에 <Route>만 추가하면 된다.
function MobileApp() {
  useThemeClass(useIsDark())
  return (
    // 뒤로가기는 이전 화면이 아니라 항상 상위 화면으로 (context/BackNavigationContext.jsx)
    <BackNavigationProvider>
      <div className="min-h-screen bg-letusBg">
        <Routes>
          <Route index element={<MobileMenuScreen />} />
          <Route path="dashboard" element={<MobileDashboard />} />
          <Route path="log" element={<MobileLog />} />
          <Route path="routine" element={<MobileRoutines />} />
          <Route path="exercises" element={<MobileExercises />} />
          <Route path="session" element={<WorkoutSession />} />
          <Route path="settings" element={<MobileSettings />} />
          <Route path="pet" element={<MobilePet />} />
        </Routes>
      </div>
    </BackNavigationProvider>
  )
}

export default function App() {
  const { session, loading, recovery } = useAuth()

  if (loading)
    return (
      <>
        <AuthTheme />
        <div className="min-h-screen flex items-center justify-center text-sm font-bold text-gray-400">불러오는 중...</div>
      </>
    )
  if (session && recovery)
    return (
      <>
        <AuthTheme />
        <ResetPassword />
      </>
    )
  if (!session)
    return (
      <>
        <AuthTheme />
        <Login />
      </>
    )

  // key로 사용자가 바뀌면 데이터 상태를 새로 불러온다
  return (
    <SettingsProvider key={session.user.id}>
      <WorkoutLogsProvider>
        <PointsProvider>
          <Routes>
            <Route path="/mobile/*" element={<MobileApp />} />
            {/* 좁은 화면(휴대폰)에서 루트로 들어오면 모바일 메뉴로 보낸다 */}
            <Route path="/" element={window.innerWidth < 768 ? <Navigate to="/mobile" replace /> : <DesktopApp />} />
            <Route path="/*" element={<DesktopApp />} />
          </Routes>
        </PointsProvider>
      </WorkoutLogsProvider>
    </SettingsProvider>
  )
}
