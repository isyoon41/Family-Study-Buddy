export type UserRole = 'parent' | 'child';

export interface Family {
  id: string;
  name: string;
}

export interface Child {
  id: string;
  family_id: string;
  name: string;
  grade: string;
  pin: string;
  avatar: string;
  active: boolean;
  created_at: string;
}

export interface ParentUser {
  id: string;
  family_id: string;
  email: string;
  name: string;
  role: 'parent';
}

export interface StudyItem {
  id: string;
  subject: string;
  task_text: string;      // 할 일 내용 (e.g. "수학의 정석 5단원")
  quantity_raw: string;   // 분량 원문 (e.g. "p.12~15" or "10문제")
  completed: boolean;
  textbook_id?: string;   // 교재 자동 매칭
}

export interface StudyLog {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar: string;
  family_id: string;
  date: string;
  goal: string;
  items: StudyItem[];
  total_minutes: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  parent_comment?: string;
  image_url?: string;     // base64 데이터 URL
  created_at: string;
}

export interface Textbook {
  id: string;
  child_id: string;
  family_id: string;
  subject: string;
  name: string;           // 전체 교재명 (e.g. "수학의 정석 기초편")
  total_pages: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  family_id: string;
  timestamp: string;
  type: 'login_parent' | 'login_child' | 'logout' | 'submit' | 'approve' | 'reject' | 'delete' | 'pin_fail' | 'external_link';
  actor: string;
  description: string;
}

export interface AppSettings {
  image_retention_days: number;
  notifications_email: boolean;
  lock_after_failures: number;
  require_page_info: boolean;
  parent_email: string;
}

export interface AuthState {
  role: UserRole | null;
  parentUser: ParentUser | null;
  child: Child | null;
  family: Family | null;
  isDemo: boolean;
}

export interface OcrItem {
  subject: string;
  task_text: string;
  quantity_raw: string;
  completed: boolean;
}

export interface OcrResult {
  date?: string;
  goal?: string;
  total_minutes?: number;
  items: OcrItem[];
}
