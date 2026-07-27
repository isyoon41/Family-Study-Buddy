import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren } from '../../lib/db';
import { calcStreak } from '../../utils/achievements';
import type { StudyLog } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  draft:    'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '확인 대기', approved: '잘했어요! ⭐', rejected: '다시 써봐요 ✏️', draft: '작성 중',
};

const CHILD_PALETTE = [
  { dot: 'bg-blue-400',    text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20'    },
  { dot: 'bg-pink-400',    text: 'text-pink-600 dark:text-pink-400',        bg: 'bg-pink-50 dark:bg-pink-900/20'    },
  { dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { dot: 'bg-purple-400',  text: 'text-purple-600 dark:text-purple-400',    bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { dot: 'bg-orange-400',  text: 'text-orange-600 dark:text-orange-400',    bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { dot: 'bg-teal-400',    text: 'text-teal-600 dark:text-teal-400',        bg: 'bg-teal-50 dark:bg-teal-900/20'    },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function StudyCalendar({ approvedLogs }: { approvedLogs: StudyLog[] }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const childColorMap = useMemo(() => {
    const map = new Map<string, number>();
    approvedLogs.forEach(log => { if (!map.has(log.child_id)) map.set(log.child_id, map.size); });
    return map;
  }, [approvedLogs]);

  const children = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; avatar: string }>();
    approvedLogs.forEach(log => {
      if (!seen.has(log.child_id)) seen.set(log.child_id, { id: log.child_id, name: log.child_name, avatar: log.child_avatar });
    });
    return [...seen.values()];
  }, [approvedLogs]);

  const calendarData = useMemo(() => {
    const map = new Map<string, Set<string>>();
    approvedLogs.forEach(log => {
      const [y, m] = log.date.split('-').map(Number);
      if (y === viewYear && m - 1 === viewMonth) {
        if (!map.has(log.date)) map.set(log.date, new Set());
        map.get(log.date)!.add(log.child_id);
      }
    });
    return map;
  }, [approvedLogs, viewYear, viewMonth]);

  const monthlyCount = useMemo(() => {
    const map = new Map<string, number>();
    approvedLogs.forEach(log => {
      const [y, m] = log.date.split('-').map(Number);
      if (y === viewYear && m - 1 === viewMonth)
        map.set(log.child_id, (map.get(log.child_id) ?? 0) + 1);
    });
    return map;
  }, [approvedLogs, viewYear, viewMonth]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr    = today.toISOString().slice(0, 10);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[32px] p-5 shadow-sm transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 dark:text-slate-100 tracking-tight">📅 학습 캘린더</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 text-lg transition">‹</button>
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 w-24 text-center">{viewYear}년 {viewMonth + 1}월</span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 text-lg transition">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-slate-500'}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const mm = String(viewMonth + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const dateStr = `${viewYear}-${mm}-${dd}`;
          const submitters = calendarData.get(dateStr);
          const isToday = dateStr === todayStr;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;
          return (
            <div key={dateStr} className={`flex flex-col items-center py-1 rounded-xl min-h-[46px] ${isToday ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-600' : ''}`}>
              <span className={`text-xs font-medium mb-0.5 ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600 dark:text-slate-300'}`}>{day}</span>
              {submitters && submitters.size > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center max-w-[28px]">
                  {[...submitters].map(childId => {
                    const ci = childColorMap.get(childId) ?? 0;
                    return <span key={childId} className={`w-2 h-2 rounded-full ${CHILD_PALETTE[ci % CHILD_PALETTE.length].dot} shadow-sm`} title={children.find(c => c.id === childId)?.name ?? ''} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {children.length > 0 && (
        <>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex flex-wrap gap-2">
            {children.map(child => {
              const ci = childColorMap.get(child.id) ?? 0;
              const color = CHILD_PALETTE[ci % CHILD_PALETTE.length];
              return (
                <div key={child.id} className={`flex items-center gap-1.5 text-xs ${color.bg} px-2.5 py-1 rounded-full`}>
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  <span className={`font-medium ${color.text}`}>{child.avatar} {child.name}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-2">{viewMonth + 1}월 승인 완료 현황</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {children.map(child => {
                const ci = childColorMap.get(child.id) ?? 0;
                const color = CHILD_PALETTE[ci % CHILD_PALETTE.length];
                const count = monthlyCount.get(child.id) ?? 0;
                const childStreak = calcStreak(approvedLogs.filter(l => l.child_id === child.id));
                return (
                  <div key={child.id} className={`flex items-center gap-2 ${color.bg} rounded-xl px-3 py-2`}>
                    <span className="text-xl">{child.avatar}</span>
                    <div>
                      <p className={`text-xs font-bold ${color.text}`}>{child.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{count > 0 ? `${count}회 승인` : '아직 없어요'}</p>
                      {childStreak > 0 && <p className="text-xs text-orange-500 font-bold">🔥 {childStreak}일 연속</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ParentDashboard() {
  const { family, isDemo } = useAuth();
  const navigate = useNavigate();
  const [allLogs, setAllLogs]       = useState<StudyLog[]>([]);
  const [childCount, setChildCount] = useState(0);
  const [loading, setLoading]       = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setAllLogs(MOCK_LOGS); setChildCount(MOCK_CHILDREN.length);
    } else if (family?.id && isSupabaseConfigured) {
      const [logs, children] = await Promise.all([getStudyLogs(family.id), getChildren(family.id)]);
      setAllLogs(logs); setChildCount(children.length);
    } else if (family?.id) {
      setAllLogs(getSheets(family.id)); setChildCount(localGetChildren(family.id).length);
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const onFocus = () => { if (!isDemo) loadData(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isDemo, loadData]);

  const pending      = allLogs.filter(l => l.status === 'pending');
  const approved     = allLogs.filter(l => l.status === 'approved').length;
  const total        = allLogs.filter(l => l.status !== 'draft').length;
  const rate         = total > 0 ? Math.round((approved / total) * 100) : 0;
  const recentLogs   = [...allLogs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const approvedLogs = allLogs.filter(l => l.status === 'approved');

    const STAT_CARDS = [
    { icon: '👶', label: '자녀 수',   value: childCount,     bg: '#DBEAFE', iconBg: '#BFDBFE', valColor: '#1E40AF', to: '/parent/children' },
    { icon: '⏳', label: '승인 대기', value: pending.length, bg: '#FEF9C3', iconBg: '#FDE68A', valColor: '#854D0E', to: '/parent/schedule' },
    { icon: '⭐', label: '승인 완료', value: approved,       bg: '#DCFCE7', iconBg: '#BBF7D0', valColor: '#166534', to: null },
    { icon: '📈', label: '승인율',   value: `${rate}%`,     bg: '#F3E8FF', iconBg: '#E9D5FF', valColor: '#6B21A8', to: null },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight" style={{ letterSpacing: '-0.48px' }}>대시보드</h1>
          <p className="text-sm mt-0.5" style={{ color: '#93979f' }}>오늘도 아이들 응원해주세요 💪</p>
        </div>
        {!isDemo && (
          <button onClick={loadData} className="text-sm text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition">↻ 새로고침</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-3 h-3 bg-blue-300 dark:bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STAT_CARDS.map((c, i) => (
              <div
                key={c.label}
                onClick={() => c.to && navigate(c.to)}
                style={{ backgroundColor: c.bg, borderRadius: 20,
                  border: '2px solid rgba(0,0,0,.06)', padding: '20px 16px',
                  cursor: c.to ? 'pointer' : 'default',
                  transition: 'transform .15s', animationDelay: `${i * 0.08}s`,
                  animationFillMode: 'both', opacity: 0 }}
                className="animate-slide-up hover:scale-[1.02] active:scale-95"
              >
                <div style={{ width: 40, height: 40, borderRadius: 12,
                  backgroundColor: c.iconBg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{c.icon}</div>
                <p style={{ fontSize: 26, fontWeight: 900, color: c.valColor, letterSpacing: '-.03em' }}>{c.value}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: c.valColor, opacity: .7 }}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* 학습 캘린더 */}
          <StudyCalendar approvedLogs={approvedLogs} />

          {/* 승인 대기 */}
          {pending.length > 0 && (
            <div className="animate-slide-up">
              <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                승인 대기 ({pending.length}건)
              </h2>
              <div className="space-y-2">
                {pending.slice(0, 3).map(log => {
                  const childStreak = calcStreak(approvedLogs.filter(l => l.child_id === log.child_id));
                  return (
                    <button key={log.id} onClick={() => navigate('/parent/schedule')}
                      className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border-l-4 border-amber-400 text-left hover:shadow-md transition dark:border-amber-500">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 dark:text-white">{log.child_avatar} {log.child_name}</p>
                            {childStreak >= 3 && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 px-2 py-0.5 rounded-full font-bold">
                                🔥 {childStreak}일 연속
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-slate-400">{log.date} · {log.goal || '(목표 없음)'}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{log.items.length}개 항목 · {log.total_minutes}분</p>
                        </div>
                        <span className="text-blue-500 dark:text-blue-400 text-sm">확인 →</span>
                      </div>
                    </button>
                  );
                })}
                {pending.length > 3 && (
                  <button onClick={() => navigate('/parent/schedule')}
                    className="w-full text-center text-blue-500 dark:text-blue-400 text-sm py-2 hover:underline">
                    + {pending.length - 3}건 더 보기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 최근 활동 */}
          <div className="animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both', opacity: 0 }}>
            <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-3">최근 활동</h2>
            <div className="space-y-2">
              {recentLogs.length === 0
                ? <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center text-gray-400 dark:text-slate-500 shadow-sm">아직 기록이 없어요</div>
                : recentLogs.map(log => (
                  <div key={log.id} className="bg-white dark:bg-slate-800 rounded-[20px] p-3 shadow-sm flex items-center gap-3 transition-colors duration-300">
                    <span className="text-2xl">{log.child_avatar}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{log.child_name} · {log.date}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{log.goal || '(목표 없음)'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[log.status]}`}>
                      {STATUS_LABEL[log.status]}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
