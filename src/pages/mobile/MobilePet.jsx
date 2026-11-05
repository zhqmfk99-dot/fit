import PageHeader from '../../components/PageHeader.jsx'
import PetCard from '../../components/mobile/PetCard.jsx'
import PointsCard from '../../components/mobile/PointsCard.jsx'

// PWA(모바일)용 "내 펫" 화면 — 펫 키우기 위, 포인트 내역 아래. 글자 크기는 모바일 표준(text-m-*). (웹앱은 pages/WorkoutPet.jsx)
export default function MobilePet() {
  return (
    <div>
      <PageHeader title="내 펫" color="bg-amber-500" />
      <div className="p-4 space-y-4">
        <PetCard />
        <PointsCard limit={15} />
      </div>
    </div>
  )
}