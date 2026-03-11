import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_ACTIVITY } from '../../data/mockData';
import { getActivityLogs as localGetActivityLogs } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getActivityLogs } from '../../lib/db';
import type { ActivityLog } from '../../types';

const TYPE_STYLE: Record<string, { icon: string; color: string }> = {
  login_parent:  { icon: '🔑', color: 'bg-blue-100 text-blue-700' },
  login_child:   { icon: '🎒', color: 'bg-purple-100 text-purple-700' },
  logout:        { icon: '🚪', color: 'bg-gray-100 text-gray-500' },
  submit:        { icon: '📤', color: 'bg-teal-100 text-teal-700' },
  approve:       { icon: '⭐', color: 'bg-green-100 text-green-700' },
  reject:        { icon: '✏️', color: 'bg-orange-100 text-orange-700' },
  delete:        { icon: '🗑️', color: 'bg-red-100 text-red-600' },
  pin_fail:      { icon: '🚫', color: 'bg-red-100 text-red-600' },
  external_link: { icon: '🔗', color: 'bg-yellow-100 text-yellow-700' },
};

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatFull(ts: string) {
  return new Date(ts).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SecurityLog() {
  const { family, isDemo } = useAuth();
  const [logs, setLogs]       = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setLogs(MOCK_ACTIVITY);
    } else if (family?.id && isSupabaseConfigured) {
      setLogs(await getActivityLogs(family.id));
    } else if (family?.id) {
      setLogs(localGetActivityLogs(family.id));
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // 날짜 그룹핑
  const grouped: Record<string, ActivityLog[]> = {};
  for (const log of logs) {
    const day = log.timestamp.slice(0, 10);
    (grouped[day] ??= []).push(log);
  }
  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-300 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">활동 로그</h1>
          <p className="text-gray-400 text-sm">가족 계정의 모든 활동을 확인해요</p>
        </div>
        {!isDemo && (
          <button onClick={loadLogs} className="text-xs text-blue-400 hover:text-blue-600">↻ 새로고침</button>
        )}
      </div>

      {logs.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-3xl mb-2">🔒</p>
          <p className="text-gray-400">아직 활동 기록이 없어요</p>
        </div>
      )}

      {days.map(day => (
        <div key={day}>
          <p className="text-xs font-bold text-gray-400 mb-2 px-1">
            {new Date(day).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
          <div className="space-y-2">
            {grouped[day].map(log => {
              const style = TYPE_STYLE[log.type] ?? { icon: '📌', color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={log.id} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${style.color}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{log.description}</p>
                    <p className="text-xs text-gray-400">{log.actor} · {formatFull(log.timestamp)}</p>
                  </div>
                  <p className="text-xs text-gray-300 flex-shrink-0">{formatTime(log.timestamp)}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
