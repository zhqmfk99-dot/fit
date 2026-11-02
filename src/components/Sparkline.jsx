// 아주 작은 추이선(SVG) — 운동별 기록의 추이에 쓴다. points: [{ date, value }] (2개 이상일 때만 그린다)
// 색은 currentColor라 부모의 글자 색을 따른다. 글자는 넣지 않는다(위쪽 UI가 최소·최대 값을 따로 적는다).
export default function Sparkline({ points, height = 44, className = '' }) {
  if (!points || points.length < 2) return null
  const W = 200
  const pad = 4
  const vals = points.map(p => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const xy = points.map((p, i) => [pad + (i * (W - pad * 2)) / (points.length - 1), pad + (1 - (p.value - min) / span) * (height - pad * 2)])
  const last = xy[xy.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className={`w-full ${className}`} style={{ height }} preserveAspectRatio="none" role="img" aria-label="추이">
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" />
    </svg>
  )
}