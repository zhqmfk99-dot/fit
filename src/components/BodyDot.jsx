// 신체 추이 그래프(웹앱·PWA 공용)의 점 모양: 집 체중계는 동그라미, 정밀 측정(인바디 등)은 속이 빈 마름모.
// recharts의 dot에 함수로 넘긴다 — 값이 없는 날(cx가 없음)은 아무것도 그리지 않는다.
export const bodyDot = color =>
  function BodyDot({ cx, cy, payload, index }) {
    if (cx == null || cy == null) return null
    const key = `${payload?.date ?? ''}-${index ?? ''}` // recharts가 점 목록을 그릴 때 key가 필요하다
    if (payload?.precise) return <rect key={key} x={cx - 4.5} y={cy - 4.5} width={9} height={9} transform={`rotate(45 ${cx} ${cy})`} fill="#ffffff" stroke={color} strokeWidth={2} />
    return <circle key={key} cx={cx} cy={cy} r={3} fill={color} />
  }

// 그래프 아래 범례: 정밀 측정 기록이 있을 때만 보여 준다
export function PreciseLegend({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span>● 집 체중계</span>
      <span>◇ 정밀 측정(인바디 등)</span>
    </div>
  )
}
