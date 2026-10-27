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
| 설정 | 없음(헤더의 내 정보·로그아웃 그대로) | `pages/mobile/MobileSettings.jsx` (`/mobile/settings`) |

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
- SQL: `supabase/schema.sql` → `auth_profiles.sql` → `profile_fields.sql` → `body_records.sql` → `seed_exercises.sql`(기본 운동 120개 + `exercises`의 동작 패턴·운동 유형·태그 칼럼, 신규 가입자 자동 지급 트리거 포함) → `log_kcal.sql`(운동 기록의 소모 칼로리 칼럼) → `ai_usage.sql`(AI 호출 횟수 기록) → `user_settings.sql`(앱 설정을 계정에 저장, 없으면 기기에만 저장) 순서로 한 번씩 실행. `seed_exercises.sql`은 앱 배포 **전에** 실행해야 한다(새 칼럼이 없으면 운동 저장이 실패한다). `log_kcal.sql`도 배포 전에 실행하는 것이 맞지만, 칼럼이 없을 때는 앱이 칼로리를 저장하지 않고 화면에서 즉석 계산만 하도록 방어해 두어 운동 기록 저장은 깨지지 않는다.
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

## 설정 (PWA 전용) + 다크 모드
- 메인 메뉴 오른쪽 위 "설정" → `MobileSettings`. 그룹: 화면(테마 시스템/라이트/다크), 계정(아이디 표시·내 정보·비밀번호 변경·로그아웃), 운동(기본 휴식 시간 30~300초·운동 중 화면 꺼짐 방지·점진 과부하 자동 적용), AI 루틴 만들기(내 운동 기록 참고·체형 정보 전송·최근 24시간 사용 횟수), 앱 정보(실행 상태 앱/브라우저·설치 안내), 위험 영역(회원 탈퇴). 메인 메뉴의 "내 정보"·"로그아웃" 버튼은 설정 안으로 옮겼고, PWA 내 정보 창의 회원 탈퇴 버튼도 설정으로 옮겼다. 웹앱은 이 화면이 없다(헤더의 내 정보·로그아웃 그대로).
- 저장: `context/SettingsContext.jsx`(`SettingsProvider`는 `App.jsx`에서 로그인 후 전체를 감싼다). **계정(`profiles.settings` jsonb)에 저장**해 기기를 바꿔도 같고(`supabase/user_settings.sql`), SQL을 안 돌렸으면 이 기기 `localStorage`(`fit-settings:<userId>`)에만 저장한다(설정 화면 하단에 안내). 기기 저장본은 항상 캐시로 쓴다. 로드 시 계정에 값이 있으면 계정이 이기고, 계정이 비어 있고 기기에 있으면 기기 설정을 계정으로 올린다. 계정 저장은 마지막 변경 600ms 뒤에 한 번만 보내고(연타 방지) 앱이 가려질 때는 즉시 보낸다. 값은 `sanitizeSettings`가 항목마다 형식·범위를 맞춘다. 기본값: 테마 시스템·기본 휴식 90초·화면 꺼짐 방지 켬·점진 과부하 자동 적용 켬·AI 기록 참고 켬·AI 체형 전송 끔.
- 설정이 쓰이는 곳: 기본 휴식 시간 → `WorkoutSession`(루틴에 휴식이 없을 때)·`MobileMenuScreen`·`QuickWorkoutModal`·PWA `RoutineFormModal`(비웠을 때 저장값). 화면 꺼짐 방지 → `WorkoutSession` Wake Lock. 점진 과부하 자동 적용 → `WorkoutSession`의 `applyProgression` 호출 여부(끄면 목표를 자동으로 안 바꾸고, 시작 화면의 "추천 적용" 버튼으로 직접 적용). AI 개인화 기본값 → **PWA** `AiRoutineModal`(웹앱 모달은 예전대로 기기 `localStorage` `fit-ai-routine-prefs` 사용, 서로 연결되지 않음).
- **다크 모드는 PWA(`/mobile`) 화면에서만** 적용된다. `App.jsx`의 `MobileApp`(`useApplyTheme`)이 `<html class="dark">`를 붙이고(떠나면 뗌, 상태 표시줄 `theme-color`도 맞춤) 웹앱은 항상 라이트다. "시스템"은 기기의 `prefers-color-scheme`을 따르며, 앱이 다시 보일 때(`visibilitychange`·`focus`)도 다시 읽는다.
- **색 구조(중요)**: 화면마다 `dark:` 클래스를 붙이지 않는다. `tailwind.config.js`가 `bg-white`·`bg-gray-*`·`text-gray-*`·`border-*` 와 pastel 색(`blue/red/orange/emerald/…-50~800`)을 **CSS 변수**(`--s-*` 배경·테두리, `--t-*` 글자)로 바꿔 두었고 `html.dark`일 때만 값이 바뀐다. 라이트 값은 Tailwind 원래 색을 `tailwindcss/colors`에서 읽어 오므로 웹앱·라이트 모드 색은 그대로다(132개 변수 원본과 일치 확인). `text-white`는 바꾸지 않는다(버튼 위 흰 글씨). 새 화면은 기존처럼 `bg-white`·`text-gray-800`·`bg-blue-50` 같은 **표준 Tailwind 색 클래스**를 쓰면 다크가 자동 적용된다. 목록에 없는 색 계열·단계(예: `bg-pink-100`)나 `#hex`/`style` 직접 색, 차트는 다크에서 안 바뀌니 `tailwind.config.js`의 `DARK` 표나 `src/index.css`(`html.dark ... recharts`)에 추가해야 한다. `text-blue-100` 위 `bg-letusBlue`(메뉴 운동하기 카드 보조 글씨)는 라이트·다크 모두 대비가 낮은 기존 상태.
- `tailwind.config.js` 변경이라 **개발 서버를 재시작**해야 적용된다. `safelist: ['dark']`는 `html.dark` 규칙이 정리되지 않게 하는 것이다.
- 확인한 것: 설정 화면 항목·저장(기기/계정/SQL 미실행/계정 우선/기기→계정 업로드)·연타 저장 1회·비밀번호 변경·로그아웃·탈퇴 확인창, 설정이 실제 동작에 반영(기본 휴식·화면 꺼짐 방지·점진 과부하), 다크 모드 PWA 화면(설정·메뉴·대시보드·기록·루틴·운동 리스트·모달)의 글자 대비 자동 검사, 웹앱 색이 그대로인 것, 시스템 테마 따라가기(재확인 경로). **실제 폰에서의 모양과 실시간 전환은 직접 확인하지 못했다.**

## 점진 과부하 (이중 점진) — 수행 평가 → 다음 목표 추천
- 규칙 기반이다(AI 아님). 같은 기록이면 항상 같은 결과이고 이유를 설명할 수 있다. 로직은 `lib/progression.js` 한 곳(웹앱·PWA 공용), 순수 함수 `evaluateSession`.
- 루틴 운동 항목 필드: `reps`(반복 범위 **하한**) · `repsMax`(상한, 선택) · `progressReps`(지금 목표 횟수, **앱이 자동 관리**) · `weight` · `sets`. 범위를 안 정하면 하한이 6 이상이면 +4회, 미만이면 +2회까지가 범위. 5×5처럼 고정하려면 최대를 하한과 같게 둔다. 사용자가 루틴 폼에서 최소/최대 반복을 바꾸면 `progressReps`는 버려진다. 새 기록을 만들 때(`scheduleGenerator`, `MobileMenuScreen`)는 `targetRepsOf(ex)`(= progressReps)를 목표 횟수로 쓴다. JSON 필드라 SQL 변경 없음.
- 평가 순서(먼저 걸리는 것): ①계획한 무게보다 가볍게 함 → 유지 ②어떤 세트가 하한 미달 → 유지(직전 기록도 하한 미달이면 무게 10% 낮추기) ③목표 횟수 미달 세트 있음 → 유지 ④계획 세트를 다 못 함 → 유지 ⑤피로도 5 → 유지 ⑥모든 세트가 상한 이상 → 무게 올리기(횟수는 하한으로) ⑦그 외 모든 세트가 목표 이상 → 횟수 +1(단 피로도 1이고 5세트 미만이면 세트 +1). 맨몸은 상한 없이 횟수만 늘린다.
- 증량 폭: 바벨 스쿼트·힌지·런지 5kg, 덤벨 2kg, 그 외 2.5kg. 이 값·10% 감량·피로도 기준은 흔히 쓰는 값으로 정한 **가정**이다(`progression.js` 맨 위에 모여 있음).
- 적용: 운동 하나를 끝내면(`WorkoutSession.applyProgression`) 루틴과, **이미 미리 만들어진 같은 운동의 앞으로 예정된 기록(2주치)**에 새 목표를 반영한다(예전에는 루틴만 바꿔서 미리 만든 기록에 반영되지 않았다). 완료 화면에 평가·이유·다음 목표 표시.
- 시작 화면(PWA): "시작할 운동" 패널에 지난번 수행·피로도·평가와 이유를 보여준다. 오늘 목표가 평가와 다르면(이 기능 이전 기록, 직접 고친 목표) "추천 …" 줄과 **적용** 버튼을 보여주고, 누를 때만 오늘 기록·루틴·예정 기록에 반영한다(조용히 덮어쓰지 않음).
- 웹앱에는 운동 진행 화면이 없어 시작 화면 표시는 PWA만. 루틴 폼의 최소/최대 반복 입력과 목록·상세의 범위 표시(`repsText`)는 웹앱·PWA 둘 다.
- 확인한 것: 규칙 19개 상황 단위 검증, PWA 세션 화면에서 시작 화면 표시·적용 버튼·3개 운동 완료 후 루틴/예정 기록 반영, 루틴 폼 모바일 레이아웃. **실제 사용자의 데이터로 추천이 적절한지는 써 봐야 안다.**

## AI 루틴 만들기 (Gemini)
- 웹앱 루틴 화면 "AI로 만들기" 버튼, PWA 루틴 화면 "AI로 루틴 만들기" 버튼. 조건(목표·경력·시간·집중 부위·장비·요일·추가 요청)을 고르면 **루틴 등록 화면에 초안이 채워진다**(바로 저장되지 않고, 사용자가 확인·수정 후 저장). 등록 모달의 `draft`/`draftNote` props, `useRoutineManager`의 `openAiCreate`/`handleAiDraft`/`draftRow`.
- 역할 분담: AI는 "어떤 운동을 몇 세트·몇 회·휴식 몇 초, 수퍼세트 여부"만 정한다. 계산(칼로리·피로도·점진 과부하)은 코드가 한다. **무게는 AI가 정하지 않고** 내가 전에 한 기록(`lib/aiRoutine.js`의 `lastWeightFor`)이 있으면 그 값, 없으면 빈칸.
- 구조: 브라우저 → `/api/generate-routine`(Vercel 서버리스, `api/generate-routine.js`) → Gemini. **API 키(`GEMINI_API_KEY`)는 서버 함수에서만** 쓰며 브라우저 코드·응답·로그에 넣지 않는다. 개발 서버(`npm run dev`)는 `vite.config.js`의 `localApi` 플러그인이 `/api/*`를 처리하고 `.env.local`의 서버용 값을 읽는다.
- 환경변수(Vercel + 로컬 `.env.local`): `GEMINI_API_KEY`(필수), `GEMINI_MODEL`(선택, 기본 `gemini-2.5-flash`), `AI_DAILY_LIMIT`(선택, 기본 10). Supabase URL/ANON 키는 기존 `VITE_` 값을 서버 함수도 쓴다.
- 안전장치: 로그인 토큰 검증, 사용자별 24시간 호출 한도(`ai_usage` 테이블, `supabase/ai_usage.sql` — **배포 전에 실행**, 없으면 AI 호출이 거부됨), 호출 전에 사용량 먼저 기록, 요청 입력 검증, 응답은 JSON 스키마로 받고 **운동 목록에 없는 id·중복·범위 밖 숫자를 서버가 걸러낸다**(`sanitizeResult`).
- **부위 선택**: "집중 부위"는 전신/상체/하체/밀기/당기기/코어 중 **여러 개** 선택(전신은 다른 것과 같이 못 고르고, 전부 해제하면 전신). AI에게 "이 부위 위주, 여러 개면 비중 배분"으로 지시하는 **소프트** 지정이다. 접어 둔 "세부 부위 직접 고르기"(가슴·등·어깨·이두·삼두·복근·대퇴사두·햄스트링·둔근·종아리 등, 상체/하체로 묶음)를 고르면 **하드 필터**: 그 부위를 쓰는 운동만 후보로 보낸다(`buildCatalogPayload`의 `muscleSlugs`, 꼭 넣을 운동은 예외). 후보 운동이 4개(`AI_MIN_CANDIDATES`) 미만이면 모달이 "조건에 맞는 운동 N개"를 붉게 안내하고 **호출하지 않는다**(한도·비용 보호). 서버는 `focus`를 배열로 받고(예전 문자열 형식도 호환), `muscles`는 프롬프트 안내용.
- **개인화(모달의 선택 항목)**: ①꼭 넣고 싶은 운동(최대 5개)·빼고 싶은 운동(최대 20개) — 이름·태그로 검색해 칩으로 고른다. 빼고 싶은 운동은 서버로 보내는 목록에서 **제거**(하드 필터), 꼭 넣을 운동은 장비 필터와 상관없이 목록에 두고 **AI가 빠뜨려도 서버가 채운다**(`sanitizeResult`, 개수 초과 시 꼭 넣을 운동이 아닌 뒤쪽부터 제거). ②"내 운동 기록 참고"(기본 켬): `buildHistorySummary` — 최근 90일에 서로 다른 2일 이상 한 운동 상위 8개를 "선호"로, 최근 28일(운동한 날 3일 이상일 때만)에 안 쓴 부위를 큰 근육 우선(`NEGLECT_PRIORITY`) 4개까지 "보강 대상"으로 전달. 운동 이름·부위만 보내고 무게·횟수·날짜는 보내지 않는다. ③"체형 정보 함께 보내기"(기본 **끔**, 건강 정보라 직접 켜야 함): `fetchBodyInfo` — 켰을 때만 `profiles`를 조회해 성별·나이·키·몸무게(키·몸무게는 최신 신체 기록 우선)를 보낸다. 서버가 범위 밖 값은 버리고 BMI는 서버가 다시 계산. 체형은 운동 선택·강도 조절에만 쓰고 체형 평가·진단·식단 조언은 하지 않게 지시한다. 체크박스 선택은 이 기기 `localStorage`(`fit-ai-routine-prefs`)에 기억(웹앱·PWA 공유).
- 개인정보: 기본으로 조건과 운동 리스트(이름·부위·장비·동작 패턴·유형)를 Gemini로 보낸다. 이름·이메일은 어떤 경우에도 보내지 않는다. 모달 하단 안내 문구가 **지금 설정에서 실제로 나가는 항목을 그대로** 보여준다. 부상·통증은 진단하지 않고 전문가 상담을 안내하게 지시.
- UI는 웹앱(`components/web/AiRoutineModal.jsx`, `text-ui-*`)과 PWA(`components/AiRoutineModal.jsx`, `text-m-*`)를 따로 둔다. 로직은 `hooks/useAiRoutine.js`, `lib/aiRoutine.js` 공용.
- 확인한 것: 서버 함수는 가짜 Gemini·Supabase 응답으로 10개 시나리오(정상, 인증 실패, 한도 초과, AI 응답 불량 등) 검증, 화면은 가짜 서버로 웹앱·PWA 흐름 검증. **실제 Gemini 응답 품질은 키를 넣고 써 봐야 알 수 있다.**

## 작업 규칙
- Windows 경로 길이 문제로 저장소는 `C:\dev\fit`에 둔다.
- 변경 후 `npm run build`가 통과하는지 확인한다.
- `service_role` / `secret` 키는 브라우저 코드나 채팅에 절대 넣지 않는다.
