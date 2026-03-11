import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS } from '../../data/mockData';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getChildStudyLogs } from '../../lib/db';
import type { StudyLog } from '../../types';

const STATUS = {
  draft:    { label: '작성 중',          color: 'bg-gray-100 text-gray-500',    icon: '📝' },
  pending:  { label: '부모님 확인 중 ⏳', color: 'bg-yellow-100 text-yellow-600', icon: '⏳' },
  approved: { label: '잘했어요! ⭐',     color: 'bg-green-100 text-green-600',   icon: '⭐' },
  rejected: { label: '다시 써봐요 ✏️',  color: 'bg-red-100 text-red-500',       icon: '✏️' },
} as const;

const SUBJECT_COLORS: Record<string, string> = {
  수학: 'bg-blue-100 text-blue-600',
  국어: 'bg-green-100 text-green-600',
  영어: 'bg-purple-100 text-purple-600',
  과학: 'bg-yellow-100 text-yellow-600',
  사회: 'bg-orange-100 text-orange-600',
};

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

export default function ChildDashboard() {
  const { child, logout, isDemo } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    if (isDemo) {
      const demo = MOCK_LOGS
        .filter(l => l.child_id === child?.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      setLogs(demo);
    } else if (child?.id && child?.pin && isSupabaseConfigured) {
      const data = await getChildStudyLogs(child.id, child.pin);
      setLogs(data);
    }
    setLoadingLogs(false);
  }, [child, isDemo]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // 업로드 완료 후 새로고침을 위한 focus 이벤트
  useEffect(() => {
    const onFocus = () => { if (!isDemo) loadLogs(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isDemo, loadLogs]);

  const approved   = logs.filter(l => l.status === 'approved').length;
  const pending    = logs.filter(l => l.status === 'pending').length;
  const totalMin   = logs.filter(l => l.status === 'approved').reduce((s, l) => s + l.total_minutes, 0);
  const totalHours = Math.floor(totalMin / 60);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-50">
      {isDemo && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-yellow-700 text-xs text-center">
          ✏️ 데모 모드 — 가짜 데이터입니다
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-2xl">{child?.avatar}</div>
          <div>
            <p className="font-bold text-gray-800">{child?.name}</p>
            <p className="text-xs text-gray-400">{child?.grade}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadLogs} className="text-xs text-blue-400 hover:text-blue-600 transition">↻ 새로고침</button>
          <button onClick={logout}   className="text-xs text-gray-400 hover:text-red-400 transition">로그아웃</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 통계 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={approved}   label="칭찬 받은 날" icon="⭐" />
          <StatCard value={pending}    label="확인 기다리는 중" icon="⏳" />
          <StatCard value={totalHours} label="총 공부 시간(h)" icon="⏱" />
        </div>

        {/* 계획표 올리기 버튼 */}
        <button
          onClick={() => navigate('/child/upload')}
          className="w-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 text-white py-5 rounded-3xl font-bold text-lg shadow-lg hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <span className="text-2xl">📸</span> 계획표 올리기
        </button>

        {/* 내 공부 기록 */}
        <div>
          <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span>📋</span> 내 공부 기록
            <span className="text-xs font-normal text-gray-400">({logs.length}개)</span>
          </h2>

          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <div className="flex gap-2">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 bg-blue-300 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-4xl mb-2">📚</p>
                  <p className="text-gray-400 text-sm">아직 기록이 없어요</p>
                  <p className="text-gray-400 text-xs mt-1">첫 번째 공부를 올려봐요!</p>
                </div>
              )}
              {logs.map(log => {
                const st = STATUS[log.status];
                const isOpen = expanded === log.id;
                return (
                  <button
                    key={log.id}
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 text-left transition hover:shadow-md"
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-xs text-gray-400">{log.date}</p>
                          <p className="font-bold text-gray-800 mt-0.5 text-sm">{log.goal || '(목표 없음)'}</p>
                          {log.total_minutes > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              ⏱ {Math.floor(log.total_minutes / 60)}시간 {log.total_minutes % 60}분
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.color}`}>
                            {st.label}
                          </span>
                          <span className="text-gray-300 text-xs">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {log.parent_comment && (
                        <div className="mt-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                          <p className="text-xs text-green-700">💬 부모님: {log.parent_comment}</p>
                        </div>
                      )}
                    </div>

                    {/* 펼친 상세 */}
                    {isOpen && log.items.length > 0 && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                        {log.items.map(item => (
                          <div key={item.id} className="flex items-start gap-2">
                            <span className={`text-lg ${item.completed ? 'opacity-100' : 'opacity-30'}`}>
                              {item.completed ? '✅' : '⬜'}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SUBJECT_COLORS[item.subject] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {item.subject}
                                </span>
                                <span className="text-sm text-gray-700">{item.task_text}</span>
                              </div>
                              {item.quantity_raw && (
                                <p className="text-xs text-gray-400 mt-0.5 ml-0.5">{item.quantity_raw}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
