// 웹앱 운동 리스트의 사용장비 뱃지 색. 장비마다 색을 달리해서 한눈에 구분한다.
// Tailwind가 클래스를 인식하도록 전체 클래스명을 그대로 적는다. (EQUIPMENT_OPTIONS와 같은 이름을 키로 쓴다)
const EQUIPMENT_STYLES = {
  바벨: 'bg-rose-50 text-rose-600',
  덤벨: 'bg-orange-50 text-orange-600',
  머신: 'bg-blue-50 text-blue-600',
  케이블: 'bg-purple-50 text-purple-600',
  벤치: 'bg-amber-50 text-amber-700',
  스미스머신: 'bg-indigo-50 text-indigo-600',
  밴드: 'bg-pink-50 text-pink-600',
  불가리안백: 'bg-teal-50 text-teal-600',
  맨몸: 'bg-green-50 text-green-600',
  기타: 'bg-gray-100 text-gray-500',
}

// 목록에 없는 장비(나중에 추가된 값)는 회색으로 보여준다
export const equipmentBadgeClass = equipment => EQUIPMENT_STYLES[equipment] ?? 'bg-gray-100 text-gray-500'
