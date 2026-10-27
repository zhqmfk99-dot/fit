import Model from 'react-body-highlighter'
import { GUIDE_COLOR, highlighterData } from '../lib/exerciseGuide.js'

// 운동이 쓰는 근육을 신체도에 강조해서 보여준다(정면 + 후면 나란히). 해당 면에 없는 근육은 그 면에서 칠해지지 않는다.
// size: 'sm'(시작 화면의 작은 줄) | 'md'(운동 상세). 글자는 없는 순수 그림이라 웹앱·PWA가 같이 쓴다.
const WIDTHS = { sm: '2.6rem', md: '5.5rem' }

export default function MuscleDiagram({ muscles, size = 'md' }) {
  const data = highlighterData(muscles)
  return (
    <div className="flex items-center justify-center gap-1 shrink-0" aria-hidden="true">
      {['anterior', 'posterior'].map(view => (
        <Model key={view} type={view} data={data} highlightedColors={[GUIDE_COLOR]} bodyColor="#e2e8f0" style={{ width: WIDTHS[size], padding: 0 }} />
      ))}
    </div>
  )
}
