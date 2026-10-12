// horizontal: 아이콘 · 항목 · 값을 한 줄로 배치 (웹앱 대시보드용). 기본(세로형)은 PWA가 그대로 쓴다.
export default function StatCard({ label, value, unit, icon: Icon, color = 'text-blue-600', horizontal = false }) {
  const valueEl = (
    <span className="text-lg font-black text-slate-800 truncate">
      {value}
      {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
    </span>
  )

  if (horizontal) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <span className="text-sm font-bold text-gray-400 truncate">{label}</span>
        <div className="ml-auto pl-2 shrink-0">{valueEl}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-2">
      {Icon && (
        <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <span className="text-xs font-bold text-gray-400 truncate">{label}</span>
      {valueEl}
    </div>
  )
}
