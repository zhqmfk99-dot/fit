-- 운동 리스트 기본 데이터(120개)와 동작 패턴·운동 유형·태그 칼럼. Supabase SQL Editor에서 통째로 실행하세요. (schema.sql 실행 후)
-- 여러 번 실행해도 안전합니다.
--
-- [부위] 주동근 + 주요 보조근만 넣었다. 앱은 한 운동에 등록된 부위 전부에 같은 피로도를 반영하므로 미미한 안정화 근육까지 넣으면 인체도가 부정확해진다.
--        부위 값은 앱이 지원하는 17개 슬러그(src/lib/muscleMap.js)만 쓴다. 측면 어깨는 별도 부위가 없어 front-deltoids('어깨')로 둔다.
-- [동작 패턴] 밀기/당기기/스쿼트/힌지/런지/코어/기타. 상체 고립 운동은 푸시/풀 분할 기준(삼두·어깨 레이즈=밀기, 이두·후면 어깨=당기기).
-- [운동 유형] 복합관절/단관절. 아이소메트릭 코어 운동(플랭크 등)은 복합관절로 분류했다.
-- [태그] 같은 운동의 다른 이름(별칭·영문명·줄임말). 일반적으로 쓰이는 명칭 위주이며 모든 별칭을 망라한 것은 아니다.
-- [근거] 일반적으로 알려진 운동 해부학·프로그래밍 분류를 기준으로 하고, 일부는 Wikipedia 'List of weight training exercises'의
--        근육 분류와 교차 확인했다. 운동마다 ExRx.net·ACE 자료로 하나씩 대조한 것은 아니므로, 틀린 항목은 운동 리스트 화면에서 수정할 수 있다.
--
-- [안전장치] 같은 이름의 운동이 이미 있으면 새로 만들지 않는다. 이미 있는 운동은 동작 패턴·유형이 비어 있을 때,
--            태그가 비어 있을 때만 채운다(사용자가 직접 고친 값은 덮어쓰지 않는다).

-- 1) 칼럼 추가
alter table public.exercises
  add column if not exists movement_pattern text check (movement_pattern in ('밀기', '당기기', '스쿼트', '힌지', '런지', '코어', '기타')),
  add column if not exists exercise_type    text check (exercise_type in ('복합관절', '단관절')),
  add column if not exists tags             text[] not null default '{}';

-- 2) 기본 운동 지급 함수
create or replace function public.seed_default_exercises(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with v(name, muscles, equipment, movement_pattern, exercise_type, tags) as (
    values
    ('벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '바벨', '밀기', '복합관절', array['벤치', '바벨 벤치프레스', 'Bench Press', 'BP']::text[]),
    ('인클라인 벤치프레스', array['chest', 'front-deltoids', 'triceps']::text[], '바벨', '밀기', '복합관절', array['인클라인 벤치', 'Incline Bench Press']::text[]),
    ('스미스머신 벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '스미스머신', '밀기', '복합관절', array['스미스 벤치', 'Smith Bench Press']::text[]),
    ('덤벨 벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '덤벨', '밀기', '복합관절', array['덤벨 프레스', 'DB 벤치프레스', 'Dumbbell Bench Press']::text[]),
    ('인클라인 덤벨 프레스', array['chest', 'front-deltoids', 'triceps']::text[], '덤벨', '밀기', '복합관절', array['인클라인 덤벨 벤치', 'Incline Dumbbell Press']::text[]),
    ('덤벨 플라이', array['chest', 'front-deltoids']::text[], '덤벨', '밀기', '단관절', array['체스트 플라이', 'Dumbbell Fly']::text[]),
    ('체스트 프레스 머신', array['chest', 'triceps', 'front-deltoids']::text[], '머신', '밀기', '복합관절', array['머신 체스트 프레스', 'Chest Press Machine']::text[]),
    ('펙덱 플라이', array['chest', 'front-deltoids']::text[], '머신', '밀기', '단관절', array['펙덱', '팩덱', '버터플라이', 'Pec Deck']::text[]),
    ('케이블 크로스오버', array['chest', 'front-deltoids']::text[], '케이블', '밀기', '단관절', array['크로스오버', 'Cable Crossover']::text[]),
    ('푸시업', array['chest', 'triceps', 'front-deltoids']::text[], '맨몸', '밀기', '복합관절', array['팔굽혀펴기', '푸쉬업', 'Push-up']::text[]),
    ('딥스', array['chest', 'triceps', 'front-deltoids']::text[], '맨몸', '밀기', '복합관절', array['딥', '평행봉 딥스', 'Dips']::text[]),
    ('데드리프트', array['lower-back', 'hamstring', 'gluteal', 'trapezius']::text[], '바벨', '힌지', '복합관절', array['데드', '컨벤셔널 데드리프트', 'Deadlift']::text[]),
    ('루마니안 데드리프트', array['hamstring', 'gluteal', 'lower-back']::text[], '바벨', '힌지', '복합관절', array['RDL', '루마니안 데드', 'Romanian Deadlift']::text[]),
    ('바벨 로우', array['upper-back', 'lower-back', 'biceps', 'back-deltoids']::text[], '바벨', '당기기', '복합관절', array['벤트오버 로우', '벤트오버 바벨 로우', 'Barbell Row', 'Bent-over Row']::text[]),
    ('덤벨 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '덤벨', '당기기', '복합관절', array['원암 덤벨 로우', 'Dumbbell Row', 'One-arm Row']::text[]),
    ('시티드 케이블 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '케이블', '당기기', '복합관절', array['케이블 로우', '시티드 로우', 'Seated Cable Row']::text[]),
    ('랫풀다운', array['upper-back', 'biceps']::text[], '케이블', '당기기', '복합관절', array['랫 풀다운', '랫풀', 'Lat Pulldown']::text[]),
    ('풀업', array['upper-back', 'biceps']::text[], '맨몸', '당기기', '복합관절', array['턱걸이', '풀 업', 'Pull-up']::text[]),
    ('친업', array['upper-back', 'biceps']::text[], '맨몸', '당기기', '복합관절', array['친 업', '언더그립 턱걸이', 'Chin-up']::text[]),
    ('하이퍼익스텐션', array['lower-back', 'gluteal', 'hamstring']::text[], '맨몸', '힌지', '단관절', array['백 익스텐션', '로만체어', 'Back Extension', 'Hyperextension']::text[]),
    ('슈러그', array['trapezius']::text[], '덤벨', '당기기', '단관절', array['덤벨 슈러그', 'Shrug']::text[]),
    ('오버헤드프레스', array['front-deltoids', 'triceps']::text[], '바벨', '밀기', '복합관절', array['OHP', '밀리터리 프레스', '숄더프레스', 'Overhead Press', 'Military Press']::text[]),
    ('덤벨 숄더프레스', array['front-deltoids', 'triceps']::text[], '덤벨', '밀기', '복합관절', array['DB 숄더프레스', 'Dumbbell Shoulder Press']::text[]),
    ('아놀드 프레스', array['front-deltoids', 'triceps']::text[], '덤벨', '밀기', '복합관절', array['Arnold Press']::text[]),
    ('머신 숄더프레스', array['front-deltoids', 'triceps']::text[], '머신', '밀기', '복합관절', array['숄더프레스 머신', 'Shoulder Press Machine']::text[]),
    ('사이드 레터럴 레이즈', array['front-deltoids']::text[], '덤벨', '밀기', '단관절', array['사레레', '레터럴 레이즈', '측면 레이즈', 'Lateral Raise']::text[]),
    ('프론트 레이즈', array['front-deltoids']::text[], '덤벨', '밀기', '단관절', array['Front Raise']::text[]),
    ('벤트오버 레터럴 레이즈', array['back-deltoids', 'upper-back']::text[], '덤벨', '당기기', '단관절', array['리어 델트 레이즈', '후면 레이즈', 'Rear Delt Raise']::text[]),
    ('리버스 펙덱', array['back-deltoids', 'upper-back']::text[], '머신', '당기기', '단관절', array['리어 델트 플라이', 'Reverse Pec Deck', 'Rear Delt Fly']::text[]),
    ('페이스 풀', array['back-deltoids', 'upper-back', 'trapezius']::text[], '케이블', '당기기', '복합관절', array['Face Pull']::text[]),
    ('바벨 컬', array['biceps', 'forearm']::text[], '바벨', '당기기', '단관절', array['바벨컬', 'Barbell Curl']::text[]),
    ('덤벨 컬', array['biceps', 'forearm']::text[], '덤벨', '당기기', '단관절', array['덤벨컬', 'Dumbbell Curl']::text[]),
    ('해머 컬', array['biceps', 'forearm']::text[], '덤벨', '당기기', '단관절', array['해머컬', 'Hammer Curl']::text[]),
    ('케이블 푸시다운', array['triceps']::text[], '케이블', '밀기', '단관절', array['푸시다운', '트라이셉스 푸시다운', 'Triceps Pushdown']::text[]),
    ('라잉 트라이셉스 익스텐션', array['triceps']::text[], '바벨', '밀기', '단관절', array['스컬크러셔', '라잉 익스텐션', 'Skull Crusher']::text[]),
    ('오버헤드 트라이셉스 익스텐션', array['triceps']::text[], '덤벨', '밀기', '단관절', array['오버헤드 익스텐션', '프렌치 프레스', 'French Press']::text[]),
    ('클로즈그립 벤치프레스', array['triceps', 'chest', 'front-deltoids']::text[], '바벨', '밀기', '복합관절', array['클로즈 그립 벤치', 'Close-grip Bench Press', 'CGBP']::text[]),
    ('리스트 컬', array['forearm']::text[], '바벨', '당기기', '단관절', array['손목 컬', 'Wrist Curl']::text[]),
    ('스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '바벨', '스쿼트', '복합관절', array['백스쿼트', '바벨 스쿼트', 'Back Squat', 'Squat']::text[]),
    ('프론트 스쿼트', array['quadriceps', 'gluteal']::text[], '바벨', '스쿼트', '복합관절', array['Front Squat']::text[]),
    ('스미스머신 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '스미스머신', '스쿼트', '복합관절', array['스미스 스쿼트', 'Smith Squat']::text[]),
    ('고블릿 스쿼트', array['quadriceps', 'gluteal']::text[], '덤벨', '스쿼트', '복합관절', array['Goblet Squat']::text[]),
    ('레그프레스', array['quadriceps', 'gluteal', 'hamstring']::text[], '머신', '스쿼트', '복합관절', array['레그 프레스', 'Leg Press']::text[]),
    ('레그 익스텐션', array['quadriceps']::text[], '머신', '스쿼트', '단관절', array['레그익스텐션', 'Leg Extension']::text[]),
    ('레그 컬', array['hamstring']::text[], '머신', '힌지', '단관절', array['레그컬', '라잉 레그 컬', '시티드 레그 컬', '햄스트링 컬', 'Leg Curl']::text[]),
    ('런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['Lunge']::text[]),
    ('불가리안 스플릿 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['불가리안 스쿼트', 'Bulgarian Split Squat', 'BSS']::text[]),
    ('힙 쓰러스트', array['gluteal', 'hamstring']::text[], '바벨', '힌지', '복합관절', array['힙쓰러스트', '힙 스러스트', 'Hip Thrust']::text[]),
    ('힙 어브덕션', array['abductors', 'gluteal']::text[], '머신', '기타', '단관절', array['어브덕터', '외전 머신', 'Hip Abduction']::text[]),
    ('힙 어덕션', array['adductor']::text[], '머신', '기타', '단관절', array['어덕터', '내전 머신', 'Hip Adduction']::text[]),
    ('카프 레이즈', array['calves']::text[], '머신', '기타', '단관절', array['종아리 레이즈', 'Calf Raise']::text[]),
    ('플랭크', array['abs', 'obliques']::text[], '맨몸', '코어', '복합관절', array['Plank']::text[]),
    ('크런치', array['abs']::text[], '맨몸', '코어', '단관절', array['복근 운동', 'Crunch']::text[]),
    ('레그 레이즈', array['abs']::text[], '맨몸', '코어', '단관절', array['누워서 다리 들기', 'Leg Raise']::text[]),
    ('행잉 레그 레이즈', array['abs', 'obliques']::text[], '맨몸', '코어', '단관절', array['매달려 다리 들기', 'Hanging Leg Raise']::text[]),
    ('케이블 크런치', array['abs']::text[], '케이블', '코어', '단관절', array['로프 크런치', 'Cable Crunch']::text[]),
    ('러시안 트위스트', array['obliques', 'abs']::text[], '맨몸', '코어', '단관절', array['Russian Twist']::text[]),
    ('사이드 플랭크', array['obliques']::text[], '맨몸', '코어', '복합관절', array['Side Plank']::text[]),
    ('디클라인 벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '바벨', '밀기', '복합관절', array['디클라인 벤치', 'Decline Bench Press']::text[]),
    ('스미스머신 인클라인 프레스', array['chest', 'front-deltoids', 'triceps']::text[], '스미스머신', '밀기', '복합관절', array['스미스 인클라인', 'Smith Incline Press']::text[]),
    ('인클라인 체스트 프레스 머신', array['chest', 'front-deltoids', 'triceps']::text[], '머신', '밀기', '복합관절', array['인클라인 머신 프레스', 'Incline Chest Press Machine']::text[]),
    ('케이블 체스트 프레스', array['chest', 'triceps', 'front-deltoids']::text[], '케이블', '밀기', '복합관절', array['Cable Chest Press']::text[]),
    ('케이블 플라이', array['chest', 'front-deltoids']::text[], '케이블', '밀기', '단관절', array['케이블 체스트 플라이', 'Cable Fly']::text[]),
    ('덤벨 풀오버', array['chest', 'upper-back', 'triceps']::text[], '덤벨', '당기기', '단관절', array['풀오버', 'Pullover']::text[]),
    ('다이아몬드 푸시업', array['triceps', 'chest', 'front-deltoids']::text[], '맨몸', '밀기', '복합관절', array['클로즈 푸시업', 'Diamond Push-up']::text[]),
    ('디클라인 푸시업', array['chest', 'front-deltoids', 'triceps']::text[], '맨몸', '밀기', '복합관절', array['Decline Push-up']::text[]),
    ('스티프레그 데드리프트', array['hamstring', 'gluteal', 'lower-back']::text[], '바벨', '힌지', '복합관절', array['스티프 데드', 'Stiff-leg Deadlift', 'SLDL']::text[]),
    ('덤벨 루마니안 데드리프트', array['hamstring', 'gluteal', 'lower-back']::text[], '덤벨', '힌지', '복합관절', array['덤벨 RDL', 'Dumbbell Romanian Deadlift']::text[]),
    ('트랩바 데드리프트', array['quadriceps', 'gluteal', 'hamstring', 'lower-back', 'trapezius']::text[], '바벨', '힌지', '복합관절', array['헥스바 데드리프트', 'Trap Bar Deadlift', 'Hex Bar Deadlift']::text[]),
    ('스모 데드리프트', array['gluteal', 'adductor', 'quadriceps', 'hamstring']::text[], '바벨', '힌지', '복합관절', array['스모 데드', 'Sumo Deadlift']::text[]),
    ('굿모닝', array['hamstring', 'lower-back', 'gluteal']::text[], '바벨', '힌지', '복합관절', array['바벨 굿모닝', 'Good Morning']::text[]),
    ('티바 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '바벨', '당기기', '복합관절', array['T바 로우', 'T-bar Row']::text[]),
    ('스미스머신 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '스미스머신', '당기기', '복합관절', array['스미스 로우', 'Smith Row']::text[]),
    ('시티드 머신 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '머신', '당기기', '복합관절', array['머신 로우', 'Seated Row Machine']::text[]),
    ('인버티드 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '맨몸', '당기기', '복합관절', array['바디웨이트 로우', '호주식 턱걸이', 'Inverted Row']::text[]),
    ('와이드그립 랫풀다운', array['upper-back', 'biceps', 'back-deltoids']::text[], '케이블', '당기기', '복합관절', array['와이드 랫풀다운', 'Wide-grip Lat Pulldown']::text[]),
    ('스트레이트암 풀다운', array['upper-back']::text[], '케이블', '당기기', '단관절', array['스트레이트 암 풀다운', 'Straight-arm Pulldown']::text[]),
    ('어시스티드 풀업', array['upper-back', 'biceps']::text[], '머신', '당기기', '복합관절', array['어시스트 턱걸이', 'Assisted Pull-up']::text[]),
    ('업라이트 로우', array['trapezius', 'front-deltoids']::text[], '바벨', '당기기', '복합관절', array['Upright Row']::text[]),
    ('스미스머신 숄더프레스', array['front-deltoids', 'triceps']::text[], '스미스머신', '밀기', '복합관절', array['스미스 숄더프레스', 'Smith Shoulder Press']::text[]),
    ('케이블 레터럴 레이즈', array['front-deltoids']::text[], '케이블', '밀기', '단관절', array['Cable Lateral Raise']::text[]),
    ('밴드 풀 어파트', array['back-deltoids', 'upper-back', 'trapezius']::text[], '밴드', '당기기', '단관절', array['풀어파트', 'Band Pull-apart']::text[]),
    ('프리처 컬', array['biceps']::text[], '덤벨', '당기기', '단관절', array['프리쳐 컬', 'Preacher Curl']::text[]),
    ('EZ바 컬', array['biceps', 'forearm']::text[], '바벨', '당기기', '단관절', array['이지바 컬', 'EZ컬', 'EZ Bar Curl']::text[]),
    ('인클라인 덤벨 컬', array['biceps']::text[], '덤벨', '당기기', '단관절', array['Incline Dumbbell Curl']::text[]),
    ('컨센트레이션 컬', array['biceps']::text[], '덤벨', '당기기', '단관절', array['Concentration Curl']::text[]),
    ('케이블 컬', array['biceps', 'forearm']::text[], '케이블', '당기기', '단관절', array['Cable Curl']::text[]),
    ('밴드 컬', array['biceps']::text[], '밴드', '당기기', '단관절', array['Band Curl']::text[]),
    ('리버스 컬', array['forearm', 'biceps']::text[], '바벨', '당기기', '단관절', array['Reverse Curl']::text[]),
    ('트라이셉스 킥백', array['triceps']::text[], '덤벨', '밀기', '단관절', array['킥백', 'Triceps Kickback']::text[]),
    ('케이블 오버헤드 트라이셉스 익스텐션', array['triceps']::text[], '케이블', '밀기', '단관절', array['케이블 오버헤드 익스텐션']::text[]),
    ('밴드 푸시다운', array['triceps']::text[], '밴드', '밀기', '단관절', array['Band Pushdown']::text[]),
    ('벤치 딥스', array['triceps', 'front-deltoids', 'chest']::text[], '벤치', '밀기', '복합관절', array['벤치 딥', 'Bench Dips']::text[]),
    ('바디웨이트 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '맨몸', '스쿼트', '복합관절', array['맨몸 스쿼트', '에어 스쿼트', 'Bodyweight Squat']::text[]),
    ('핵 스쿼트', array['quadriceps', 'gluteal']::text[], '머신', '스쿼트', '복합관절', array['핵스쿼트', 'Hack Squat']::text[]),
    ('월싯', array['quadriceps']::text[], '맨몸', '스쿼트', '복합관절', array['Wall Sit']::text[]),
    ('스텝업', array['quadriceps', 'gluteal']::text[], '덤벨', '런지', '복합관절', array['Step-up']::text[]),
    ('리버스 런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['후방 런지', 'Reverse Lunge']::text[]),
    ('워킹 런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['Walking Lunge']::text[]),
    ('사이드 런지', array['adductor', 'quadriceps', 'gluteal']::text[], '덤벨', '런지', '복합관절', array['측면 런지', 'Side Lunge']::text[]),
    ('글루트 브릿지', array['gluteal', 'hamstring']::text[], '맨몸', '힌지', '복합관절', array['힙 브릿지', 'Glute Bridge']::text[]),
    ('케이블 킥백', array['gluteal']::text[], '케이블', '힌지', '단관절', array['글루트 킥백', 'Cable Kickback']::text[]),
    ('케틀벨 스윙', array['gluteal', 'hamstring', 'lower-back']::text[], '기타', '힌지', '복합관절', array['KB 스윙', 'Kettlebell Swing']::text[]),
    ('시티드 카프 레이즈', array['calves']::text[], '머신', '기타', '단관절', array['Seated Calf Raise']::text[]),
    ('스탠딩 카프 레이즈', array['calves']::text[], '맨몸', '기타', '단관절', array['Standing Calf Raise']::text[]),
    ('싯업', array['abs']::text[], '맨몸', '코어', '단관절', array['윗몸일으키기', 'Sit-up']::text[]),
    ('바이시클 크런치', array['abs', 'obliques']::text[], '맨몸', '코어', '단관절', array['Bicycle Crunch']::text[]),
    ('데드버그', array['abs']::text[], '맨몸', '코어', '복합관절', array['Dead Bug']::text[]),
    ('AB 롤아웃', array['abs']::text[], '기타', '코어', '복합관절', array['앱 롤러', '복근 롤러', 'AB 휠', 'Ab Wheel']::text[]),
    ('케이블 우드초퍼', array['obliques', 'abs']::text[], '케이블', '코어', '복합관절', array['우드초퍼', 'Wood Chop']::text[]),
    ('팔로프 프레스', array['obliques', 'abs']::text[], '케이블', '코어', '복합관절', array['Pallof Press']::text[]),
    ('불가리안백 스윙', array['gluteal', 'hamstring', 'lower-back']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 스윙', 'Bulgarian Bag Swing']::text[]),
    ('불가리안백 스윙 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '불가리안백', '스쿼트', '복합관절', array['Swing Squat', 'Bulgarian Bag Swing Squat']::text[]),
    ('불가리안백 스핀', array['front-deltoids', 'obliques', 'abs', 'forearm']::text[], '불가리안백', '코어', '복합관절', array['불가리안 백 스핀', 'Bulgarian Bag Spin']::text[]),
    ('불가리안백 클린', array['quadriceps', 'gluteal', 'hamstring', 'upper-back']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 클린', 'Bulgarian Bag Clean']::text[]),
    ('불가리안백 스내치', array['gluteal', 'hamstring', 'upper-back', 'front-deltoids']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 스내치', 'Bulgarian Bag Snatch']::text[]),
    ('불가리안백 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '불가리안백', '스쿼트', '복합관절', array['불가리안 백 스쿼트', 'Bulgarian Bag Squat']::text[]),
    ('불가리안백 런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '불가리안백', '런지', '복합관절', array['불가리안 백 런지', 'Bulgarian Bag Lunge']::text[]),
    ('불가리안백 굿모닝', array['hamstring', 'lower-back', 'gluteal']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 굿모닝', 'Bulgarian Bag Good Morning']::text[]),
    ('불가리안백 러시안 트위스트', array['obliques', 'abs']::text[], '불가리안백', '코어', '단관절', array['불가리안 백 러시안 트위스트', 'Bulgarian Bag Russian Twist']::text[])
  ),
  filled as (
    update public.exercises e
    set movement_pattern = coalesce(e.movement_pattern, v.movement_pattern),
        exercise_type    = coalesce(e.exercise_type, v.exercise_type),
        tags             = case when e.tags = '{}' then v.tags else e.tags end
    from v
    where e.user_id = p_user and e.name = v.name
    returning e.id
  )
  insert into public.exercises (user_id, name, muscles, equipment, movement_pattern, exercise_type, tags)
  select p_user, v.name, v.muscles, v.equipment, v.movement_pattern, v.exercise_type, v.tags
  from v
  where not exists (
    select 1 from public.exercises e where e.user_id = p_user and e.name = v.name
  );
$$;

-- 클라이언트(브라우저)에서는 호출할 수 없게 막는다. 아래 트리거와 이 SQL 실행 때만 쓰인다.
revoke all on function public.seed_default_exercises(uuid) from public;

-- 3) 이미 가입한 모든 사용자에게 채운다
select public.seed_default_exercises(id) from auth.users;

-- 4) 앞으로 가입하는 사용자에게도 자동으로 채운다 (profiles 행이 만들어질 때)
create or replace function public.seed_exercises_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_exercises(new.id);
  return new;
end;
$$;

drop trigger if exists on_profile_created_seed_exercises on public.profiles;
create trigger on_profile_created_seed_exercises
  after insert on public.profiles
  for each row execute function public.seed_exercises_for_new_user();

-- 신규 가입자에게 자동으로 넣고 싶지 않다면 아래 줄의 주석을 풀어 트리거만 제거하세요.
-- drop trigger if exists on_profile_created_seed_exercises on public.profiles;
