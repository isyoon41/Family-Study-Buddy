import type { StudyLog } from '../types';

// ── 스트릭 계산 (승인된 날짜 기준 연속 일수) ──────────────
export function calcStreak(approvedLogs: StudyLog[]): number {
  if (!approvedLogs.length) return 0;

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const uniqueDates = [...new Set(approvedLogs.map(l => l.date))].sort().reverse();

  // 오늘 또는 어제에 기록이 있어야 스트릭 유지
  if (uniqueDates[0] !== fmt(today) && uniqueDates[0] !== fmt(yesterday)) return 0;

  let streak = 0;
  const expected = new Date(uniqueDates[0]);

  for (const d of uniqueDates) {
    if (d === fmt(expected)) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ── 뱃지 정의 ────────────────────────────────────────────
export interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  earned: boolean;
}

export function calcBadges(logs: StudyLog[], streak: number): Badge[] {
  const approved  = logs.filter(l => l.status === 'approved');
  const totalMin  = approved.reduce((s, l) => s + l.total_minutes, 0);
  const uniqueDays = new Set(approved.map(l => l.date)).size;

  return [
    { id: 'first',  icon: '🌱', name: '첫 걸음',      desc: '첫 공부 기록 제출',   earned: logs.length >= 1 },
    { id: 'star3',  icon: '⭐', name: '반짝반짝',     desc: '칭찬 3번 받기',        earned: approved.length >= 3 },
    { id: 'star10', icon: '🌟', name: '빛나는 별',    desc: '칭찬 10번 받기',       earned: approved.length >= 10 },
    { id: 'star30', icon: '💎', name: '다이아몬드',   desc: '칭찬 30번 받기',       earned: approved.length >= 30 },
    { id: 'str3',   icon: '🔥', name: '3일 연속',     desc: '3일 연속 공부 달성',   earned: streak >= 3 },
    { id: 'str7',   icon: '💪', name: '일주일 챔피언',desc: '7일 연속 공부 달성',   earned: streak >= 7 },
    { id: 'str30',  icon: '🏆', name: '한 달 마스터', desc: '30일 연속 공부 달성',  earned: streak >= 30 },
    { id: 'h1',     icon: '⏱️', name: '1시간 돌파',   desc: '누적 공부 1시간',      earned: totalMin >= 60 },
    { id: 'h10',    icon: '📚', name: '공부왕',       desc: '누적 공부 10시간',     earned: totalMin >= 600 },
    { id: 'd10',    icon: '🎯', name: '10일 달성',    desc: '10일 이상 공부하기',   earned: uniqueDays >= 10 },
  ];
}

// ── 스트릭 메시지 ─────────────────────────────────────────
export function streakMessage(streak: number): string {
  if (streak === 0)  return '오늘 첫 기록을 남겨봐요! 🌱';
  if (streak === 1)  return '시작이 반이에요! 💪';
  if (streak < 3)    return `${streak}일 연속! 계속 가봐요 🔥`;
  if (streak < 7)    return `${streak}일 연속 달성 중! 멈추지 마요 🔥`;
  if (streak < 14)   return `${streak}일 연속! 진짜 대단해요! 🌟`;
  if (streak < 30)   return `${streak}일 연속! 전설이 되고 있어요 💎`;
  return `${streak}일 연속! 우주 최강 공부왕! 🏆`;
}
