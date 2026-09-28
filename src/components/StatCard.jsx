export default function StatCard({ label, value, unit, icon: Icon, color = 'text-blue-600' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-2">
      {Icon && (
        <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <span className="text-xs font-bold text-gray-400 truncate">{label}</span>
      <span className="text-lg font-black text-slate-800 truncate">
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}
