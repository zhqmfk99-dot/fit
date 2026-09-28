import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { ALL_MENUS } from '../menuConfig.jsx'

export default function Sidebar({ isOpen, setIsOpen }) {
  const [openMenu, setOpenMenu] = useState(ALL_MENUS[0]?.id)
  const navigate = useNavigate()

  const toggleMenu = menuId => {
    if (!isOpen) setIsOpen(true)
    setOpenMenu(openMenu === menuId ? null : menuId)
  }

  return (
    <aside
      className={`hidden md:flex md:flex-col ${
        isOpen ? 'w-64' : 'w-[72px]'
      } bg-letusSidebar text-white h-screen fixed left-0 top-0 transition-all duration-300 z-50`}
    >
      <div className={`border-b border-gray-700/50 flex items-center min-h-[64px] ${isOpen ? 'p-5 justify-between' : 'justify-center py-5'}`}>
        {isOpen ? (
          <h1 className="text-xl cursor-pointer truncate w-full text-left" onClick={() => navigate('/workout/dashboard')}>
            <span className="font-extrabold tracking-tight">TRAINING</span>
          </h1>
        ) : (
          <h1 className="text-2xl leading-none cursor-pointer font-black tracking-tighter" onClick={() => navigate('/workout/dashboard')}>
            <span className="text-white">T</span>
          </h1>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {ALL_MENUS.map(menu => {
          const isMenuOpen = openMenu === menu.id
          return (
            <div key={menu.id} className="mb-1">
              <div className={`py-2 flex items-center text-gray-400 transition-colors ${isOpen ? 'px-3 justify-between' : 'justify-center'}`}>
                <div onClick={() => toggleMenu(menu.id)} className="flex items-center cursor-pointer hover:text-white" title={!isOpen ? menu.label : ''}>
                  <span className={`${isOpen ? 'mr-3' : ''} flex justify-center w-5`}>{menu.icon}</span>
                  {isOpen && <span className="text-sm font-semibold">{menu.label}</span>}
                </div>
                {isOpen && (
                  <div onClick={() => toggleMenu(menu.id)} className="cursor-pointer hover:text-white p-1">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                )}
              </div>

              {isOpen && isMenuOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {menu.children.map(child => (
                    <div key={child.id} className="pl-[38px] pr-4 py-1">
                      <NavLink
                        to={child.path}
                        className={({ isActive }) =>
                          `block px-3 py-1.5 text-[12px] font-medium transition-colors rounded-md ${
                            isActive ? 'bg-letusBlue text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {isOpen && (
        <div className="p-4 text-xs text-gray-600 font-medium border-t border-gray-800 mt-auto truncate text-center">
          <p>개인용 트레이닝 앱</p>
        </div>
      )}
    </aside>
  )
}
