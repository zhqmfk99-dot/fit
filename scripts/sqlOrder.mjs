// supabase/*.sql 파일의 실행 순서와 "한 번에 실행하는 파일(supabase/setup_all.sql)" 만들기.
// 새 SQL 파일을 추가하면 아래 SETUP_ORDER에 순서대로 넣어야 한다(tests/setupSql.test.mjs가 빠뜨리면 실패시킨다).

// 순서가 중요한 이유(앞 파일이 만든 것에 뒤 파일이 기대거나, 뒤 파일이 앞 파일의 함수를 덮어쓴다):
//   · seed_exercises.sql은 가입 트리거 함수를 만들고, unilateral.sql이 그 함수를 한쪽씩 표시가 들어간 버전으로 바꾼다 → unilateral은 seed 뒤
//   · auth_profiles.sql은 아이디 찾기 함수를 만들고, auth_rate_limit.sql이 횟수 제한이 든 버전으로 바꾼다 → auth_rate_limit은 auth_profiles 뒤
export const SETUP_ORDER = [
  'schema.sql',
  'auth_profiles.sql',
  'profile_fields.sql',
  'body_records.sql',
  'seed_exercises.sql',
  'log_kcal.sql',
  'ai_usage.sql',
  'user_settings.sql',
  'unilateral.sql',
  'log_skipped.sql',
  'log_feel.sql',
  'exercise_note.sql',
  'auth_rate_limit.sql',
  'points.sql',
  'body_source.sql',
]

// 한 번에 실행하는 파일에 넣지 않는 파일과 이유
export const NOT_IN_SETUP = {
  'setup_all.sql': '이 목록으로 만든 결과 파일이다',
  'mask_find_ids.sql': '예전 설치에서 아이디 찾기 결과를 가리려고 쓰던 파일 — auth_profiles.sql이 이미 같은 함수를 만든다(그 뒤 auth_rate_limit.sql이 다시 덮어쓴다)',
}

export const SETUP_FILE = 'setup_all.sql'

const HEADER = `-- ⚠ 자동으로 만든 파일입니다. 직접 고치지 마세요(\`npm run sql:build\`가 다시 만듭니다).
--
-- Supabase SQL Editor에 이 파일 내용을 통째로 붙여넣어 실행하세요.
-- 새로 설치할 때도, 이미 쓰고 있는 DB를 최신으로 맞출 때도 이 파일 하나면 됩니다.
-- 모든 문장이 여러 번 실행해도 안전하게 되어 있어서(없을 때만 만들고, 기존 데이터는 그대로 둡니다) 새 SQL이 추가될 때마다 다시 실행하면 됩니다.
-- 아래 파일들이 이 순서로 들어 있습니다: __LIST__
--
-- 앱을 배포하기 **전에** 실행하세요(새 칼럼이 없는 상태에서 새 앱이 저장하면 일부 기능이 실패하거나 값이 유지되지 않습니다).
`

// readFile(name) → 그 SQL 파일 내용. 줄바꿈은 \n으로 통일한다(윈도우 CRLF와 상관없이 같은 결과가 나오도록).
export function buildSetupSql(readFile) {
  const norm = s => s.replace(/\r\n/g, '\n').replace(/^﻿/, '').replace(/\s+$/, '') + '\n'
  const parts = SETUP_ORDER.map(name => `\n-- ======================================================================\n-- ${name}\n-- ======================================================================\n\n${norm(readFile(name))}`)
  return HEADER.replace('__LIST__', SETUP_ORDER.join(' → ')) + parts.join('')
}
