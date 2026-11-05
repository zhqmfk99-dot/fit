import PageHeader from '../components/PageHeader.jsx'
import PetCard from '../components/web/PetCard.jsx'
import PointsCard from '../components/web/PointsCard.jsx'

// 웹앱용 "내 펫" 화면 — 운동으로 모은 포인트로 펫을 키운다(왼쪽), 포인트 내역(오른쪽). 규칙·서버 검증은 supabase/points.sql, 로직은 lib/pet.js·lib/points.js. (PWA는 pages/mobile/MobilePet.jsx)
export default function WorkoutPet() {
  return (
    <div>
      <PageHeader title="내 펫" color="bg-amber-500" />
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <PetCard />
        <PointsCard limit={15} />
      </div>
    </div>
  )
}