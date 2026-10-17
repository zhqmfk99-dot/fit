// PWA(모바일) 전용 날짜 입력 — 기기 기본 날짜 선택기를 쓴다. (웹앱은 components/web/DateInput.jsx의 달력 팝업)
// 사용법은 웹앱 것과 같다: value는 'YYYY-MM-DD' 문자열, onChange는 같은 형식의 문자열을 받는다.
export default function DateInput({ value, onChange, fullWidth = false, disabled = false, className = '' }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`h-11 px-3 rounded-lg border text-m-body ${fullWidth ? 'w-full' : 'w-[150px]'} ${
        disabled ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-700 focus:outline-none focus:border-letusOrange'
      } ${className}`}
    />
  )
}
