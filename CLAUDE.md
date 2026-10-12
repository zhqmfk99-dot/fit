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
- **웹앱 전용 컴포넌트**: `BodyTrendChart.jsx`(신체 추이 그래프), `BodyRecordModal.jsx`(신체 기록 입력). PWA에 넣을 때는 PWA용 UI를 따로 만든다.
- **공용 컴포넌트**: `components/`의 모달·입력 컴포넌트는 양쪽에서 쓴다. 한쪽 UI만 바꿔야 하면 공용 컴포넌트를 고치지 말고 복제하거나 props로 분기한다. 공용 컴포넌트를 고칠 때는 다른 쪽 화면에 미치는 영향을 확인한다.

## 데이터 / 인증
- Supabase 클라이언트: `src/lib/supabase.js` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 `.env.local`, Vercel 환경변수).
- 테이블: `exercises`, `routines`, `workout_logs`, `body_records`(신체 기록, 날짜당 1건)(사용자별 RLS), `profiles`(이름·성별·나이·키·몸무게).
- 데이터 상태는 `WorkoutLogsContext`가 불러오고 저장한다. `setLogs`/`setRoutines`/`setExercises`는 `useState` setter처럼 쓰되 변경분이 자동으로 Supabase에 저장된다.
- 모든 ID는 UUID(`crypto.randomUUID()`).
- 로그인: 이메일(=아이디)+비밀번호. 비밀번호 최소 6자. 아이디/비밀번호 찾기, 비밀번호 재설정, 내 정보, 회원 탈퇴 포함.
- SQL: `supabase/schema.sql` → `auth_profiles.sql` → `profile_fields.sql` → `body_records.sql` 순서로 한 번씩 실행.

## 작업 규칙
- Windows 경로 길이 문제로 저장소는 `C:\dev\fit`에 둔다.
- 변경 후 `npm run build`가 통과하는지 확인한다.
- `service_role` / `secret` 키는 브라우저 코드나 채팅에 절대 넣지 않는다.
