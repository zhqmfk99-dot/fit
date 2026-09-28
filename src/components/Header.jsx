import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { ALL_MENUS } from '../menuConfig.jsx'

export default function Header({ isOpen, setIsOpen }) {
  const location = useLocation()

  let pageTitle = '트레이닝'
  ALL_MENUS.forEach(menu => {
    const matched = menu.children.find(c => c.path === location.pathname)
    if (matched) pageTitle = matched.label
  })

  return (
    <header className="hidden md:flex h-16 min-h-[64px] bg-gradient-to-r from-blue-50/70 to-white border-b border-gray-200 items-center px-6 sticky top-0 z-10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 mr-3 text-gray-400 hover:text-letusBlue hover:bg-blue-50 rounded transition-colors"
        title="사이드바 열기/접기"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h2 className="text-[19px] font-extrabold tracking-tight text-gray-800">{pageTitle}</h2>
    </header>
  )
}
