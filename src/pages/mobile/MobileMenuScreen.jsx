import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, ListChecks, Tags, Play, LogOut, User } from 'lucide-react'
import ProfileModal from '../../components/ProfileModal.jsx'
import { useWorkoutLogs } from '../../context/WorkoutLogsContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import QuickWorkoutModal from './QuickWorkoutModal.jsx'
import { targetRepsOf } from '../../lib/progression.js'

const MENU_ITEMS = [
  { path: '/mobile/dashboard', label: '대시보드', icon: LayoutDashboard, iconBg: 'bg-blue-50', iconColor: 'text-letusBlue' },
  { path: '/mobile/log', label: '기록', icon: ClipboardList, iconBg: 'bg-orange-50', iconColor: 'text-letusOrange' },
  { path: '/mobile/routine', label: '루틴', icon: ListChecks, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
  { path: '/mobile/exercises', label: '운동 리스트', icon: Tags, iconBg: 'bg-teal-50', iconColor: 'text-teal-500' },
]

const getLocalDateString = d => {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// PWA(모바일) 메인 메뉴. 글자 크기는 모바일 표준(text-m-*).
export default function MobileMenuScreen() {
  const navigate = useNavigate()
  const { logs, setLogs, routines, setRoutines } = useWorkoutLogs()
  const { signOut } = useAuth()
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const todayDate = getLocalDateString(new Date())

  // "운동하기" 카드에 오늘 상태를 보여준다 — 예정된 루틴이 있으면 이름과 진행 현황, 없으면 안내
  const todayLogs = logs.filter(l => l.date === todayDate)
  const pendingToday = todayLogs.find(l => l.routineId && !l.isCompleted)
  const pendingRoutine = pendingToday ? routines.find(r => r.id === pendingToday.routineId) : null
  const sessionLogs = pendingToday ? todayLogs.filter(l => l.routineId === pendingToday.routineId) : []
  const startSubtitle = pendingToday
    ? `${pendingRoutine?.name || '오늘 루틴'} · ${sessionLogs.filter(l => l.isCompleted).length}/${sessionLogs.length} 완료`
    : todayLogs.some(l => l.isCompleted)
      ? '오늘 운동을 마쳤어요 · 추가 운동 시작'
      : '오늘 예정된 루틴이 없어요 · 바로 등록하고 시작'

  // "운동하기"는 캘린더를 거치지 않고 오늘 예정된 루틴으로 바로 진입하는 지름길이다.
  // 오늘 예정된 루틴이 없으면, 그 자리에서 즉석으로 운동을 등록하고 바로 시작할 수 있게 한다.
  const handleStartWorkout = () => {
    const pending = logs.find(l => l.date === todayDate && l.routineId && !l.isCompleted)
    if (pending) {
      navigate(`/mobile/session?routineId=${pending.routineId}&date=${todayDate}`)
    } else {
      setShowQuickModal(true)
    }
  }

  // 오늘 날짜로 해당 루틴의 로그를 만들고 바로 세션에 진입한다 — 기존 루틴 불러오기/즉석 등록 공통 처리
  const startRoutineToday = (routineId, exerciseList) => {
    const newLogs = exerciseList.map((ex, idx) => ({
      id: crypto.randomUUID(),
      date: todayDate,
      exercise: ex.exercise,
      routineId,
      targetSets: ex.sets,
      targetReps: targetRepsOf(ex),
      targetWeight: ex.weight,
      restSeconds: ex.restSeconds ?? 90,
      linkedToNext: !!ex.linkedToNext,
      performedSets: [],
      fatigue: null,
      isCompleted: false,
    }))
    setLogs(prev => [...prev, ...newLogs])
    setShowQuickModal(false)
    navigate(`/mobile/session?routineId=${routineId}&date=${todayDate}`)
  }

  // 이미 등록된 루틴을 오늘 그대로 불러와서 시작
  const handleStartExistingRoutine = routine => {
    startRoutineToday(routine.id, routine.exercises)
  }

  // 즉석 등록은 반복 요일이 없는 1회성 루틴으로 만든다 — 매주 반복되는 루틴을 만들고 싶으면 "루틴" 화면에서 따로 등록한다.
  const handleQuickStart = exerciseList => {
    const routineId = crypto.randomUUID()
    const newRoutine = { id: routineId, name: '즉석 운동', isActive: false, repeatDays: [], exercises: exerciseList }
    setRoutines(prev => [...prev, newRoutine])
    startRoutineToday(routineId, exerciseList)
  }

  return (
    <div className="min-h-screen px-4 pt-8 pb-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-800">TRAINING</h1>
          <p className="text-m-caption text-gray-400 font-bold mt-1">개인용 트레이닝 앱</p>
        </div>
        <div className="flex items-center -mr-2">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-1 text-m-caption font-bold text-gray-400 active:text-letusBlue px-2.5 h-10">
            <User className="w-4 h-4" />내 정보
          </button>
          <button onClick={signOut} className="flex items-center gap-1 text-m-caption font-bold text-gray-400 active:text-letusBlue px-2.5 h-10">
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      <button
        onClick={handleStartWorkout}
        className="w-full bg-letusBlue text-white rounded-2xl shadow-lg shadow-blue-500/20 py-5 px-5 flex items-center gap-3 active:scale-[0.98] transition-transform mb-4"
      >
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Play className="w-5 h-5 fill-white" />
        </div>
        <div className="text-left min-w-0">
          <div className="font-black text-m-title">운동하기</div>
          <div className="text-m-caption text-blue-100 font-bold mt-0.5 truncate">{startSubtitle}</div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {MENU_ITEMS.map(({ path, label, icon: Icon, iconBg, iconColor }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-h-[72px] flex items-center gap-3 active:scale-[0.97] transition-transform"
          >
            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <span className="text-m-body font-bold text-gray-700 text-left">{label}</span>
          </button>
        ))}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {showQuickModal && (
        <QuickWorkoutModal
          routines={routines}
          onClose={() => setShowQuickModal(false)}
          onStartRoutine={handleStartExistingRoutine}
          onStartCustom={handleQuickStart}
        />
      )}
    </div>
  )
}
