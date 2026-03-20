/**
 * db.ts — Supabase 데이터베이스 연산 레이어
 *
 * - 부모(authenticated) 작업: supabase 클라이언트를 직접 사용 (RLS 적용)
 * - 자녀(unauthenticated) 작업: SECURITY DEFINER RPC 함수를 통해 PIN 검증 후 처리
 */

import { supabase } from './supabase';
import type {
  Child, StudyLog, StudyItem, Textbook, ActivityLog, AppSettings,
  ParentUser, Family,
} from '../types';

// ================================================================
// 부모 인증 (Supabase Auth)
// ================================================================

export async function signInParent(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUpParent(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signOutParent() {
  await supabase.auth.signOut();
}

export async function getSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ================================================================
// 가족 & 부모 프로필 생성 (최초 회원가입)
// ================================================================

export async function createFamilyAndProfile(
  userId: string,
  email: string,
  familyName: string,
): Promise<{ parent: ParentUser; family: Family } | { error: string }> {
  // SECURITY DEFINER RPC 를 통해 가족 + 프로필을 생성
  // (이메일 인증 전 세션이 없는 상태에서도 동작)
  const { data, error } = await supabase.rpc('setup_family_and_profile', {
    p_user_id:     userId,
    p_email:       email,
    p_family_name: familyName,
  });
  if (error || !data) return { error: error?.message ?? '가족 생성 실패' };

  const family: Family = { id: data.family_id, name: data.family_name };
  const parent: ParentUser = {
    id: userId, family_id: data.family_id, email, name: '부모님', role: 'parent',
  };
  return { parent, family };
}

// ================================================================
// 부모 프로필 조회 (로그인 후 가족 정보 가져오기)
// ================================================================

export async function getParentProfile(
  userId: string,
): Promise<{ parent: ParentUser; family: Family } | null> {
  const { data: prof } = await supabase
    .from('parent_profiles')
    .select('*, families(*)')
    .eq('id', userId)
    .single();

  if (!prof || !prof.families) return null;

  const family: Family = { id: prof.families.id, name: prof.families.name };
  const parent: ParentUser = {
    id: prof.id,
    family_id: prof.family_id,
    email: '', // Supabase Auth 에서 가져와야 함
    name: prof.display_name ?? '부모님',
    role: 'parent',
  };
  return { parent, family };
}

// ================================================================
// 자녀 관리 (부모용, authenticated)
// ================================================================

export async function getChildren(familyId: string): Promise<Child[]> {
  const { data } = await supabase
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .eq('active', true)
    .order('created_at');

  return (data ?? []).map(row => ({
    id: row.id, family_id: row.family_id,
    name: row.name, grade: row.grade, pin: row.pin,
    avatar: row.avatar, active: row.active,
    created_at: row.created_at,
  }));
}

export async function createChild(
  familyId: string,
  child: Omit<Child, 'id' | 'family_id' | 'created_at' | 'active'>,
): Promise<Child | null> {
  const { data, error } = await supabase
    .from('children')
    .insert({ ...child, family_id: familyId, active: true })
    .select()
    .single();
  if (error || !data) return null;
  return data as Child;
}

export async function updateChild(childId: string, updates: Partial<Child>): Promise<boolean> {
  const { error } = await supabase
    .from('children')
    .update(updates)
    .eq('id', childId);
  return !error;
}

export async function deleteChild(childId: string): Promise<boolean> {
  // soft delete
  const { error } = await supabase
    .from('children')
    .update({ active: false })
    .eq('id', childId);
  return !error;
}

// ================================================================
// 자녀 PIN 로그인 (RPC, unauthenticated)
// ================================================================

export async function verifyChildPin(
  childId: string,
  pin: string,
): Promise<Child | null> {
  const { data, error } = await supabase.rpc('verify_child_pin', {
    p_child_id: childId,
    p_pin: pin,
  });
  if (error || !data) return null;
  return data as Child;
}

/** 자녀 선택 화면용: 가족 ID로 자녀 목록 조회 (PIN 불필요) */
export async function getChildrenPublic(
  familyId: string,
): Promise<Pick<Child, 'id' | 'name' | 'avatar' | 'grade'>[]> {
  const { data, error } = await supabase.rpc('get_children_by_family', {
    p_family_id: familyId,
  });
  if (error || !data) return [];
  return data as Pick<Child, 'id' | 'name' | 'avatar' | 'grade'>[];
}

// ================================================================
// 교재 관리 (부모용, authenticated)
// ================================================================

export async function getTextbooks(familyId: string): Promise<Textbook[]> {
  const { data } = await supabase
    .from('textbooks')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');
  return (data ?? []) as Textbook[];
}

export async function getTextbooksByChild(childId: string): Promise<Textbook[]> {
  const { data } = await supabase
    .from('textbooks')
    .select('*')
    .eq('child_id', childId)
    .order('created_at');
  return (data ?? []) as Textbook[];
}

export async function createTextbook(tb: Omit<Textbook, 'id' | 'created_at'>): Promise<Textbook | null> {
  const { data, error } = await supabase
    .from('textbooks')
    .insert(tb)
    .select()
    .single();
  if (error || !data) return null;
  return data as Textbook;
}

export async function deleteTextbook(tbId: string): Promise<boolean> {
  const { error } = await supabase.from('textbooks').delete().eq('id', tbId);
  return !error;
}

/** 교재 진도율 계산: 자녀의 승인된 일지에서 최대 페이지 추출 */
export async function getTextbookProgress(
  tbId: string, childId: string,
): Promise<number> {
  const { data } = await supabase
    .from('study_logs')
    .select('id')
    .eq('child_id', childId)
    .eq('status', 'approved');

  if (!data || data.length === 0) return 0;
  const logIds = data.map(r => r.id);

  const { data: items } = await supabase
    .from('study_items')
    .select('quantity_raw')
    .eq('textbook_id', tbId)
    .in('log_id', logIds);

  let maxPage = 0;
  for (const item of items ?? []) {
    const m = (item.quantity_raw as string).match(/(\d+)\s*[~\-]\s*(\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[2]));
  }
  return maxPage;
}

// ================================================================
// 학습 일지 조회/수정 (부모용, authenticated)
// ================================================================

/** 학습 일지 + items 를 함께 조회하여 StudyLog[] 형태로 반환 */
async function fetchLogsWithItems(
  filter: { family_id?: string; child_id?: string },
): Promise<StudyLog[]> {
  let query = supabase
    .from('study_logs')
    .select('*, study_items(*)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filter.family_id) query = query.eq('family_id', filter.family_id);
  if (filter.child_id)  query = query.eq('child_id', filter.child_id);

  const { data } = await query;
  if (!data) return [];

  return data.map(row => ({
    id:             row.id,
    child_id:       row.child_id,
    child_name:     row.child_name,
    child_avatar:   row.child_avatar,
    family_id:      row.family_id,
    date:           row.date,
    goal:           row.goal,
    total_minutes:  row.total_minutes,
    status:         row.status,
    parent_comment: row.parent_comment ?? undefined,
    image_url:      row.image_url ?? undefined,
    created_at:     row.created_at,
    items: (row.study_items ?? []).map((si: StudyItem) => ({
      id:           si.id,
      subject:      si.subject,
      task_text:    si.task_text,
      quantity_raw: si.quantity_raw,
      completed:    si.completed,
      textbook_id:  si.textbook_id,
    })),
  }));
}

export const getStudyLogs = (familyId: string) =>
  fetchLogsWithItems({ family_id: familyId });

export const getStudyLogsByChild = (childId: string) =>
  fetchLogsWithItems({ child_id: childId });

export async function updateLogStatus(
  logId: string,
  status: StudyLog['status'],
  comment?: string,
): Promise<boolean> {
  const updates: Partial<StudyLog> = { status };
  if (comment !== undefined) updates.parent_comment = comment;
  const { error } = await supabase.from('study_logs').update(updates).eq('id', logId);
  return !error;
}

export async function deleteStudyLog(logId: string): Promise<boolean> {
  const { error } = await supabase.from('study_logs').delete().eq('id', logId);
  return !error;
}

export async function updateStudyLogContent(
  logId: string,
  updates: { date: string; goal: string; total_minutes: number; items: StudyItem[] },
): Promise<boolean> {
  const { error: logError } = await supabase
    .from('study_logs')
    .update({ date: updates.date, goal: updates.goal, total_minutes: updates.total_minutes })
    .eq('id', logId);
  if (logError) return false;

  const { error: delError } = await supabase
    .from('study_items')
    .delete()
    .eq('log_id', logId);
  if (delError) return false;

  if (updates.items.length > 0) {
    const { error: insError } = await supabase
      .from('study_items')
      .insert(updates.items.map(i => ({
        log_id: logId,
        subject: i.subject,
        task_text: i.task_text,
        quantity_raw: i.quantity_raw,
        completed: i.completed,
        textbook_id: i.textbook_id ?? null,
      })));
    if (insError) return false;
  }

  return true;
}

// ================================================================
// 학습 일지 제출 (자녀용, RPC)
// ================================================================

export async function submitChildStudyLog(
  childId: string,
  pin: string,
  payload: {
    date: string;
    goal: string;
    totalMinutes: number;
    imageUrl: string;
    items: StudyItem[];
  },
): Promise<{ log_id: string } | null> {
  const { data, error } = await supabase.rpc('submit_child_study_log', {
    p_child_id:      childId,
    p_pin:           pin,
    p_date:          payload.date,
    p_goal:          payload.goal,
    p_total_minutes: payload.totalMinutes,
    p_image_url:     payload.imageUrl,
    p_items:         payload.items.map(i => ({
      subject:      i.subject,
      task_text:    i.task_text,
      quantity_raw: i.quantity_raw,
      completed:    i.completed,
      textbook_id:  i.textbook_id ?? null,
    })),
  });
  if (error) throw new Error(error.message);
  if (!data)  throw new Error('서버가 데이터를 반환하지 않았습니다');
  return data as { log_id: string };
}

/** 자녀: 본인 학습일지 조회 (RPC) */
export async function getChildStudyLogs(
  childId: string,
  pin: string,
): Promise<StudyLog[]> {
  const { data, error } = await supabase.rpc('get_child_study_logs', {
    p_child_id: childId,
    p_pin: pin,
  });
  if (error || !data) return [];
  return (data as StudyLog[]).map(log => ({
    ...log,
    items: log.items ?? [],
  }));
}

/** 자녀: 본인 교재 조회 (RPC) */
export async function getChildTextbooks(
  childId: string,
  pin: string,
): Promise<Textbook[]> {
  const { data, error } = await supabase.rpc('get_child_textbooks', {
    p_child_id: childId,
    p_pin: pin,
  });
  if (error || !data) return [];
  return data as Textbook[];
}

// ================================================================
// 활동 로그 (부모용, authenticated)
// ================================================================

export async function getActivityLogs(familyId: string): Promise<ActivityLog[]> {
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('family_id', familyId)
    .order('timestamp', { ascending: false })
    .limit(300);
  return (data ?? []) as ActivityLog[];
}

export async function addActivityLog(
  familyId: string,
  type: ActivityLog['type'],
  actor: string,
  description: string,
): Promise<void> {
  await supabase.from('activity_logs').insert({ family_id: familyId, type, actor, description });
}

/** 자녀: 활동 로그 추가 (RPC) */
export async function addChildActivityLog(
  childId: string,
  pin: string,
  type: string,
  description: string,
): Promise<void> {
  await supabase.rpc('add_child_activity_log', {
    p_child_id: childId,
    p_pin: pin,
    p_type: type,
    p_description: description,
  });
}

// ================================================================
// 설정 (부모용, authenticated)
// ================================================================

const DEFAULT_SETTINGS: AppSettings = {
  image_retention_days: 90,
  notifications_email: true,
  lock_after_failures: 3,
  require_page_info: true,
  parent_email: '',
};

export async function getSettings(familyId: string): Promise<AppSettings> {
  const { data } = await supabase
    .from('family_settings')
    .select('*')
    .eq('family_id', familyId)
    .single();
  if (!data) return DEFAULT_SETTINGS;
  return {
    image_retention_days: data.image_retention_days ?? DEFAULT_SETTINGS.image_retention_days,
    notifications_email:  data.notifications_email  ?? DEFAULT_SETTINGS.notifications_email,
    lock_after_failures:  data.lock_after_failures   ?? DEFAULT_SETTINGS.lock_after_failures,
    require_page_info:    data.require_page_info     ?? DEFAULT_SETTINGS.require_page_info,
    parent_email:         data.parent_email          ?? DEFAULT_SETTINGS.parent_email,
  };
}

export async function saveSettings(familyId: string, s: AppSettings): Promise<boolean> {
  const { error } = await supabase
    .from('family_settings')
    .upsert({ family_id: familyId, ...s });
  return !error;
}

/** 교재 이름 부분 매칭 (자녀 업로드 시 OCR 결과와 교재 자동 매칭) */
export async function matchTextbook(
  taskText: string,
  childId: string,
): Promise<Textbook | null> {
  const books = await getTextbooksByChild(childId);
  const lower = taskText.toLowerCase();
  return books.find(
    b => lower.includes(b.name.toLowerCase()) ||
         b.name.toLowerCase().includes(lower),
  ) ?? null;
}
