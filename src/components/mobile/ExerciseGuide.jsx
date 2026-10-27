import { ExternalLink } from 'lucide-react'
import MuscleDiagram from '../MuscleDiagram.jsx'
import { MUSCLE_LABELS } from '../../lib/muscleMap.js'
import { youtubeGuideUrl } from '../../lib/exerciseGuide.js'

// 운동 가이드 (PWA용 화면): 쓰는 근육(신체도) + 유튜브 자세 영상 검색.
//   compact = 운동 시작 화면의 작은 줄 / 기본 = 운동 상세 창의 섹션. 웹앱은 components/web/ExerciseGuide.jsx.
export default function ExerciseGuide({ name, muscles = [], compact = false }) {
  const labels = [...new Set(muscles.map(m => MUSCLE_LABELS[m] || m))]
  const link = (
    <a
      href={youtubeGuideUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        compact
          ? 'shrink-0 flex items-center gap-1 px-3 min-h-[36px] rounded-full bg-white border border-gray-200 text-m-caption font-bold text-gray-700 active:bg-gray-100'
          : 'flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white text-m-body font-bold text-gray-700 active:bg-gray-50'
      }
    >
      <ExternalLink className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {compact ? '자세 영상' : '유튜브에서 자세 영상 찾아보기'}
    </a>
  )

  if (compact) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
        {labels.length > 0 && <MuscleDiagram muscles={muscles} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="text-m-caption font-bold text-gray-400">쓰는 근육</div>
          <div className="text-m-body font-bold text-gray-700 truncate">{labels.length ? labels.join(' · ') : '-'}</div>
        </div>
        {link}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {labels.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 py-3">
          <MuscleDiagram muscles={muscles} size="md" />
          <p className="mt-2 text-center text-m-caption text-gray-400">파란색이 이 운동이 쓰는 근육이에요.</p>
        </div>
      )}
      {link}
      <p className="text-m-caption text-gray-400 leading-relaxed">유튜브 검색 결과가 새 창으로 열려요. 영상의 내용과 자세는 직접 확인해 주세요.</p>
    </div>
  )
}
