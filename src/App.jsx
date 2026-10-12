import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { WorkoutLogsProvider } from './context/WorkoutLogsContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import WorkoutDashboard from './pages/WorkoutDashboard.jsx'
import WorkoutLog from './pages/WorkoutLog.jsx'
import WorkoutRoutine from './pages/WorkoutRoutine.jsx'
import WorkoutExercises from './pages/WorkoutExercises.jsx'
import MobileMenuScreen from './pages/mobile/MobileMenuScreen.jsx'
import MobileLog from './pages/mobile/MobileLog.jsx'
import MobileRoutines from './pages/mobile/MobileRoutines.jsx'
import MobileExercises from './pages/mobile/MobileExercises.jsx'
import WorkoutSession from './pages/mobile/WorkoutSession.jsx'

// 데스크탑 화면 전용 — 사이드바/헤더가 있는 공용 레이아웃을 통과한다
function DesktopApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/workout/dashboard" replace />} />        <Route path="/workout/dashboard" element={<WorkoutDashboard />} />
        <Route path="/workout/log" element={<WorkoutLog />} />
        <Route path="/workout/routine" element={<WorkoutRoutine />} />
        <Route path="/workout/exercises" element={<WorkoutExercises />} />
      </Routes>
    </Layout>
  )
}

// 모바일 전용 화면 — 데스크탑 레이아웃을 아예 거치지 않는 독립 라우트 트리.
// 메인 메뉴(허브)에서 버튼을 눌러 각 화면으로 들어가고, 각 화면은 PageHeader의 뒤로가기로 메뉴에 복귀한다.
// 나중에 모바일 전용 화면이 늘어나면 여기에 <Route>만 추가하면 된다.
function MobileApp() {
  return (
    <div className="min-h-screen bg-letusBg">
      <Routes>
        <Route index element={<MobileMenuScreen />} />
        <Route path="dashboard" element={<WorkoutDashboard />} />
        <Route path="log" element={<MobileLog />} />
        <Route path="routine" element={<MobileRoutines />} />
        <Route path="exercises" element={<MobileExercises />} />
        <Route path="session" element={<WorkoutSession />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const { session, loading, recovery } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-gray-400">불러오는 중...</div>
  if (session && recovery) return <ResetPassword />
  if (!session) return <Login />

  // key로 사용자가 바뀌면 데이터 상태를 새로 불러온다
  return (
    <WorkoutLogsProvider key={session.user.id}>
      <Routes>
        <Route path="/mobile/*" element={<MobileApp />} />
        {/* 좁은 화면(휴대폰)에서 루트로 들어오면 모바일 메뉴로 보낸다 */}
        <Route path="/" element={window.innerWidth < 768 ? <Navigate to="/mobile" replace /> : <DesktopApp />} />
        <Route path="/*" element={<DesktopApp />} />
      </Routes>
    </WorkoutLogsProvider>
  )
}
