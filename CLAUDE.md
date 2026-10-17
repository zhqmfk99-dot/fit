# TRAINING (fit) — 프로젝트 가이드

React + Vite + Tailwind, 데이터/인증은 Supabase, 배포는 Vercel.
`main`에 push하면 Vercel이 자동 배포한다.

## 화면 구성 원칙 (중요)

**웹앱(데스크탑) 화면과 PWA(모바일) 화면은 UI 구성을 별도로 가져간다.**
한쪽을 수정하면 다른 쪽에는 영향이 없어야 하고, 서로의 레이아웃·컴포넌트 구조를 맞추려고 하지 않는다.
사용자가 특정 화면(웹앱 또는 PWA)을 지정하지 않고 UI 수정을 요청하면, 어느 쪽인지 먼저 확인한다.

| 구분 | 웹앱 (데스크탑) | PWA (모바일) |
|---|---|---|
| 라우트 | `/workout/*` | `/mobile/*` |
| 레이아웃 | `Layout` = `Sidebar` + `Header` (md 이상에서만 보임) | 레이아웃 없음. 메인 메뉴(허브)에서 각 화면으로 들어가고 `PageHeader`의 뒤로가기로 복귀 |
| 대시보드 | `pages/WorkoutDashboard.jsx` | `pages/mobile/MobileDashboard.jsx` (분리 완료) |
| 기록 | `pages/WorkoutLog.jsx` | `pages/mobile/MobileLog.jsx` |
| 루틴 | `pages/WorkoutRoutine.jsx` | `pages/mobile/MobileRoutines.jsx` |
| 운동 리스트 | `pages/WorkoutExercises.jsx` | `pages/mobile/MobileExercises.jsx` |
| 메인 메뉴 | 사이드바 | `pages/mobile/MobileMenuScreen.jsx` |
| 운동 진행 | 없음 | `pages/mobile/WorkoutSession.jsx`, `QuickWorkoutModal.jsx` |

라우팅은 `src/App.jsx`의 `DesktopApp` / `MobileApp`으로 나뉜다.
폭 768px 미만에서 `/`로 들어오면 `/mobile`로 보낸다.

### 공유하는 것 / 분리하는 것
- **공유(데이터·로직)**: `context/WorkoutLogsContext.jsx`, `hooks/*`, `lib/*`. 화면마다 렌더링만 다르고 동작은 같아야 하는 로직은 훅으로 둔다.
- **분리(UI)**: 페이지 컴포넌트와 레이아웃은 웹앱용/PWA용을 각각 둔다. 새 UI를 만들 때 한쪽 파일을 반응형(`md:`)으로 억지로 합치지 않는다.
- **PWA 대시보드**: 웹앱 대시보드를 수정하기 전 모습 그대로 `MobileDashboard.jsx`로 복제해 분리했다. 이후 웹앱 대시보드 수정은 PWA에 영향이 없다.
- **웹앱 전용 컴포넌트**: `components/web/` 폴더(루틴·운동 기록·운동 리스트 모달, 일정 변경 모달, 날짜 입력, 내 정보 모달)와 `BodyTrendChart.jsx`, `BodyRecordModal.jsx`. 웹앱 화면은 이 복사본을 쓰고, PWA는 `components/`의 원본을 그대로 쓴다. 둘은 로직이 같아도 UI(글자 크기 등)는 따로 수정한다. 기능(로직)을 바꿀 때는 양쪽 파일을 모두 확인한다.
- **공용 컴포넌트**: `components/`의 모달·입력 컴포넌트는 양쪽에서 쓴다. 한쪽 UI만 바꿔야 하면 공용 컴포넌트를 고치지 말고 복제하거나 props로 분기한다. 공용 컴포넌트를 고칠 때는 다른 쪽 화면에 미치는 영향을 확인한다.

## 웹앱 글자 크기 표준
웹앱 화면의 글자 크기는 `tailwind.config.js`에 정의한 토큰을 쓴다. 새 화면·수정 시 `text-xs/sm/lg` 대신 아래를 쓴다.

| 토큰 | 크기 | 용도 |
|---|---|---|
| `text-ui-title` | 14px | 카드·섹션 제목, 년월 |
| `text-ui-body` | 11px | 본문, 버튼, 요일, 날짜 숫자 |
| `text-ui-caption` | 10px | 보조 설명, 뱃지, 건수 |

- 적용 완료: 웹앱 **기록**, **루틴**, **운동 리스트** 화면 본문, 웹앱 **모달 전부**(`components/web/*`, `BodyRecordModal`). 대시보드는 사용자가 현재 크기로 확정(변경 금지).
- 미적용(요청 시 순차 적용): 로그인/재설정 화면, 사이드바·헤더.
- PWA(모바일) 화면은 이 표준과 별개로 따로 정한다(아래 "PWA 글자 크기 표준").

## PWA 글자 크기 표준
PWA(모바일) 화면은 터치 화면이라 웹앱보다 크게 잡은 별도 토큰을 쓴다. 새 화면·수정 시 `text-xs/sm/lg` 대신 아래를 쓴다. 터치 대상(버튼·탭)은 높이 32px 이상을 목표로 한다.

| 토큰 | 크기 | 용도 |
|---|---|---|
| `text-m-title` | 15px | 카드·섹션 제목, 숫자 강조 |
| `text-m-body` | 13px | 본문, 버튼, 입력 |
| `text-m-caption` | 11px | 보조 설명, 뱃지, 범례, 축 라벨 |

차트의 축·범례 글자는 토큰이 아니라 코드에 직접 11px로 지정되어 있다(`fontSize: 11`). 토큰 크기를 바꾸면 차트 글자도 함께 확인한다. (처음 16/14/12px로 만들었다가 사용자가 크다고 해서 줄였다.)

- 모바일 전용 컴포넌트는 `components/mobile/` 폴더에 둔다(현재: `StatCard`, `MuscleFatigueMap`, `BodyTrendChart`). PWA 화면은 이 복사본을 쓰고, 웹앱은 `components/`·`components/web/`을 쓴다.
- **적용 완료(PWA 전체)**: 대시보드(부위 선택 색상, 신체 추이 그래프), 운동 리스트(검색·동작 패턴·운동 유형 필터, 뱃지·태그), 루틴(운동 구성 요약), 기록(신체 기록 입력, 하단 고정 버튼 바, 날짜별 신체 기록 요약), 메인 메뉴(오늘 상태가 보이는 운동하기 카드, 2열 메뉴), 운동 진행, 즉석 운동 모달, 상단 `PageHeader`, 그리고 모달 전부.
- **PWA 전용이 된 `components/` 원본**: `ExerciseFormModal`, `ExerciseDetailModal`, `RoutineFormModal`, `RoutineDetailModal`, `WorkoutFormModal`, `RescheduleModal`, `ProfileModal`, `DateInput`(기기 기본 날짜 선택기 `<input type="date">`), `PageHeader`(md 미만에서만 보임). 웹앱은 `components/web/` 복사본을 쓴다.
- 운동 진행 화면의 큰 글자(운동명·숫자 `text-2xl`, 휴식 타이머 `text-6xl`)는 멀리서 보는 용도라 토큰이 아닌 Tailwind 기본 크기를 쓴다.
- 운동 진행 화면의 시작 전 화면: 위에 오늘 운동 **전체 목록**(세트×횟수×무게, 수퍼세트는 한 묶음), 아래에 **시작할 운동** 패널과 시작 버튼. 목록에서 누르면 시작할 운동이 바뀌고, 이미 끝낸 운동은 선택할 수 없다. 운동 하나가 끝나면 남은 그룹 중 현재 다음(뒤 → 앞 순)이 자동 선택되고, 전부 끝나면 완료 화면. 목록은 세션 시작 시점의 전체 운동으로 고정하고(`groups`), 실제 진행은 시작 시점에 안 끝난 운동만 한다(`initiallyDone`).
- 운동 진행 화면(세트 진행 중)의 세트 표시: 운동명 아래 뱃지 안에 목표 세트 수만큼의 도트(`SetDots`). 끝낸 세트는 채운 원, 안 한 세트는 빈 원, 지금 하는 세트는 파란 테두리의 빈 원. 수퍼세트는 운동별로 각자의 세트 수와 진행을 따른다.
  - **끝낸 세트 보기·수정**: 끝낸 세트의 도트만 눌러 그 세트로 이동할 수 있다(안 한 세트 도트는 누를 수 없음). 보는 중에는 스테퍼가 비활성화되고 "세트 완료" 버튼이 "수정하기"로 바뀐다. "수정하기"를 누르면 횟수·무게를 고칠 수 있고(수정 완료/수정 취소), 수정 중에는 도트 이동이 잠긴다. "현재 세트로 돌아가기"로 복귀. 수정값은 `performedByLog`에 반영되어 운동의 마지막 세트를 끝낼 때 함께 저장된다. 세트 소요 시간 측정에는 보는 시간이 섞이지 않도록 복귀 시 보정한다(`setStartAt`).
- 운동 진행 화면의 동작: 종료·완료 후 돌아가는 곳은 `/mobile/log`(데스크탑 경로 `/workout/log`로 가면 헤더 없는 데스크탑 화면이 열린다), 휴식 타이머는 종료 시각 기준으로 계산(화면이 꺼져도 정확), 운동 중 화면 꺼짐 방지(Wake Lock, 지원 브라우저만), 세트·휴식 중 종료는 확인창.
- **웹앱·PWA가 같이 쓰는 로직(UI 아님)**: `lib/exerciseSearch.js`(운동명·태그 검색 규칙), `lib/equipmentStyle.js`(장비별 뱃지 색). 검색 규칙을 바꾸면 양쪽에 모두 반영된다.
- 모바일 검증은 개발 서버에서 폭 375px로 한다(가로 넘침 없음, 터치 대상 높이 32px 이상).

## 데이터 / 인증
- Supabase 클라이언트: `src/lib/supabase.js` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 `.env.local`, Vercel 환경변수).
- 테이블: `exercises`, `routines`, `workout_logs`, `body_records`(신체 기록, 날짜당 1건)(사용자별 RLS), `profiles`(이름·성별·나이·키·몸무게).
- 데이터 상태는 `WorkoutLogsContext`가 불러오고 저장한다. `setLogs`/`setRoutines`/`setExercises`는 `useState` setter처럼 쓰되 변경분이 자동으로 Supabase에 저장된다.
- 모든 ID는 UUID(`crypto.randomUUID()`).
- 로그인: 이메일(=아이디)+비밀번호. 비밀번호 최소 6자. 아이디/비밀번호 찾기, 비밀번호 재설정, 내 정보, 회원 탈퇴 포함.
- SQL: `supabase/schema.sql` → `auth_profiles.sql` → `profile_fields.sql` → `body_records.sql` → `seed_exercises.sql`(기본 운동 120개 + `exercises`의 동작 패턴·운동 유형·태그 칼럼, 신규 가입자 자동 지급 트리거 포함) → `log_kcal.sql`(운동 기록의 소모 칼로리 칼럼) 순서로 한 번씩 실행. `seed_exercises.sql`은 앱 배포 **전에** 실행해야 한다(새 칼럼이 없으면 운동 저장이 실패한다). `log_kcal.sql`도 배포 전에 실행하는 것이 맞지만, 칼럼이 없을 때는 앱이 칼로리를 저장하지 않고 화면에서 즉석 계산만 하도록 방어해 두어 운동 기록 저장은 깨지지 않는다.
- 운동(`exercises`)에는 이름(정식 명칭), 부위, 장비, 동작 패턴(밀기/당기기/스쿼트/힌지/런지/코어/기타), 운동 유형(복합관절/단관절), 태그(별칭)가 있다. 동작 패턴·유형·태그는 PWA 수정 폼이 모르는 값이라 `useExerciseManager`가 기존 값 위에 덮어쓰는 방식으로 저장한다(통째로 교체하면 지워짐).

## 소모 칼로리 추정
- 계산식은 `lib/calories.js` 한 곳(웹앱·PWA 공용): `소모 kcal = MET × 체중 × 시간(h)`. 시간은 세트 수행 + 휴식 + 운동 사이 이동(휴식 포함), MET는 3.5~6.0을 강도 점수(상대강도 0.6 + 체중 대비 분당 볼륨 0.4)로 보간한다. 맨몸 운동은 중간 강도로 본다. 5kcal 단위로 반올림한다.
- **추정치이며 정확도를 검증하지 못했다**(정답 데이터가 없음). MET 범위 3.5~6.0만 공개 자료(Compendium of Physical Activities)에 근거가 있고, 0.6/0.4 비율·밀도 기준(0.5~6)·시간 추정값(세트당 4초/회, 휴식 90초, 이동 60초)은 합리적으로 정한 가정이다. 화면에는 항상 "약 N kcal"로 표시한다.
- **저장**: 운동 기록 하나의 칼로리를 `workout_logs.kcal`에 저장한다. `WorkoutLogsContext`의 `setLogs`가 저장 직전에 `applyKcal`(lib/calories.js)을 호출하므로, 세션 완료·완료 처리·직접 입력·수정 어느 경로든 자동으로 채워진다. 값이 이미 있고 날짜·세트 기록이 그대로면 다시 계산하지 않는다(그래서 체중·최고 무게·보정 계수가 나중에 바뀌어도 과거 값은 변하지 않는다). 세트를 수정하거나 날짜를 옮기면 그 시점 기준으로 다시 계산하고, 완료를 취소하면 값을 지운다. 이 기능 이전의 완료 기록은 앱을 열 때 체중을 알 수 있으면 자동으로 채워 저장한다(백필).
- 날짜 합계와 추이 그래프(`CalorieTrendChart`, 웹앱은 `components/web/`, PWA는 `components/mobile/`, 대시보드에 표시)는 **저장된 값을 합산**한다. 저장값이 없는 기록만 체중으로 즉석 계산하고, 하나라도 구할 수 없으면 부분 합계 대신 null.
- 맞추는 방법: 시계·운동 앱의 값과 몇 세션 비교한 뒤 `CALORIE_CALIBRATION`(기본 1.0)을 조정한다. **저장된 과거 값은 바뀌지 않으므로**, 과거까지 새 계수로 바꾸려면 값을 다시 계산해 덮어쓰는 작업이 따로 필요하다. 가정 상수들도 같은 파일 맨 위에 모여 있다.
- 체중은 그날 이전의 가장 최근 신체 기록 → 없으면 이후 기록 중 가장 오래된 것 → 없으면 "내 정보" 체중(`profileWeightKg`, 앱을 열 때 한 번 로드) 순으로 쓴다. 체중이 없으면 칼로리를 계산·저장하지 못하고 안내 문구를 보여준다(체중이 생긴 뒤 다음 저장 때 채워진다).
- 표시 위치: 웹앱 기록 화면(오른쪽 카드 날짜 줄), PWA 기록 화면(날짜 목록 헤더), PWA 운동 완료 화면, 웹앱·PWA 대시보드의 추이 그래프. 날짜 합계 훅은 `hooks/useDayKcal.js`.

## 총 운동 시간
- 운동 진행 화면이 세트를 끝낼 때마다 시작·종료 시각(`startedAt`/`endedAt`, ms)을 `performed_sets`(JSON)에 같이 저장한다. **SQL 변경 없음.**
- 하루 총 시간 = 그날 완료한 세트들의 구간을 합친 길이(`lib/workoutTime.js`의 `dayDurationSeconds`, 훅 `hooks/useDayDuration.js`). 세트·운동 사이 간격이 15분 이하면 운동 시간에 포함하고, 그보다 길면(중간에 쉰 구간) 뺀다.
- 시각이 없는 기록(이 기능 이전, 직접 입력)은 계산에서 빠지고, 하루에 시각이 하나도 없으면 표시하지 않는다. 과거 기록은 채울 수 없다.
- 표시: 웹앱 기록 화면(오른쪽 카드 날짜 줄), PWA 기록 화면(날짜 줄), PWA 운동 완료 화면. 칼로리 계산에는 `logSeconds`가 실측 시각으로 운동 시작 전 준비 시간(직전 세트 종료~첫 세트 시작, 최대 300초)을 반영한다. 시각이 없거나 그날 첫 운동이면 60초 가정값.

## 작업 규칙
- Windows 경로 길이 문제로 저장소는 `C:\dev\fit`에 둔다.
- 변경 후 `npm run build`가 통과하는지 확인한다.
- `service_role` / `secret` 키는 브라우저 코드나 채팅에 절대 넣지 않는다.
