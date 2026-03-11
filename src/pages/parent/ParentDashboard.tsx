import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren } from '../../lib/db';
import type { StudyLog } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  draft:    'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '확인 대기', approved: '잘했어요! ⭐', rejected: '다시 써봐요 ✏️', draft: '작성 중',
};

// 자녀별 색상 팔레트
const CHILD_PALETTE = [
  { dot: 'bg-blue-400',    text: 'text-blue-600',    bg: 'bg-blue-50'    },
  { dot: 'bg-pink-400',    text: 'text-pink-600',    bg: 'bg-pink-50'    },
  { dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  { dot: 'bg-purple-400',  text: 'text-purple-600',  bg: 'bg-purple-50'  },
  { dot: 'bg-orange-400',  text: 'text-orange-600',  bg: 'bg-orange-50'  },
  { dot: 'bg-teal-400',    text: 'text-teal-600',    bg: 'bg-teal-50'    },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ─────────────────────────────────────────────────────────────────
// StudyCalendar 컴포넌트
// ─────────────────────────────────────────────────────────────────
function StudyCalendar({ approvedLogs }: { approvedLogs: StudyLog[] }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // child_id → 팔레트 인덱스 (첫 등장 순서로 고정)
  const childColorMap = useMemo(() => {
    const map = new Map<string, number>();
    approvedLogs.forEach(log => {
      if (!map.has(log.child_id)) map.set(log.child_id, map.size);
    });
    return map;
  }, [approvedLogs]);

  // 고유 자녀 목록
  const children = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; avatar: string }>();
    approvedLogs.forEach(log => {
      if (!seen.has(log.child_id))
        seen.set(log.child_id, { id: log.child_id, name: log.child_name, avatar: log.child_avatar });
    });
    return [...seen.values()];
  }, [approvedLogs]);

  // 날짜(YYYY-MM-DD) → 제출한 child_id Set  (현재 보는 달 기준)
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

  // 이번 달 자녀별 승인 횟수
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
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay(); // 0=일
  const todayStr    = today.toISOString().slice(0, 10);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // 캘린더 셀 배열 (null = 빈 칸, number = 날짜)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-700">📅 학습 캘린더</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg">
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-700 w-24 text-center">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg">
            ›
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-medium py-1
            ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;

          const mm      = String(viewMonth + 1).padStart(2, '0');
          const dd      = String(day).padStart(2, '0');
          const dateStr = `${viewYear}-${mm}-${dd}`;
          const submitters = calendarData.get(dateStr);
          const isToday = dateStr === todayStr;
          const isSun   = idx % 7 === 0;
          const isSat   = idx % 7 === 6;

          return (
            <div key={dateStr}
              className={`flex flex-col items-center py-1 rounded-xl min-h-[46px]
                ${isToday ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}>
              <span className={`text-xs font-medium mb-0.5
                ${isToday ? 'text-blue-600 font-bold' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600'}`}>
                {day}
              </span>
              {submitters && submitters.size > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center max-w-[28px]">
                  {[...submitters].map(childId => {
                    const ci    = childColorMap.get(childId) ?? 0;
                    const color = CHILD_PALETTE[ci % CHILD_PALETTE.length];
                    return (
                      <span key={childId}
                        className={`w-2 h-2 rounded-full ${color.dot} shadow-sm`}
                        title={children.find(c => c.id === childId)?.name ?? ''}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 자녀 범례 */}
      {children.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          {children.map(child => {
            const ci    = childColorMap.get(child.id) ?? 0;
            const color = CHILD_PALETTE[ci % CHILD_PALETTE.length];
            return (
              <div key={child.id}
                className={`flex items-center gap-1.5 text-xs ${color.bg} px-2.5 py-1 rounded-full`}>
                <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                <span className={`font-medium ${color.text}`}>{child.avatar} {child.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 이번 달 승인 현황 */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 font-medium mb-2">{viewMonth + 1}월 승인 완료 현황</p>
        {children.length === 0 ? (
          <p className="text-xs text-gray-300 text-center py-2">아직 승인된 학습 기록이 없어요</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {children.map(child => {
              const ci    = childColorMap.get(child.id) ?? 0;
              const color = CHILD_PALETTE[ci % CHILD_PALETTE.length];
              const count = monthlyCount.get(child.id) ?? 0;
              return (
                <div key={child.id}
                  className={`flex items-center gap-2 ${color.bg} rounded-xl px-3 py-2`}>
                  <span className="text-xl">{child.avatar}</span>
                  <div>
                    <p className={`text-xs font-bold ${color.text}`}>{child.name}</p>
                    <p className="text-xs text-gray-500">
                      {count > 0 ? `${count}회 승인 ✅` : '아직 없어요'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ParentDashboard 메인
// ─────────────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const { family, isDemo } = useAuth();
  const navigate = useNavigate();
  const [allLogs, setAllLogs]       = useState<StudyLog[]>([]);
  const [childCount, setChildCount] = useState(0);
  const [loading, setLoading]       = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setAllLogs(MOCK_LOGS);
      setChildCount(MOCK_CHILDREN.length);
    } else if (family?.id && isSupabaseConfigured) {
      const [logs, children] = await Promise.all([
        getStudyLogs(family.id),
        getChildren(family.id),
      ]);
      setAllLogs(logs);
      setChildCount(children.length);
    } else if (family?.id) {
      setAllLogs(getSheets(family.id));
      setChildCount(localGetChildren(family.id).length);
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const onFocus = () => { if (!isDemo) loadData(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isDemo, loadData]);

  const pending    = allLogs.filter(l => l.status === 'pending');
  const approved   = allLogs.filter(l => l.status === 'approved').length;
  const total      = allLogs.filter(l => l.status !== 'draft').length;
  const rate       = total > 0 ? Math.round((approved / total) * 100) : 0;
  const recentLogs = [...allLogs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const approvedLogs = allLogs.filter(l => l.status === 'approved');

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">대시보드</h1>
          <p className="text-gray-400 text-sm">오늘도 아이들 응원해주세요 💪</p>
        </div>
        {!isDemo && (
          <button onClick={loadData} className="text-sm text-blue-400 hover:text-blue-600">↻ 새로고침</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-3 h-3 bg-blue-300 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: '👶', label: '자녀 수',   value: childCount,     color: 'from-blue-400 to-blue-600' },
              { icon: '⏳', label: '승인 대기', value: pending.length, color: 'from-yellow-400 to-orange-400' },
              { icon: '⭐', label: '승인 완료', value: approved,       color: 'from-green-400 to-emerald-500' },
              { icon: '📈', label: '승인율',   value: `${rate}%`,     color: 'from-purple-400 to-pink-500' },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white shadow`}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-white/80 text-xs">{c.label}</p>
              </div>
            ))}
          </div>

          {/* 학습 캘린더 */}
          <StudyCalendar approvedLogs={approvedLogs} />

          {/* 승인 대기 */}
          {pending.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
                승인 대기 ({pending.length}건)
              </h2>
              <div className="space-y-2">
                {pending.slice(0, 3).map(log => (
                  <button key={log.id} onClick={() => navigate('/parent/schedule')}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border-l-4 border-yellow-400 text-left hover:shadow-md transition">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800">{log.child_avatar} {log.child_name}</p>
                        <p className="text-sm text-gray-500">{log.date} · {log.goal || '(목표 없음)'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{log.items.length}개 항목 · {log.total_minutes}분</p>
                      </div>
                      <span className="text-blue-500 text-sm">확인 →</span>
                    </div>
                  </button>
                ))}
                {pending.length > 3 && (
                  <button onClick={() => navigate('/parent/schedule')}
                    className="w-full text-center text-blue-500 text-sm py-2 hover:underline">
                    + {pending.length - 3}건 더 보기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 최근 활동 */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">최근 활동</h2>
            <div className="space-y-2">
              {recentLogs.length === 0
                ? <div className="bg-white rounded-2xl p-6 text-center text-gray-400 shadow-sm">아직 기록이 없어요</div>
                : recentLogs.map(log => (
                  <div key={log.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                    <span className="text-2xl">{log.child_avatar}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{log.child_name} · {log.date}</p>
                      <p className="text-xs text-gray-400">{log.goal || '(목표 없음)'}</p>
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
