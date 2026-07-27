import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS } from '../../data/mockData';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getChildStudyLogs } from '../../lib/db';
import { calcStreak, calcBadges, streakMessage } from '../../utils/achievements';
import type { StudyLog, StudyItem } from '../../types';

const STATUS = {
  draft:    { label: '작성 중',          color: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300',    icon: '📝' },
  pending:  { label: '확인 중 ⏳',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: '⏳' },
  approved: { label: '잘했어요! ⭐',     color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: '⭐' },
  rejected: { label: '다시 써봐요 ✏️',  color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',        icon: '✏️' },
} as const;

const SUBJECT_COLORS: Record<string, string> = {
  수학: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  국어: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  영어: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  과학: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  사회: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  한자: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  중국어: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  '성경 말씀(큐티)': 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
  독서: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  '전과목 학습지': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
  도덕: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
};

// ── 칭찬 셀레브레이션 파티클 ─────────────────────────────
const CONFETTI_COLORS = ['#fbbf24','#34d399','#60a5fa','#f472b6','#a78bfa'];

function ConfettiParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="confetti-dot"
          style={{
            left: `${10 + i * 11}%`,
            top: '20%',
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── 뱃지 칩 ─────────────────────────────────────────────
function BadgeChip({ icon, name, earned }: { icon: string; name: string; earned: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all
        ${earned
          ? 'bg-amber-50 text-amber-700 border border-amber-200 badge-earned dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 animate-pop-in'
          : 'bg-gray-100 text-gray-400 border border-gray-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 opacity-50 grayscale'
        }`}
    >
      <span className={earned ? 'animate-sparkle' : ''}>{icon}</span>
      {name}
    </div>
  );
}

// ── 공부 기록 카드 ───────────────────────────────────────
function StudyLogCard({ log, index }: { log: StudyLog; index: number }) {
  const [open, setOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const st = STATUS[log.status];

  const handleToggle = () => {
    if (!open && log.status === 'approved') setShowConfetti(true);
    setOpen(o => !o);
    if (open) setShowConfetti(false);
  };

  return (
    <button
      onClick={handleToggle}
      className="relative w-full text-left rounded-2xl overflow-hidden border transition-all duration-300 animate-slide-up
        bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700
        hover:shadow-md active:scale-[0.99]
        ${log.status === 'approved' ? 'border-l-4 border-l-green-400' : ''}
        ${log.status === 'rejected' ? 'border-l-4 border-l-red-400' : ''}
        ${log.status === 'pending'  ? 'border-l-4 border-l-amber-400' : ''}"
      style={{ animationDelay: `${index * 0.06}s`, animationFillMode: 'both', opacity: 0 }}
    >
      {showConfetti && <ConfettiParticles />}

      <div className="p-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">{log.date}</p>
            <p className="font-bold text-gray-800 dark:text-white text-sm truncate">
              {log.goal || '(목표 없음)'}
            </p>
            {log.total_minutes > 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                ⏱ {Math.floor(log.total_minutes / 60)}시간 {log.total_minutes % 60}분
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.color} ${log.status === 'approved' ? 'animate-celebrate' : ''}`}>
              {st.label}
            </span>
            <span className="text-gray-300 dark:text-slate-600 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </div>

        {log.parent_comment && (
          <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 py-2">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">💬 부모님: {log.parent_comment}</p>
          </div>
        )}
      </div>

      {open && log.items.length > 0 && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-4 pb-4 pt-3 space-y-2">
          {log.items.map((item: StudyItem) => (
            <div key={item.id} className="flex items-start gap-2">
              <span className={`text-base flex-shrink-0 mt-0.5 ${item.completed ? '' : 'opacity-30'}`}>
                {item.completed ? '✅' : '⬜'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${SUBJECT_COLORS[item.subject] ?? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {item.subject}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-slate-200 truncate">{item.task_text}</span>
                </div>
                {item.quantity_raw && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{item.quantity_raw}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function ChildDashboard() {
  const { child, logout, isDemo } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    if (isDemo) {
      setLogs(MOCK_LOGS.filter(l => l.child_id === child?.id).sort((a, b) => b.date.localeCompare(a.date)));
    } else if (child?.id && child?.pin && isSupabaseConfigured) {
      setLogs(await getChildStudyLogs(child.id, child.pin));
    }
    setLoadingLogs(false);
  }, [child, isDemo]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => {
    const onFocus = () => { if (!isDemo) loadLogs(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isDemo, loadLogs]);

  const approved   = logs.filter(l => l.status === 'approved');
  const pending    = logs.filter(l => l.status === 'pending').length;
  const totalMin   = approved.reduce((s, l) => s + l.total_minutes, 0);
  const totalHours = Math.floor(totalMin / 60);
  const streak     = calcStreak(approved);
  const badges     = calcBadges(logs, streak);
  const earnedBadges = badges.filter(b => b.earned);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {isDemo && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-2 text-amber-700 dark:text-amber-300 text-xs text-center">
          ✏️ 데모 모드 — 가짜 데이터입니다
        </div>
      )}

      {/* ── 히어로 헤더 ─────────────────────────────────── */}
      <div
        ref={headerRef}
        className="relative bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 overflow-hidden pb-24 pt-6 px-4"
      >
        {/* 배경 원형 장식 */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8  w-40 h-40 bg-white/10 rounded-full" />

        {/* 상단 버튼 */}
        <div className="relative flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/child')}
            className="text-white/80 hover:text-white text-sm flex items-center gap-1 transition"
          >
            ← 전환
          </button>
          <div className="flex items-center gap-3">
            <button onClick={loadLogs} className="text-white/70 hover:text-white text-xs transition">↻</button>
            <button onClick={logout}   className="text-white/70 hover:text-white text-xs transition">나가기</button>
          </div>
        </div>

        {/* 아바타 + 이름 */}
        <div className="relative flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-5xl mb-3 shadow-lg animate-float border-4 border-white/30">
            {child?.avatar}
          </div>
          <h1 className="text-2xl font-extrabold text-white drop-shadow">{child?.name}</h1>
          <p className="text-white/70 text-sm mt-0.5">{child?.grade}</p>

          {/* 스트릭 */}
          {streak > 0 ? (
            <div className="mt-3 flex items-center gap-2 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-xl animate-flame">🔥</span>
              <span className="text-white font-bold text-sm">{streak}일 연속!</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-xl">🌱</span>
              <span className="text-white/90 text-sm">오늘 첫 기록을 남겨봐요!</span>
            </div>
          )}
          <p className="text-white/60 text-xs mt-1.5">{streakMessage(streak)}</p>
        </div>
      </div>

      {/* ── 본문 영역 ─────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 -mt-16 pb-10 space-y-4">

        {/* 통계 카드 (히어로 위에 겹침) */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-4 grid grid-cols-4 gap-2 animate-pop-in">
          {[
            { icon: '⭐', value: approved.length, label: '칭찬 받은 날' },
            { icon: '🔥', value: `${streak}일`,  label: '연속 달성' },
            { icon: '⏱',  value: `${totalHours}h`, label: '총 공부' },
            { icon: '🪙', value: child?.coins ?? 0, label: '보상 코인' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center py-2">
              <span className="text-2xl mb-1">{s.icon}</span>
              <p className="text-xl font-extrabold text-gray-800 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-400 dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 코인 안내 배너 */}
        <div className="bg-gradient-to-r from-yellow-400 to-amber-400 dark:from-yellow-600 dark:to-amber-600 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-2xl">🪙</span>
          <div className="flex-1">
            <p className="text-white font-bold text-xs">주간 미션</p>
            <p className="text-white/90 text-xs">5일 공부 → 100코인 · 6일 공부 → 300코인</p>
          </div>
          <p className="text-white font-extrabold text-lg">{child?.coins ?? 0}</p>
        </div>

        {/* 뱃지 섹션 */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-gray-800 dark:text-white text-sm flex items-center gap-1.5">
              🎖️ 내 뱃지
            </h2>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {earnedBadges.length}/{badges.length} 획득
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <BadgeChip key={b.id} icon={b.icon} name={b.name} earned={b.earned} />
            ))}
          </div>
          {earnedBadges.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">
              공부를 기록하면 뱃지를 받을 수 있어요! 🌱
            </p>
          )}
        </div>

        {/* 오늘 공부 올리기 CTA */}
        <button
          onClick={() => navigate('/child/upload')}
          className="w-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 dark:from-blue-600 dark:to-emerald-600
            text-white py-5 rounded-3xl font-extrabold text-lg shadow-lg
            hover:opacity-90 active:scale-95 transition-all duration-200
            flex items-center justify-center gap-3 animate-glow-pulse"
        >
          <span className="text-2xl animate-bounce-soft">📸</span>
          오늘 공부 기록하기
        </button>

        {/* 독서 컬렉션 바로가기 */}
        <button
          onClick={() => navigate('/child/books')}
          className="w-full bg-gradient-to-r from-amber-400 to-orange-400 dark:from-amber-600 dark:to-orange-600
            text-white py-4 rounded-3xl font-bold text-base shadow-md
            hover:opacity-90 active:scale-95 transition-all duration-200
            flex items-center justify-center gap-2">
          <span className="text-xl">📚</span>
          내 독서 컬렉션 보기
        </button>

        {/* 확인 대기 알림 */}
        {pending > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-3 flex items-center gap-3 animate-slide-up">
            <span className="text-2xl animate-bounce-soft">⏳</span>
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{pending}개 확인 중</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70">부모님이 곧 확인해 주실 거예요!</p>
            </div>
          </div>
        )}

        {/* 공부 기록 목록 */}
        <div>
          <h2 className="font-extrabold text-gray-700 dark:text-slate-300 text-sm mb-3 flex items-center gap-2">
            📋 내 공부 기록
            <span className="font-normal text-gray-400 dark:text-slate-500">({logs.length}개)</span>
          </h2>

          {loadingLogs ? (
            <div className="flex justify-center py-10">
              <div className="flex gap-2">
                {[0,1,2].map(i => (
                  <div key={i} className="w-3 h-3 bg-blue-300 dark:bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center shadow-sm animate-fade-in">
              <p className="text-5xl mb-3 animate-float inline-block">📚</p>
              <p className="text-gray-500 dark:text-slate-400 font-bold">아직 기록이 없어요</p>
              <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">위 버튼으로 첫 기록을 남겨봐요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, i) => (
                <StudyLogCard key={log.id} log={log} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
