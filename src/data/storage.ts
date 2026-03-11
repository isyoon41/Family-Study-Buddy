import type { Child, StudyLog, Textbook, ActivityLog, AppSettings, ParentUser, Family } from '../types';

const KEY = {
  PARENT: 'fsb_parent',
  FAMILY: 'fsb_family',
  CHILDREN: 'fsb_children',
  SHEETS: 'fsb_sheets',
  TEXTBOOKS: 'fsb_textbooks',
  ACTIVITY: 'fsb_activity',
  SETTINGS: 'fsb_settings',
};

function get<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Parent / Family ──────────────────────────────────────────────
export function getParentAccount(): { parent: ParentUser; family: Family } | null {
  const parent = get<ParentUser | null>(KEY.PARENT, null);
  const family = get<Family | null>(KEY.FAMILY, null);
  if (parent && family) return { parent, family };
  return null;
}

export function setupParentAccount(email: string, password: string, familyName: string) {
  const family: Family = { id: `fam-${Date.now()}`, name: familyName };
  const parent: ParentUser = {
    id: `par-${Date.now()}`,
    family_id: family.id,
    email,
    name: '부모님',
    role: 'parent',
  };
  set(KEY.FAMILY, family);
  set(KEY.PARENT, { ...parent, _pw: password }); // 단순 저장 (개인 사용 목적)
  return { parent, family };
}

export function verifyParentAccount(email: string, password: string): { parent: ParentUser; family: Family } | null {
  const raw = get<(ParentUser & { _pw: string }) | null>(KEY.PARENT, null);
  const family = get<Family | null>(KEY.FAMILY, null);
  if (raw && family && raw.email === email && raw._pw === password) {
    const { _pw: _unused, ...parent } = raw;
    void _unused;
    return { parent, family };
  }
  return null;
}

// ── Children ────────────────────────────────────────────────────
export function getChildren(familyId: string): Child[] {
  return get<Child[]>(KEY.CHILDREN, []).filter(c => c.family_id === familyId);
}

export function saveChild(child: Child) {
  const list = get<Child[]>(KEY.CHILDREN, []);
  const idx = list.findIndex(c => c.id === child.id);
  if (idx >= 0) list[idx] = child;
  else list.push(child);
  set(KEY.CHILDREN, list);
}

export function deleteChild(childId: string) {
  set(KEY.CHILDREN, get<Child[]>(KEY.CHILDREN, []).filter(c => c.id !== childId));
}

export function verifyChildPin(childId: string, pin: string, familyId: string): Child | null {
  return get<Child[]>(KEY.CHILDREN, []).find(
    c => c.id === childId && c.pin === pin && c.family_id === familyId && c.active
  ) ?? null;
}

// ── Study Logs / Sheets ─────────────────────────────────────────
export function getSheets(familyId: string): StudyLog[] {
  return get<StudyLog[]>(KEY.SHEETS, [])
    .filter(s => s.family_id === familyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getSheetsByChild(childId: string): StudyLog[] {
  return get<StudyLog[]>(KEY.SHEETS, [])
    .filter(s => s.child_id === childId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function saveSheet(sheet: StudyLog) {
  const list = get<StudyLog[]>(KEY.SHEETS, []);
  const idx = list.findIndex(s => s.id === sheet.id);
  if (idx >= 0) list[idx] = sheet;
  else list.push(sheet);
  set(KEY.SHEETS, list);
}

export function updateSheetStatus(
  sheetId: string,
  status: StudyLog['status'],
  comment?: string
) {
  const list = get<StudyLog[]>(KEY.SHEETS, []);
  const idx = list.findIndex(s => s.id === sheetId);
  if (idx >= 0) {
    list[idx].status = status;
    if (comment !== undefined) list[idx].parent_comment = comment;
    set(KEY.SHEETS, list);
  }
}

export function deleteSheet(sheetId: string) {
  set(KEY.SHEETS, get<StudyLog[]>(KEY.SHEETS, []).filter(s => s.id !== sheetId));
}

// ── Textbooks ────────────────────────────────────────────────────
export function getTextbooks(childId: string): Textbook[] {
  return get<Textbook[]>(KEY.TEXTBOOKS, []).filter(t => t.child_id === childId);
}

export function getAllTextbooks(familyId: string): Textbook[] {
  return get<Textbook[]>(KEY.TEXTBOOKS, []).filter(t => t.family_id === familyId);
}

export function saveTextbook(tb: Textbook) {
  const list = get<Textbook[]>(KEY.TEXTBOOKS, []);
  const idx = list.findIndex(t => t.id === tb.id);
  if (idx >= 0) list[idx] = tb;
  else list.push(tb);
  set(KEY.TEXTBOOKS, list);
}

export function deleteTextbook(tbId: string) {
  set(KEY.TEXTBOOKS, get<Textbook[]>(KEY.TEXTBOOKS, []).filter(t => t.id !== tbId));
}

/** 교재명 부분 일치 매칭 */
export function matchTextbook(taskText: string, childId: string): Textbook | null {
  const books = getTextbooks(childId);
  const lower = taskText.toLowerCase();
  return books.find(b => lower.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(lower)) ?? null;
}

/** 자녀별 교재 진도율 계산 (완료된 아이템 기준 최대 페이지) */
export function getTextbookProgress(tbId: string, childId: string): number {
  const sheets = getSheetsByChild(childId);
  let maxPage = 0;
  for (const sheet of sheets) {
    if (sheet.status !== 'approved') continue;
    for (const item of sheet.items) {
      if (item.textbook_id !== tbId) continue;
      const match = item.quantity_raw.match(/(\d+)\s*[~\-]\s*(\d+)/);
      if (match) maxPage = Math.max(maxPage, parseInt(match[2]));
    }
  }
  return maxPage;
}

// ── Activity Log ─────────────────────────────────────────────────
export function getActivityLogs(familyId: string): ActivityLog[] {
  return get<ActivityLog[]>(KEY.ACTIVITY, [])
    .filter(l => l.family_id === familyId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function addActivityLog(log: Omit<ActivityLog, 'id'>) {
  const list = get<ActivityLog[]>(KEY.ACTIVITY, []);
  list.push({ ...log, id: `log-${Date.now()}-${Math.random()}` });
  if (list.length > 500) list.splice(0, list.length - 500);
  set(KEY.ACTIVITY, list);
}

// ── Settings ─────────────────────────────────────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  image_retention_days: 90,
  notifications_email: true,
  lock_after_failures: 3,
  require_page_info: true,
  parent_email: '',
};

export function getSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...get<Partial<AppSettings>>(KEY.SETTINGS, {}) };
}

export function saveSettings(s: AppSettings) {
  set(KEY.SETTINGS, s);
}
