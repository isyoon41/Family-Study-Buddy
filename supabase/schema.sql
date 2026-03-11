-- ================================================================
-- Family Study Buddy — Supabase Schema
-- Supabase SQL Editor 에 복붙하여 실행하세요
-- ================================================================

-- 필수 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 테이블 생성
-- ================================================================

-- 가족 테이블
CREATE TABLE IF NOT EXISTS families (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 가족 설정 테이블
CREATE TABLE IF NOT EXISTS family_settings (
  family_id              UUID PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
  image_retention_days   INT     DEFAULT 90,
  notifications_email    BOOLEAN DEFAULT FALSE,
  lock_after_failures    INT     DEFAULT 3,
  require_page_info      BOOLEAN DEFAULT TRUE,
  parent_email           TEXT    DEFAULT ''
);

-- 부모 프로필 (Supabase Auth users 와 연결)
CREATE TABLE IF NOT EXISTS parent_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 자녀 테이블
CREATE TABLE IF NOT EXISTS children (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar      TEXT NOT NULL DEFAULT '🐶',
  pin         TEXT NOT NULL,
  grade       TEXT DEFAULT '초5',
  color       TEXT DEFAULT '#818CF8',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 교재 테이블
CREATE TABLE IF NOT EXISTS textbooks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  name         TEXT NOT NULL,
  total_pages  INT  DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 학습 일지 테이블
CREATE TABLE IF NOT EXISTS study_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  child_name     TEXT NOT NULL DEFAULT '',
  child_avatar   TEXT NOT NULL DEFAULT '🐶',
  family_id      UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  goal           TEXT DEFAULT '',
  total_minutes  INT  DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('draft','pending','approved','rejected')),
  parent_comment TEXT,
  image_url      TEXT,   -- base64 데이터 URL 또는 빈 문자열
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 학습 항목 테이블
CREATE TABLE IF NOT EXISTS study_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id        UUID NOT NULL REFERENCES study_logs(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL DEFAULT '',
  task_text     TEXT NOT NULL DEFAULT '',
  quantity_raw  TEXT DEFAULT '',
  completed     BOOLEAN DEFAULT FALSE,
  textbook_id   UUID REFERENCES textbooks(id) ON DELETE SET NULL
);

-- 활동 로그 테이블
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  type        TEXT NOT NULL,
  actor       TEXT NOT NULL,
  description TEXT NOT NULL
);

-- ================================================================
-- Row Level Security (RLS) 활성화
-- ================================================================
ALTER TABLE families         ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE children         ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbooks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 헬퍼 함수: 로그인된 부모의 family_id 반환
-- ================================================================
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT family_id FROM parent_profiles WHERE id = auth.uid();
$$;

-- ================================================================
-- RLS 정책 — families
-- ================================================================
DROP POLICY IF EXISTS "families_select" ON families;
DROP POLICY IF EXISTS "families_insert" ON families;
DROP POLICY IF EXISTS "families_update" ON families;
CREATE POLICY "families_select" ON families FOR SELECT USING (id = get_my_family_id());
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "families_update" ON families FOR UPDATE USING (id = get_my_family_id());

-- ================================================================
-- RLS 정책 — family_settings
-- ================================================================
DROP POLICY IF EXISTS "settings_select" ON family_settings;
DROP POLICY IF EXISTS "settings_insert" ON family_settings;
DROP POLICY IF EXISTS "settings_update" ON family_settings;
CREATE POLICY "settings_select" ON family_settings FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "settings_insert" ON family_settings FOR INSERT WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "settings_update" ON family_settings FOR UPDATE USING (family_id = get_my_family_id());

-- ================================================================
-- RLS 정책 — parent_profiles
-- ================================================================
DROP POLICY IF EXISTS "profiles_select" ON parent_profiles;
DROP POLICY IF EXISTS "profiles_insert" ON parent_profiles;
DROP POLICY IF EXISTS "profiles_update" ON parent_profiles;
CREATE POLICY "profiles_select" ON parent_profiles FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "profiles_insert" ON parent_profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON parent_profiles FOR UPDATE USING (id = auth.uid());

-- ================================================================
-- RLS 정책 — children
-- ================================================================
DROP POLICY IF EXISTS "children_select" ON children;
DROP POLICY IF EXISTS "children_insert" ON children;
DROP POLICY IF EXISTS "children_update" ON children;
DROP POLICY IF EXISTS "children_delete" ON children;
CREATE POLICY "children_select" ON children FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "children_insert" ON children FOR INSERT WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "children_update" ON children FOR UPDATE USING (family_id = get_my_family_id());
CREATE POLICY "children_delete" ON children FOR DELETE USING (family_id = get_my_family_id());

-- ================================================================
-- RLS 정책 — textbooks
-- ================================================================
DROP POLICY IF EXISTS "textbooks_select" ON textbooks;
DROP POLICY IF EXISTS "textbooks_insert" ON textbooks;
DROP POLICY IF EXISTS "textbooks_delete" ON textbooks;
CREATE POLICY "textbooks_select" ON textbooks FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "textbooks_insert" ON textbooks FOR INSERT WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "textbooks_delete" ON textbooks FOR DELETE USING (family_id = get_my_family_id());

-- ================================================================
-- RLS 정책 — study_logs
-- ================================================================
DROP POLICY IF EXISTS "logs_select" ON study_logs;
DROP POLICY IF EXISTS "logs_update" ON study_logs;
DROP POLICY IF EXISTS "logs_delete" ON study_logs;
CREATE POLICY "logs_select"  ON study_logs FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "logs_update"  ON study_logs FOR UPDATE USING (family_id = get_my_family_id());
CREATE POLICY "logs_delete"  ON study_logs FOR DELETE USING (family_id = get_my_family_id());

-- ================================================================
-- RLS 정책 — study_items
-- ================================================================
DROP POLICY IF EXISTS "items_select" ON study_items;
DROP POLICY IF EXISTS "items_update" ON study_items;
CREATE POLICY "items_select" ON study_items FOR SELECT
  USING (log_id IN (SELECT id FROM study_logs WHERE family_id = get_my_family_id()));
CREATE POLICY "items_update" ON study_items FOR UPDATE
  USING (log_id IN (SELECT id FROM study_logs WHERE family_id = get_my_family_id()));

-- ================================================================
-- RLS 정책 — activity_logs
-- ================================================================
DROP POLICY IF EXISTS "actlogs_select" ON activity_logs;
CREATE POLICY "actlogs_select" ON activity_logs FOR SELECT USING (family_id = get_my_family_id());

-- ================================================================
-- RPC 함수 — 자녀용 (SECURITY DEFINER, RLS 우회)
-- ================================================================

-- 자녀 PIN 검증 및 자녀 정보 반환
CREATE OR REPLACE FUNCTION verify_child_pin(p_child_id UUID, p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_child children%ROWTYPE;
BEGIN
  SELECT * INTO v_child
  FROM children
  WHERE id = p_child_id AND pin = p_pin AND active = TRUE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id',        v_child.id,
    'family_id', v_child.family_id,
    'name',      v_child.name,
    'avatar',    v_child.avatar,
    'grade',     v_child.grade,
    'color',     v_child.color,
    'pin',       v_child.pin
  );
END;
$$;

-- 가족 ID로 자녀 목록 조회 (자녀 선택 화면용, 민감정보 제외)
CREATE OR REPLACE FUNCTION get_children_by_family(p_family_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id',     id,
        'name',   name,
        'avatar', avatar,
        'grade',  grade,
        'color',  color
      ) ORDER BY created_at
    ), '[]'::json)
    FROM children
    WHERE family_id = p_family_id AND active = TRUE
  );
END;
$$;

-- 자녀: 학습일지 제출
CREATE OR REPLACE FUNCTION submit_child_study_log(
  p_child_id      UUID,
  p_pin           TEXT,
  p_date          DATE,
  p_goal          TEXT,
  p_total_minutes INT,
  p_image_url     TEXT,
  p_items         JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_family_id  UUID;
  v_child_name TEXT;
  v_child_avatar TEXT;
  v_log_id     UUID;
  v_item       JSONB;
BEGIN
  -- PIN 검증
  SELECT family_id, name, avatar
    INTO v_family_id, v_child_name, v_child_avatar
  FROM children
  WHERE id = p_child_id AND pin = p_pin AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN 오류';
  END IF;

  -- 학습일지 생성
  INSERT INTO study_logs
    (child_id, child_name, child_avatar, family_id, date, goal, total_minutes, status, image_url)
  VALUES
    (p_child_id, v_child_name, v_child_avatar, v_family_id,
     p_date, p_goal, p_total_minutes, 'pending', p_image_url)
  RETURNING id INTO v_log_id;

  -- 학습 항목 삽입
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO study_items (log_id, subject, task_text, quantity_raw, completed, textbook_id)
    VALUES (
      v_log_id,
      COALESCE(v_item->>'subject', ''),
      COALESCE(v_item->>'task_text', ''),
      COALESCE(v_item->>'quantity_raw', ''),
      COALESCE((v_item->>'completed')::boolean, false),
      CASE
        WHEN v_item->>'textbook_id' IS NULL OR v_item->>'textbook_id' = 'null' THEN NULL
        ELSE (v_item->>'textbook_id')::UUID
      END
    );
  END LOOP;

  -- 활동 로그 기록
  INSERT INTO activity_logs (family_id, type, actor, description)
  VALUES (
    v_family_id, 'submit', v_child_name,
    v_child_name || '이(가) ' || p_date::TEXT || ' 학습일지를 제출했어요'
  );

  RETURN json_build_object('log_id', v_log_id, 'success', true);
END;
$$;

-- 자녀: 본인 학습일지 조회
CREATE OR REPLACE FUNCTION get_child_study_logs(p_child_id UUID, p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SELECT family_id INTO v_family_id
  FROM children
  WHERE id = p_child_id AND pin = p_pin AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN 오류';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id',             sl.id,
        'child_id',       sl.child_id,
        'child_name',     sl.child_name,
        'child_avatar',   sl.child_avatar,
        'family_id',      sl.family_id,
        'date',           sl.date,
        'goal',           sl.goal,
        'total_minutes',  sl.total_minutes,
        'status',         sl.status,
        'parent_comment', sl.parent_comment,
        'image_url',      sl.image_url,
        'created_at',     sl.created_at,
        'items', (
          SELECT COALESCE(json_agg(json_build_object(
            'id',           si.id,
            'subject',      si.subject,
            'task_text',    si.task_text,
            'quantity_raw', si.quantity_raw,
            'completed',    si.completed,
            'textbook_id',  si.textbook_id
          )), '[]'::json)
          FROM study_items si
          WHERE si.log_id = sl.id
        )
      ) ORDER BY sl.date DESC, sl.created_at DESC
    ), '[]'::json)
    FROM study_logs sl
    WHERE sl.child_id = p_child_id
  );
END;
$$;

-- 자녀: 본인 교재 조회
CREATE OR REPLACE FUNCTION get_child_textbooks(p_child_id UUID, p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- PIN 검증 (가족 내에 child_id + pin 일치 여부)
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND pin = p_pin AND active = TRUE
  ) THEN
    RAISE EXCEPTION 'PIN 오류';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(json_build_object(
      'id',          id,
      'child_id',    child_id,
      'family_id',   family_id,
      'subject',     subject,
      'name',        name,
      'total_pages', total_pages,
      'created_at',  created_at
    ) ORDER BY created_at), '[]'::json)
    FROM textbooks
    WHERE child_id = p_child_id
  );
END;
$$;

-- ================================================================
-- RPC 함수 — 최초 가입 시 가족 + 프로필 생성 (SECURITY DEFINER)
-- 이메일 인증 전 세션이 없는 상태에서도 동작
-- ================================================================
CREATE OR REPLACE FUNCTION setup_family_and_profile(
  p_user_id     UUID,
  p_email       TEXT,
  p_family_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_family_id   UUID;
  v_family_name TEXT;
BEGIN
  -- 이미 프로필이 존재하면 기존 가족 정보 반환 (중복 방지)
  SELECT pp.family_id, f.name
    INTO v_family_id, v_family_name
  FROM parent_profiles pp
  JOIN families f ON f.id = pp.family_id
  WHERE pp.id = p_user_id;

  IF FOUND THEN
    RETURN json_build_object(
      'family_id',   v_family_id,
      'family_name', v_family_name
    );
  END IF;

  -- 사용자가 auth.users에 존재하는지 확인
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION '유효하지 않은 사용자 ID';
  END IF;

  -- 새 가족 생성
  INSERT INTO families (name)
  VALUES (p_family_name)
  RETURNING id INTO v_family_id;

  -- 부모 프로필 생성
  INSERT INTO parent_profiles (id, family_id, display_name)
  VALUES (p_user_id, v_family_id, '부모님');

  -- 기본 설정 생성
  INSERT INTO family_settings (family_id)
  VALUES (v_family_id)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'family_id',   v_family_id,
    'family_name', p_family_name
  );
END;
$$;

-- 자녀: 활동 로그 추가
CREATE OR REPLACE FUNCTION add_child_activity_log(
  p_child_id   UUID,
  p_pin        TEXT,
  p_type       TEXT,
  p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_family_id UUID;
  v_name      TEXT;
BEGIN
  SELECT family_id, name INTO v_family_id, v_name
  FROM children
  WHERE id = p_child_id AND pin = p_pin AND active = TRUE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO activity_logs (family_id, type, actor, description)
  VALUES (v_family_id, p_type, v_name, p_description);

  RETURN TRUE;
END;
$$;
