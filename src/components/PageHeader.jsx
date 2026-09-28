import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function PageHeader({ title, color = 'bg-blue-600' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobileRoute = location.pathname.startsWith('/mobile')

  return (
    <div className="px-4 pt-4 pb-2 md:hidden flex items-center gap-1">
      {isMobileRoute && (
        <button onClick={() => navigate('/mobile')} className="p-1 -ml-1 text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <h2 className="text-base font-bold text-slate-800 flex items-center">
        <span className={`w-1.5 h-3.5 ${color} rounded-full mr-2`} />
        {title}
      </h2>
    </div>
  )
}
