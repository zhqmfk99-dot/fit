// PWA(모바일) 전용 요약 카드 — 아이콘, 항목, 값을 세로로 쌓는다. (웹앱은 components/StatCard.jsx의 horizontal 모드)
export default function StatCard({ label, value, unit, icon: Icon, color = 'text-blue-600' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-1.5 min-w-0">
      {Icon && (
        <div className={`w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <span className="text-m-caption font-bold text-gray-400 truncate">{label}</span>
      <span className="text-m-title font-black text-slate-800 truncate">
        {value}
        {unit && <span className="text-m-caption font-normal text-gray-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}
