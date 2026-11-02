// supabase/setup_all.sql(모든 SQL을 순서대로 한 번에)을 임베디드 Postgres(PGlite)에서 실제로 실행해 본다.
//   ① 새 설치  ② 두 번째 실행(멱등)  ③ 예전 방식(옛 schema.sql처럼 이름 없는 인덱스·정책 없는 재실행 불가 파일)으로 설치한 DB에 덮어 실행 — 데이터·인덱스가 그대로인지
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { SETUP_ORDER, SETUP_FILE } from '../../scripts/sqlOrder.mjs'

const dir = new URL('../../supabase/', import.meta.url)
const read = f => fs.readFileSync(new URL(f, dir), 'utf8')
const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222'

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
const q = async (db, text, params) => (await db.query(text, params)).rows
const one = async (db, text, params) => Object.values((await q(db, text, params))[0])[0]

const TABLES = ['exercises', 'routines', 'workout_logs', 'profiles', 'body_records', 'ai_usage', 'auth_lookup_attempts']
const COLUMNS = {
  exercises: ['movement_pattern', 'exercise_type', 'tags', 'unilateral', 'note'],
  workout_logs: ['kcal', 'skipped', 'feel'],
  profiles: ['gender', 'age', 'height_cm', 'weight_kg', 'settings'],
}
const FUNCTIONS = ['handle_new_user', 'mask_email', 'find_ids_by_name', 'check_id_name', 'delete_my_account', 'consume_ai_usage', 'auth_lookup_guard']

async function assertSchema(db, label) {
  for (const t of TABLES) assert.equal(await one(db, `select to_regclass('public.${t}') is not null`), true, `${label}: 테이블 ${t}`)
  for (const [t, cols] of Object.entries(COLUMNS)) {
    const have = (await q(db, `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [t])).map(r => r.column_name)
    for (const c of cols) assert.ok(have.includes(c), `${label}: ${t}.${c}`)
  }
  for (const f of FUNCTIONS) assert.ok(await one(db, `select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [f]) >= 1, `${label}: 함수 ${f}`)
  // 모든 공개 테이블에서 RLS가 켜져 있다
  const off = (await q(db, `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).map(r => r.relname)
  assert.deepEqual(off, [], `${label}: RLS가 꺼진 테이블`)
  // 중복 인덱스(같은 테이블·같은 칼럼 목록)가 없다
  const dup = await q(db, `select tablename, regexp_replace(indexdef, 'INDEX \\S+ ON', 'INDEX ON') as def, count(*)::int c from pg_indexes where schemaname = 'public' group by 1, 2 having count(*) > 1`)
  assert.deepEqual(dup, [], `${label}: 중복 인덱스`)
}

const counts = async db => ({
  users: await one(db, `select count(*)::int from auth.users`),
  profiles: await one(db, `select count(*)::int from public.profiles`),
  exercises: await one(db, `select count(*)::int from public.exercises`),
  routines: await one(db, `select count(*)::int from public.routines`),
  logs: await one(db, `select count(*)::int from public.workout_logs`),
  body: await one(db, `select count(*)::int from public.body_records`),
  policies: await one(db, `select count(*)::int from pg_policies where schemaname = 'public'`),
  indexes: await one(db, `select count(*)::int from pg_indexes where schemaname = 'public'`),
})

// ───────── ① 새 설치 + ② 한 번 더 실행 ─────────
{
  const db = await newDb()
  await db.exec(read(SETUP_FILE))
  await assertSchema(db, '새 설치')

  // 가입하면 프로필과 기본 운동이 만들어지고, 한쪽씩 표시가 들어간 버전의 가입 트리거 함수가 쓰인다(unilateral.sql이 seed 뒤에 실행됐다는 뜻)
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${U1}', 'alpha99@x.com', '{"name":"가입자"}')`)
  assert.equal(await one(db, `select count(*)::int from public.profiles`), 1)
  const total = await one(db, `select count(*)::int from public.exercises where user_id = '${U1}'`)
  assert.ok(total >= 100, `기본 운동 ${total}개`)
  assert.ok((await one(db, `select count(*)::int from public.exercises where user_id = '${U1}' and unilateral`)) >= 10, '한쪽씩 표시가 신규 가입자에게도 들어가야 함')

  // 아이디 찾기 함수는 횟수 제한이 든 버전(auth_rate_limit.sql이 auth_profiles.sql 뒤에 실행됐다는 뜻)
  assert.ok((await one(db, `select prosrc from pg_proc where proname = 'find_ids_by_name'`)).includes('auth_lookup_guard'), '아이디 찾기에 횟수 제한이 있어야 함')

  const before = await counts(db)
  await db.exec(read(SETUP_FILE)) // 두 번째 실행: 오류 없이, 아무것도 늘지 않는다
  await db.exec(read(SETUP_FILE))
  assert.deepEqual(await counts(db), before)
  await assertSchema(db, '두 번 실행')
  assert.equal(await one(db, `select count(*)::int from public.exercises where user_id = '${U1}'`), total, '기본 운동이 또 들어가면 안 됨')
  assert.ok((await one(db, `select prosrc from pg_proc where proname = 'find_ids_by_name'`)).includes('auth_lookup_guard'), '다시 실행해도 횟수 제한 버전이 유지')
  assert.ok((await one(db, `select prosrc from pg_proc where proname = 'handle_new_user'`)).length > 0)
  await db.close()
  console.log('OK: 새 설치와 재실행(멱등) 통과')
}

// ───────── ③ 예전 방식으로 설치한 DB에 덮어 실행 ─────────
{
  const db = await newDb()
  // 예전 파일처럼 "if not exists"·이름 있는 인덱스·정책 삭제 없이 한 번만 실행되던 모양을 흉내 낸다(현재 파일에서 그 부분을 걷어낸다)
  const legacy = f =>
    read(f)
      .replace(/create table if not exists/g, 'create table')
      .replace(/create index if not exists \S+ on/g, 'create index on')
      .replace(/^drop policy if exists .*$/gm, '')
  // 기능이 늘어나기 전 시점: 앞쪽 파일만(체감 난이도·메모·횟수 제한은 아직 없음)
  const OLD = ['schema.sql', 'auth_profiles.sql', 'profile_fields.sql', 'body_records.sql', 'seed_exercises.sql', 'log_kcal.sql', 'ai_usage.sql', 'user_settings.sql', 'unilateral.sql', 'log_skipped.sql']
  assert.ok(OLD.every(f => SETUP_ORDER.includes(f)))
  for (const f of OLD) await db.exec(f === 'schema.sql' || f === 'body_records.sql' ? legacy(f) : read(f))

  // 쓰던 데이터: 사용자 두 명, 기록·루틴·신체 기록
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${U1}', 'alpha99@x.com', '{"name":"문기훈"}'), ('${U2}', 'bravo@x.com', '{"name":"문기훈"}')`)
  await db.exec(`insert into public.routines (user_id, name) values ('${U1}', '등+어깨')`)
  await db.exec(`insert into public.workout_logs (user_id, date, exercise, is_completed, performed_sets) values ('${U1}', '2026-06-01', '벤치프레스', true, '[{"reps":8,"weight":60}]')`)
  await db.exec(`insert into public.body_records (user_id, date, weight_kg) values ('${U1}', '2026-06-01', 70)`)
  await db.exec(`update public.profiles set settings = '{"theme":"dark"}' where id = '${U1}'`)
  const before = await counts(db)
  const idxBefore = (await q(db, `select indexname from pg_indexes where schemaname = 'public' order by 1`)).map(r => r.indexname)

  await db.exec(read(SETUP_FILE)) // 최신으로 맞추기: 오류 없이 끝나야 한다
  await assertSchema(db, '예전 설치 → 최신')

  const after = await counts(db)
  assert.equal(after.users, before.users)
  assert.equal(after.exercises, before.exercises, '기본 운동이 중복으로 들어가면 안 됨')
  assert.equal(after.routines, before.routines)
  assert.equal(after.logs, before.logs)
  assert.equal(after.body, before.body)
  assert.equal(after.policies, before.policies, '정책이 늘거나 줄면 안 됨(삭제 후 다시 만들기)')
  assert.equal(after.indexes, before.indexes + 3 + 0, '새 인덱스는 횟수 제한 기록 테이블의 것(3개: 기본키 + 2)만 늘어야 함')
  const idxAfter = (await q(db, `select indexname from pg_indexes where schemaname = 'public' order by 1`)).map(r => r.indexname)
  for (const name of idxBefore) assert.ok(idxAfter.includes(name), `기존 인덱스 ${name}이 그대로`)

  // 데이터와 새 칼럼 기본값
  assert.equal(await one(db, `select settings->>'theme' from public.profiles where id = '${U1}'`), 'dark', '설정이 그대로')
  assert.equal(await one(db, `select performed_sets->0->>'weight' from public.workout_logs`), '60')
  assert.equal(await one(db, `select feel is null and skipped = false from public.workout_logs`), true)
  assert.equal(await one(db, `select count(*)::int from public.exercises where note is not null`), 0)
  assert.ok((await one(db, `select prosrc from pg_proc where proname = 'find_ids_by_name'`)).includes('auth_lookup_guard'))
  // 아이디 찾기(마스킹)와 횟수 제한이 최신 SQL에서도 동작
  await db.exec(`reset role; set role anon;`)
  const found = (await q(db, `select * from public.find_ids_by_name('문기훈')`)).map(r => r.email).sort()
  assert.deepEqual(found, ['al***99@x.com', 'br*vo@x.com'])
  await db.close()
  console.log('OK: 예전 설치에 덮어 실행(데이터·인덱스·정책 유지) 통과')
}
console.log('OK: setup_all.sql 전체 통과')
