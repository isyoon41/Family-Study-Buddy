import type { Child, Family, ParentUser, StudyLog, Textbook, ActivityLog } from '../types';

export const MOCK_FAMILY: Family = { id: 'family-001', name: '김씨 가족' };

export const MOCK_PARENT: ParentUser = {
  id: 'parent-001',
  family_id: 'family-001',
  email: 'parent@example.com',
  name: '김부모',
  role: 'parent',
};

export const MOCK_CHILDREN: Child[] = [
  { id: 'child-001', family_id: 'family-001', name: '민준', grade: '초5', pin: '1234', avatar: '🐶', active: true, created_at: '2024-01-01' },
  { id: 'child-002', family_id: 'family-001', name: '서연', grade: '초3', pin: '5678', avatar: '🦊', active: true, created_at: '2024-01-01' },
];

export const MOCK_TEXTBOOKS: Textbook[] = [
  { id: 'tb-001', child_id: 'child-001', family_id: 'family-001', subject: '수학', name: '수학의 정석 기초편', total_pages: 350, created_at: '2024-01-01' },
  { id: 'tb-002', child_id: 'child-001', family_id: 'family-001', subject: '국어', name: '국어 독해력 5단계', total_pages: 160, created_at: '2024-01-01' },
  { id: 'tb-003', child_id: 'child-002', family_id: 'family-001', subject: '수학', name: '쎈 수학 3학년', total_pages: 280, created_at: '2024-01-01' },
];

export const MOCK_LOGS: StudyLog[] = [
  {
    id: 'log-001', child_id: 'child-001', child_name: '민준', child_avatar: '🐶',
    family_id: 'family-001', date: '2026-03-09', goal: '오늘 공부 다 끝내기!',
    items: [
      { id: 'i1', subject: '수학', task_text: '수학의 정석 기초편', quantity_raw: 'p.112~120', completed: true, textbook_id: 'tb-001' },
      { id: 'i2', subject: '국어', task_text: '국어 독해력 5단계', quantity_raw: 'p.34~36', completed: true, textbook_id: 'tb-002' },
      { id: 'i3', subject: '영어', task_text: '단어 외우기', quantity_raw: '20개', completed: false },
    ],
    total_minutes: 150, status: 'approved',
    parent_comment: '⭐ 잘했어요! 내일도 화이팅!',
    created_at: '2026-03-09T10:00:00',
  },
  {
    id: 'log-002', child_id: 'child-001', child_name: '민준', child_avatar: '🐶',
    family_id: 'family-001', date: '2026-03-08', goal: '집중해서 공부하기',
    items: [
      { id: 'i4', subject: '수학', task_text: '수학의 정석 기초편', quantity_raw: 'p.100~111', completed: true, textbook_id: 'tb-001' },
    ],
    total_minutes: 90, status: 'pending',
    created_at: '2026-03-08T10:00:00',
  },
  {
    id: 'log-003', child_id: 'child-002', child_name: '서연', child_avatar: '🦊',
    family_id: 'family-001', date: '2026-03-09', goal: '영어랑 수학 열심히',
    items: [
      { id: 'i5', subject: '영어', task_text: '단어 카드', quantity_raw: '15개', completed: true },
      { id: 'i6', subject: '수학', task_text: '쎈 수학 3학년', quantity_raw: 'p.45~48', completed: false, textbook_id: 'tb-003' },
    ],
    total_minutes: 60, status: 'pending',
    created_at: '2026-03-09T09:00:00',
  },
  {
    id: 'log-004', child_id: 'child-001', child_name: '민준', child_avatar: '🐶',
    family_id: 'family-001', date: '2026-03-07', goal: '복습 위주로',
    items: [
      { id: 'i7', subject: '수학', task_text: '수학의 정석 기초편', quantity_raw: 'p.90~99', completed: false, textbook_id: 'tb-001' },
    ],
    total_minutes: 45, status: 'rejected',
    parent_comment: '✏️ 사진이 잘 안 보여요. 다시 올려줄 수 있어?',
    created_at: '2026-03-07T11:00:00',
  },
  {
    id: 'log-005', child_id: 'child-001', child_name: '민준', child_avatar: '🐶',
    family_id: 'family-001', date: '2026-03-10', goal: '오늘의 목표!',
    items: [], total_minutes: 0, status: 'draft',
    created_at: '2026-03-10T08:00:00',
  },
];

export const MOCK_ACTIVITY: ActivityLog[] = [
  { id: 'a1', family_id: 'family-001', timestamp: '2026-03-09T10:05:00', type: 'login_child', actor: '민준 🐶', description: '자녀 로그인' },
  { id: 'a2', family_id: 'family-001', timestamp: '2026-03-09T10:30:00', type: 'submit', actor: '민준 🐶', description: '공부 기록 제출 (2026-03-09)' },
  { id: 'a3', family_id: 'family-001', timestamp: '2026-03-09T11:00:00', type: 'login_parent', actor: '부모님', description: '부모님 로그인' },
  { id: 'a4', family_id: 'family-001', timestamp: '2026-03-09T11:05:00', type: 'approve', actor: '부모님', description: '민준의 기록 승인 (2026-03-09)' },
  { id: 'a5', family_id: 'family-001', timestamp: '2026-03-09T09:10:00', type: 'login_child', actor: '서연 🦊', description: '자녀 로그인' },
  { id: 'a6', family_id: 'family-001', timestamp: '2026-03-09T09:30:00', type: 'submit', actor: '서연 🦊', description: '공부 기록 제출 (2026-03-09)' },
  { id: 'a7', family_id: 'family-001', timestamp: '2026-03-08T14:00:00', type: 'reject', actor: '부모님', description: '민준의 기록 다시 써봐요 (2026-03-07)' },
];
