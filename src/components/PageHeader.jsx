import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function PageHeader({ title, color = 'bg-blue-600' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobileRoute = location.pathname.startsWith('/mobile')

  return (
    // md 미만(휴대폰 폭)에서만 보이는 헤더라서 사실상 PWA 전용이다. 글자는 모바일 표준, 뒤로가기는 터치하기 쉬운 크기.
    <div className="px-4 pt-3 pb-2 md:hidden flex items-center gap-1">
      {isMobileRoute && (
        <button onClick={() => navigate('/mobile')} className="w-10 h-10 -ml-2 flex items-center justify-center text-slate-400 active:text-slate-600 transition-colors" aria-label="메뉴로 돌아가기">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <h2 className="text-m-title font-bold text-slate-800 flex items-center">
        <span className={`w-1.5 h-3.5 ${color} rounded-full mr-2`} />
        {title}
      </h2>
    </div>
  )
}
