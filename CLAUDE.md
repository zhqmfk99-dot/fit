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
- PWA(모바일) 화면은 이 표준과 별개로 따로 정한다.

## 데이터 / 인증
- Supabase 클라이언트: `src/lib/supabase.js` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 `.env.local`, Vercel 환경변수).
- 테이블: `exercises`, `routines`, `workout_logs`, `body_records`(신체 기록, 날짜당 1건)(사용자별 RLS), `profiles`(이름·성별·나이·키·몸무게).
- 데이터 상태는 `WorkoutLogsContext`가 불러오고 저장한다. `setLogs`/`setRoutines`/`setExercises`는 `useState` setter처럼 쓰되 변경분이 자동으로 Supabase에 저장된다.
- 모든 ID는 UUID(`crypto.randomUUID()`).
- 로그인: 이메일(=아이디)+비밀번호. 비밀번호 최소 6자. 아이디/비밀번호 찾기, 비밀번호 재설정, 내 정보, 회원 탈퇴 포함.
- SQL: `supabase/schema.sql` → `auth_profiles.sql` → `profile_fields.sql` → `body_records.sql` → `seed_exercises.sql`(기본 운동 120개 + `exercises`의 동작 패턴·운동 유형·태그 칼럼, 신규 가입자 자동 지급 트리거 포함) 순서로 한 번씩 실행. `seed_exercises.sql`은 앱 배포 **전에** 실행해야 한다(새 칼럼이 없으면 운동 저장이 실패한다).
- 운동(`exercises`)에는 이름(정식 명칭), 부위, 장비, 동작 패턴(밀기/당기기/스쿼트/힌지/런지/코어/기타), 운동 유형(복합관절/단관절), 태그(별칭)가 있다. 동작 패턴·유형·태그는 PWA 수정 폼이 모르는 값이라 `useExerciseManager`가 기존 값 위에 덮어쓰는 방식으로 저장한다(통째로 교체하면 지워짐).

## 작업 규칙
- Windows 경로 길이 문제로 저장소는 `C:\dev\fit`에 둔다.
- 변경 후 `npm run build`가 통과하는지 확인한다.
- `service_role` / `secret` 키는 브라우저 코드나 채팅에 절대 넣지 않는다.
