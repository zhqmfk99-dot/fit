import { Dumbbell, LayoutDashboard, ClipboardList, ListChecks, Tags } from 'lucide-react'

export const ALL_MENUS = [
  {
    id: 'workout_menu',
    label: '운동',
    icon: <Dumbbell className="w-4 h-4" />,
    children: [
      { id: 'workout_dashboard', label: '대시보드', path: '/workout/dashboard', icon: LayoutDashboard },
      { id: 'workout_log', label: '기록', path: '/workout/log', icon: ClipboardList },
      { id: 'workout_routine', label: '루틴', path: '/workout/routine', icon: ListChecks },
      { id: 'workout_exercises', label: '운동 리스트', path: '/workout/exercises', icon: Tags },
    ],
  },
]
