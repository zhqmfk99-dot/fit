import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const sql = f => fs.readFileSync(new URL(`../../supabase/${f}`, import.meta.url), 'utf8')
const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222'

// Supabase를 흉내 낸 최소 환경: auth 스키마, auth.uid(), 역할(anon·authenticated)
async function newDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
    grant select on auth.users to authenticated;
  `)
  return db
}
const as = async (db, role, uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`)
}
const rejects = async (p, re) => { try { await p; } catch (e) { assert.match(String(e.message), re, e.message); return e } assert.fail('오류가 나야 함') }

// ───────── ai_usage.sql: 테이블·정책·consume_ai_usage ─────────
{
  const db = await newDb()
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'a@x.com'), ('${U2}', 'b@x.com')`)
  await db.exec(sql('ai_usage.sql'))
  await db.exec(sql('ai_usage.sql')) // 다시 실행해도 안전(멱등)

  // 로그인 안 한 상태: 거부(42501)
  await as(db, 'authenticated', null)
  let e = await rejects(db.query(`select public.consume_ai_usage('routine', 3)`), /not authenticated/)
  assert.equal(e.code, '42501')
  // anon은 함수 실행 권한이 없다
  await as(db, 'anon', null)
  await rejects(db.query(`select public.consume_ai_usage('routine', 3)`), /permission denied/)

  // 정상: 한도 3 → 남은 횟수 2,1,0, 그다음 -1(기록 안 함)
  await as(db, 'authenticated', U1)
  const call = async (u, kind, limit) => (await db.query(`select public.consume_ai_usage($1, $2) as r`, [kind, limit])).rows[0].r
  assert.deepEqual([await call(U1, 'routine', 3), await call(U1, 'routine', 3), await call(U1, 'routine', 3), await call(U1, 'routine', 3), await call(U1, 'routine', 3)], [2, 1, 0, -1, -1])
  let n = (await db.query(`select count(*)::int c from public.ai_usage where kind = 'routine'`)).rows[0].c
  assert.equal(n, 3, '한도를 넘긴 호출은 기록하지 않아야 함')
  // 종류별로 따로 센다
  assert.equal(await call(U1, 'review', 3), 2)
  // 다른 사용자는 영향이 없다
  await as(db, 'authenticated', U2)
  assert.equal(await call(U2, 'routine', 3), 2)
  // 행 수준 보안: 다른 사용자의 행은 보이지 않는다
  n = (await db.query(`select count(*)::int c from public.ai_usage`)).rows[0].c
  assert.equal(n, 1)
  // 24시간이 지난 기록은 세지 않는다(관리자 권한으로 과거 기록 삽입)
  await db.exec(`reset role`)
  await db.exec(`insert into public.ai_usage (user_id, kind, created_at) values ('${U2}', 'old', now() - interval '25 hours'), ('${U2}', 'old', now() - interval '25 hours')`)
  await as(db, 'authenticated', U2)
  assert.equal(await call(U2, 'old', 2), 1)     // 25시간 전 2건은 무시 → 첫 호출이 통과(남은 1)
  assert.equal(await call(U2, 'old', 2), 0)
  assert.equal(await call(U2, 'old', 2), -1)
  // 한도 0이면 항상 -1, 잘못된 인자는 오류
  assert.equal(await call(U2, 'zero', 0), -1)
  await rejects(db.query(`select public.consume_ai_usage('', 3)`), /invalid arguments/)
  await rejects(db.query(`select public.consume_ai_usage('x', -1)`), /invalid arguments/)
  await rejects(db.query(`select public.consume_ai_usage('xxxxxxxxxxxxxxxxxxxxxxxxx', 3)`), /invalid arguments/)
  await rejects(db.query(`select public.consume_ai_usage(null, 3)`), /invalid arguments/)
  // 사용자는 삭제·수정을 못 한다(한도 초기화 방지)
  await rejects(db.query(`delete from public.ai_usage`), /permission denied/)
  await rejects(db.query(`update public.ai_usage set kind = 'x'`), /permission denied/)
  await db.close()
  console.log('OK: ai_usage.sql(consume_ai_usage) 통과')
}

// ───────── 같은 사용자의 동시 호출(트랜잭션 두 개)은 잠금으로 순서대로 처리된다 — PGlite는 연결이 하나라 직접 재현은 못 하고, 잠금 호출이 오류 없이 도는지만 확인
{
  const db = await newDb()
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'a@x.com')`)
  await db.exec(sql('ai_usage.sql'))
  await as(db, 'authenticated', U1)
  await db.exec('begin')
  assert.equal((await db.query(`select public.consume_ai_usage('routine', 2) as r`)).rows[0].r, 1)
  assert.equal((await db.query(`select pg_try_advisory_xact_lock(hashtextextended('${U1}:routine', 0)) as ok`)).rows[0].ok, true) // 같은 세션이라 이미 잡은 잠금은 재진입 가능
  await db.exec('commit')
  await db.close()
  console.log('OK: 잠금 호출 구문 통과')
}

// ───────── 이메일 마스킹: 기존 설치(auth_profiles.sql → mask_find_ids.sql)와 새 설치(auth_profiles.sql만) 모두 ─────────
for (const mode of ['기존 설치 + mask_find_ids.sql', '새 설치(auth_profiles.sql만)']) {
  const db = await newDb()
  const people = [
    ['10000000-0000-0000-0000-000000000001', 'zhqmfk99@gmail.com', '문기훈'],
    ['10000000-0000-0000-0000-000000000002', 'ab@x.com', '문기훈'],
    ['10000000-0000-0000-0000-000000000003', 'abcd@fursyspartners.com', '문기훈'],
    ['10000000-0000-0000-0000-000000000004', 'longaddress.name+tag@naver.com', '문기훈'],
    ['10000000-0000-0000-0000-000000000005', 'user5@a.co', '문기훈'],
    ['10000000-0000-0000-0000-000000000006', 'user6@a.co', '문기훈'],
    ['10000000-0000-0000-0000-000000000007', 'other@a.co', '다른사람'],
  ]
  await db.exec(`insert into auth.users (id, email) values ${people.map(p => `('${p[0]}', '${p[1]}')`).join(',')}`)
  await db.exec(sql('auth_profiles.sql'))
  await db.exec(`update public.profiles set name = (case id ${people.map(p => `when '${p[0]}' then '${p[2]}'`).join(' ')} end)::text`)
  if (mode.startsWith('기존')) {
    // 마스킹 전 상태(원래 함수)를 먼저 재현: 전체 이메일이 나온다
    await db.exec(`create or replace function public.find_ids_by_name(p_name text) returns table (email text) language sql security definer set search_path = '' stable as $$ select p.email from public.profiles p where lower(trim(p.name)) = lower(trim(p_name)) order by p.created_at $$;`)
    await as(db, 'anon', null)
    const before = (await db.query(`select * from public.find_ids_by_name('문기훈')`)).rows.map(r => r.email)
    assert.ok(before.includes('zhqmfk99@gmail.com'), '마스킹 전에는 전체 이메일이 노출됨(취약점 재현)')
    await db.exec('reset role')
    await db.exec(sql('mask_find_ids.sql'))
    await db.exec(sql('mask_find_ids.sql')) // 멱등
  }
  await as(db, 'anon', null)
  const rows = (await db.query(`select * from public.find_ids_by_name('  문기훈  ')`)).rows.map(r => r.email)
  assert.equal(rows.length, 5, '최대 5개만')
  assert.ok(rows.every(m => m.includes('*') || !m.includes('@') === false), '모두 가려져 있어야 함')
  assert.ok(!rows.some(m => ['zhqmfk99@gmail.com', 'ab@x.com', 'abcd@fursyspartners.com'].includes(m)), '전체 이메일이 그대로 나오면 안 됨')
  // 가입 순서(created_at)대로 — 같은 시각이면 순서 보장이 없으니 집합으로 비교
  const expected = new Set(['zh*****99@gmail.com', 'a*@x.com', 'a***@fursyspartners.com', 'lo*********************ag@naver.com', 'u***5@a.co'].map(x => x))
  // 계산 규칙 검증: 4자 이하는 첫 글자만, 그보다 길면 앞 2·뒤 2
  const m = async e => (await db.query(`select public.mask_email($1) as m`, [e]).catch(err => ({ rows: [{ m: 'ERR:' + err.message }] }))).rows[0].m
  await db.exec('reset role')
  assert.equal(await m('zhqmfk99@gmail.com'), 'zh****99@gmail.com')
  assert.equal(await m('ab@x.com'), 'a*@x.com')
  assert.equal(await m('abcd@x.com'), 'a***@x.com')
  assert.equal(await m('abcde@x.com'), 'ab*de@x.com')
  assert.equal(await m('a@x.com'), 'a@x.com')
  assert.equal(await m('@x.com'), '@x.com')
  assert.equal(await m('no-at-sign'), 'no-at-sign')
  assert.equal(await m(null), '')
  // 이름 없음·모르는 이름은 빈 결과, 빈 문자열은 빈 결과
  await as(db, 'anon', null)
  assert.equal((await db.query(`select * from public.find_ids_by_name('없는이름')`)).rows.length, 0)
  assert.equal((await db.query(`select * from public.find_ids_by_name('   ')`)).rows.length, 0)
  assert.equal((await db.query(`select * from public.find_ids_by_name('다른사람')`)).rows.map(r => r.email)[0], 'o***r@a.co'.replace('o***r', 'ot*er'))
  // anon은 profiles를 직접 읽을 수 없고 mask_email도 직접 못 부른다
  await rejects(db.query(`select * from public.profiles`), /permission denied/)
  await rejects(db.query(`select public.mask_email('a@b.c')`), /permission denied/)
  // check_id_name(비밀번호 찾기 본인 확인)은 그대로 동작
  assert.equal((await db.query(`select public.check_id_name('zhqmfk99@gmail.com', '문기훈') as ok`)).rows[0].ok, true)
  assert.equal((await db.query(`select public.check_id_name('zhqmfk99@gmail.com', '다른사람') as ok`)).rows[0].ok, false)
  await db.close()
  console.log(`OK: 이메일 마스킹 통과 — ${mode}`)
}
// ───────── auth_rate_limit.sql: 아이디 찾기·비밀번호 찾기 본인 확인의 요청 횟수 제한 ─────────
{
  const db = await newDb()
  await db.exec(`insert into auth.users (id, email) values ('10000000-0000-0000-0000-000000000001', 'zhqmfk99@gmail.com'), ('10000000-0000-0000-0000-000000000002', 'other@a.co')`)
  await db.exec(sql('auth_profiles.sql'))
  await db.exec(`update public.profiles set name = (case id when '10000000-0000-0000-0000-000000000001' then '문기훈' else '다른사람' end)::text`)
  // 마스킹 함수가 없는 상태에서는 실행을 거부한다(안내 문구)
  const bare = await newDb()
  await rejects(bare.exec(sql('auth_rate_limit.sql')), /mask_find_ids\.sql/)
  await bare.close()
  await db.exec(sql('auth_rate_limit.sql'))
  await db.exec(sql('auth_rate_limit.sql')) // 멱등

  const setHeaders = async obj => db.query(`select set_config('request.headers', $1, false)`, [typeof obj === 'string' ? obj : JSON.stringify(obj)])
  const find = async () => (await db.query(`select * from public.find_ids_by_name('문기훈')`)).rows.map(r => r.email)
  const check = async () => (await db.query(`select public.check_id_name('zhqmfk99@gmail.com', '문기훈') as ok`)).rows[0].ok
  const count = async (kind, bucket) => {
    await db.exec('reset role')
    const r = (await db.query(`select count(*)::int c from public.auth_lookup_attempts where kind = $1 and ($2::text is null or bucket = $2)`, [kind, bucket ?? null])).rows[0].c
    await as(db, 'anon', null)
    return r
  }

  // 결과는 그대로(마스킹·최대 5개), 호출은 기록된다 — IP는 x-forwarded-for의 마지막 값(맨 앞 값은 속일 수 있어 쓰지 않음)
  await as(db, 'anon', null)
  await setHeaders({ 'x-forwarded-for': '6.6.6.6, 9.9.9.9' })
  assert.deepEqual(await find(), ['zh****99@gmail.com'])
  assert.equal(await check(), true)
  assert.equal(await count('find_id', '9.9.9.9'), 1)
  assert.equal(await count('check_id', '9.9.9.9'), 1)
  assert.equal(await count('find_id', '6.6.6.6'), 0)

  // 같은 IP에서 10번까지 되고 11번째는 막힌다(종류별로 따로 센다)
  await setHeaders({ 'x-forwarded-for': '1.1.1.1' })
  for (let i = 0; i < 10; i++) await find()
  const e = await rejects(find(), /rate_limited/)
  assert.equal(e.code, 'P0001')
  assert.equal(await count('find_id', '1.1.1.1'), 10) // 막힌 호출은 기록하지 않는다
  assert.equal(await check(), true) // 아이디 찾기가 막혀도 비밀번호 찾기 확인은 따로 센다
  for (let i = 0; i < 9; i++) await check()
  await rejects(check(), /rate_limited/)

  // 다른 IP는 영향 없음 / 헤더가 없으면 'unknown' 한 묶음
  await setHeaders({ 'x-forwarded-for': '2.2.2.2' })
  assert.deepEqual(await find(), ['zh****99@gmail.com'])
  await setHeaders({})
  assert.equal((await find()).length, 1)
  assert.equal(await count('find_id', 'unknown'), 1)
  // cf-connecting-ip가 있으면 그것이 우선(x-forwarded-for보다)
  await setHeaders({ 'cf-connecting-ip': '7.7.7.7', 'x-forwarded-for': '8.8.8.8' })
  await find()
  assert.equal(await count('find_id', '7.7.7.7'), 1)
  assert.equal(await count('find_id', '8.8.8.8'), 0)
  // 깨진 헤더 값도 오류 없이 'unknown'으로
  await setHeaders('not json')
  await find()
  assert.equal(await count('find_id', 'unknown'), 2)

  // 10분이 지나면 다시 된다
  await db.exec('reset role')
  await db.exec(`update public.auth_lookup_attempts set at = now() - interval '11 minutes' where bucket = '1.1.1.1'`)
  await as(db, 'anon', null)
  await setHeaders({ 'x-forwarded-for': '1.1.1.1' })
  assert.equal((await find()).length, 1)
  // 하루 지난 기록은 호출할 때 지운다
  await db.exec('reset role')
  await db.exec(`update public.auth_lookup_attempts set at = now() - interval '2 days' where bucket = '2.2.2.2'`)
  await as(db, 'anon', null)
  await find()
  assert.equal(await count('find_id', '2.2.2.2'), 0)

  // 전체 제한: 서로 다른 IP로 200번이 쌓이면 그다음은 어떤 IP든 막힌다(다른 종류는 영향 없음)
  await db.exec('reset role')
  await db.exec(`delete from public.auth_lookup_attempts`)
  await db.exec(`insert into public.auth_lookup_attempts (kind, bucket) select 'find_id', 'bulk-' || g from generate_series(1, 200) g`)
  await as(db, 'anon', null)
  await setHeaders({ 'x-forwarded-for': '3.3.3.3' })
  await rejects(find(), /rate_limited/)
  assert.equal(await check(), true)

  // anon은 기록 테이블·검사 함수에 직접 접근할 수 없다
  await rejects(db.query(`select * from public.auth_lookup_attempts`), /permission denied/)
  await rejects(db.query(`insert into public.auth_lookup_attempts (kind, bucket) values ('x', 'y')`), /permission denied/)
  await rejects(db.query(`select public.auth_lookup_guard('find_id', 1000, 1000, interval '1 minute')`), /permission denied/)
  await as(db, 'authenticated', null)
  await rejects(db.query(`select * from public.auth_lookup_attempts`), /permission denied/)
  await db.close()
  console.log('OK: 아이디 찾기 요청 횟수 제한 통과')
}
// ───────── points.sql: 운동한 날 +10, 주간 목표 달성 주 +30 (서버가 workout_logs·설정을 직접 읽어 지급) ─────────
{
  const db = await newDb()
  for (const f of ['schema.sql', 'auth_profiles.sql', 'profile_fields.sql', 'user_settings.sql']) await db.exec(sql(f))
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'a@x.com'), ('${U2}', 'b@x.com')`) // 프로필은 가입 트리거가 만든다
  await db.exec(sql('points.sql'))
  await db.exec(sql('points.sql')) // 다시 실행해도 안전(멱등)

  const KST = `(now() at time zone 'Asia/Seoul')::date`
  const MON = `date_trunc('week', ${KST}::timestamp)::date` // 이번 주 월요일
  const log = (u, date, sets, done = true) => db.exec(`insert into public.workout_logs (user_id, date, exercise, performed_sets, is_completed) values ('${u}', ${date}, '벤치프레스', '${JSON.stringify(sets)}'::jsonb, ${done})`)
  const claim = async () => Number((await db.query(`select public.claim_points() as r`)).rows[0].r)
  const events = async () => (await db.query(`select kind, ref, points from public.point_events order by kind, ref`)).rows

  // 로그인 안 한 상태·anon은 거부
  await as(db, 'authenticated', null)
  await rejects(db.query(`select public.claim_points()`), /not authenticated/)
  await as(db, 'anon', null)
  await rejects(db.query(`select public.claim_points()`), /permission denied/)

  // U1: 오늘 완료(+10). 횟수 0·미완료·14일 밖 기록은 지급 대상이 아니다
  await db.exec('reset role')
  await log(U1, KST, [{ reps: 8, weight: 60 }])
  await log(U1, `${KST} - 1`, [{ reps: 0, weight: 60 }])
  await log(U1, `${KST} - 2`, [{ reps: 8, weight: 60 }], false)
  await log(U1, `${KST} - 30`, [{ reps: 8, weight: 60 }])
  await as(db, 'authenticated', U1)
  assert.equal(await claim(), 10)
  assert.equal(await claim(), 0, '같은 날은 한 번만 지급')
  let ev = await events()
  assert.equal(ev.length, 1)
  assert.equal(ev[0].kind, 'workout_day')

  // 주간 목표가 없거나 범위 밖이면 +30은 없다 → 목표 1일로 설정하면 이번 주 +30
  await db.exec(`update public.profiles set settings = '{"weeklyGoalDays": 9}' where id = '${U1}'`)
  assert.equal(await claim(), 0)
  await db.exec(`update public.profiles set settings = '{"weeklyGoalDays": 1}' where id = '${U1}'`)
  assert.equal(await claim(), 30)
  assert.equal(await claim(), 0)
  ev = await events()
  assert.deepEqual(ev.map(e => e.kind), ['weekly_goal', 'workout_day'])
  assert.equal((await db.query(`select (ref = ${MON}::text) as same from public.point_events where kind = 'weekly_goal'`)).rows[0].same, true)

  // U2: 지난주 월·화 운동, 목표 2일 — 하루만 했을 땐 +10, 이틀째에 그 주 +30까지
  await db.exec('reset role')
  await db.exec(`update public.profiles set settings = '{"weeklyGoalDays": 2}' where id = '${U2}'`)
  await log(U2, `${MON} - 7`, [{ reps: 5, weight: 0 }])
  await as(db, 'authenticated', U2)
  assert.equal(await claim(), 10)
  await db.exec('reset role')
  await log(U2, `${MON} - 6`, [{ reps: 5, weight: 0 }])
  await as(db, 'authenticated', U2)
  assert.equal(await claim(), 10 + 30)
  assert.equal((await events()).length, 3)

  // 행 수준 보안: 다른 사람의 내역은 안 보이고, 직접 쓰기·수정·삭제·내부 함수 호출은 안 된다
  await as(db, 'authenticated', U1)
  assert.equal((await events()).length, 2)
  await rejects(db.query(`insert into public.point_events (kind, ref, points) values ('workout_day', 'x', 9999)`), /permission denied/)
  await rejects(db.query(`update public.point_events set points = 9999`), /permission denied/)
  await rejects(db.query(`delete from public.point_events`), /permission denied/)
  await rejects(db.query(`select * from public._point_days('${U2}', ${KST} - 30, ${KST})`), /permission denied/)
  await as(db, 'anon', null)
  await rejects(db.query(`select * from public.point_events`), /permission denied/)
  await db.close()
  console.log('OK: points.sql(claim_points) 통과')
}
// ───────── points.sql: 펫(알 받기·먹이 주기·부화·다 자람·도감) ─────────
{
  const db = await newDb()
  for (const f of ['schema.sql', 'auth_profiles.sql', 'profile_fields.sql', 'user_settings.sql']) await db.exec(sql(f))
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'a@x.com'), ('${U2}', 'b@x.com')`)
  await db.exec(sql('points.sql'))
  await db.exec(sql('points.sql')) // 다시 실행해도 안전(멱등)

  const give = (u, n) => db.exec(`insert into public.point_events (user_id, kind, ref, points) select '${u}', 'workout_day', 'd' || g, 10 from generate_series(1, ${n}) g`)
  const balance = async () => Number((await db.query(`select coalesce(sum(points), 0)::int as b from public.point_events`)).rows[0].b)
  const pet = async () => (await db.query(`select id, species, xp, hatched_at is not null as hatched, completed_at is not null as done from public.pets order by created_at desc, id limit 1`)).rows[0]
  const feed = n => db.query(`select public.pet_feed($1)`, [n])
  const adopt = () => db.query(`select public.pet_adopt() as id`)

  // 로그인 안 한 상태·anon은 거부
  await as(db, 'authenticated', null)
  await rejects(adopt(), /not authenticated/)
  await rejects(feed(5), /not authenticated/)
  await as(db, 'anon', null)
  await rejects(adopt(), /permission denied/)
  await rejects(feed(5), /permission denied/)

  // U1: 포인트 300P(운동한 날 30번) — 펫이 없으면 먹이를 못 준다. 첫 알은 무료(내역이 안 생김)
  await db.exec('reset role')
  await give(U1, 30)
  await as(db, 'authenticated', U1)
  await rejects(feed(5), /no_pet/)
  await adopt()
  assert.equal(await balance(), 300, '첫 알은 무료')
  assert.equal(Number((await db.query(`select public.point_balance() as b`)).rows[0].b), 300, 'point_balance는 본인 행의 합')
  assert.deepEqual([(await pet()).xp, (await pet()).species, (await pet()).hatched], [0, null, false])
  await rejects(adopt(), /already_has_pet/)

  // 먹이 양 검증, 부화(20): 종류가 정해진다
  for (const bad of [0, -1, 51, null]) await rejects(feed(bad), /invalid_amount/)
  await feed(10)
  assert.deepEqual([(await pet()).xp, (await pet()).species], [10, null])
  await feed(10)
  let p = await pet()
  assert.equal(p.xp, 20)
  assert.ok(['chick', 'dragon', 'cat', 'fish'].includes(p.species), '부화하면 종류가 정해진다')
  assert.equal(p.hatched, true)
  assert.equal(await balance(), 280)
  const species = p.species
  await feed(50)
  await feed(50)
  await feed(50)
  p = await pet()
  assert.deepEqual([p.xp, p.species, p.done], [170, species, false], '한 번 정해진 종류는 바뀌지 않는다')
  // 다 자라는 데 필요한 양(30)까지만 쓰고 완료 처리
  await feed(50)
  p = await pet()
  assert.deepEqual([p.xp, p.done], [200, true])
  assert.equal(await balance(), 100, '남는 포인트는 쓰지 않는다(50이 아니라 30만 차감)')
  assert.equal((await db.query(`select points from public.point_events where kind = 'pet_feed' order by created_at desc, ref limit 100`)).rows.filter(r => r.points === -30).length, 1)
  await rejects(feed(5), /no_pet/) // 키우는 펫이 없다(도감으로 갔다)

  // 두 번째 알은 50P: 부족하면 거부, 충분하면 차감
  await adopt()
  assert.equal(await balance(), 50)
  assert.equal((await db.query(`select count(*)::int c from public.point_events where kind = 'pet_egg'`)).rows[0].c, 1)
  await feed(50)
  assert.equal(await balance(), 0)
  await rejects(feed(5), /not_enough_points/)
  assert.equal((await pet()).xp, 50, '실패한 먹이는 반영되지 않는다')

  // U2: 포인트 없이 첫 알은 받지만, 도감(다 키운 펫)이 있으면 두 번째 알은 포인트가 필요하다
  await db.exec('reset role')
  await db.exec(`insert into public.pets (user_id, species, xp, completed_at) values ('${U2}', 'cat', 200, now())`)
  await as(db, 'authenticated', U2)
  assert.equal(Number((await db.query(`select public.point_balance() as b`)).rows[0].b), 0, '다른 사람의 포인트는 합산되지 않는다')
  await rejects(adopt(), /not_enough_points/)
  assert.equal((await db.query(`select count(*)::int c from public.pets`)).rows[0].c, 1, '실패하면 알이 생기지 않는다')
  await db.exec('reset role')
  await give(U2, 5)
  await as(db, 'authenticated', U2)
  await adopt()
  assert.equal(await balance(), 0)

  // 행 수준 보안: 다른 사람의 펫은 안 보이고, 직접 쓰기·수정·삭제는 안 된다
  assert.equal((await db.query(`select count(*)::int c from public.pets where user_id = '${U1}'`)).rows[0].c, 0)
  await rejects(db.query(`insert into public.pets (species, xp) values ('cat', 200)`), /permission denied/)
  await rejects(db.query(`update public.pets set xp = 200`), /permission denied/)
  await rejects(db.query(`delete from public.pets`), /permission denied/)
  await as(db, 'anon', null)
  await rejects(db.query(`select * from public.pets`), /permission denied/)
  // 키우는 펫은 한 마리만(관리자 권한으로도 두 번째 진행 중 펫은 못 만든다)
  await db.exec('reset role')
  await rejects(db.query(`insert into public.pets (user_id) values ('${U2}')`), /duplicate key|unique/)
  await db.close()
  console.log('OK: points.sql(pet_adopt·pet_feed) 통과')
}
console.log('OK: SQL 전체 통과')
