import { useState, useEffect, useCallback } from 'react';
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
