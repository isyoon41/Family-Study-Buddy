import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren, updateSheetStatus, deleteSheet, addActivityLog as localAddActivity } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren, updateLogStatus, deleteStudyLog, addActivityLog } from '../../lib/db';
import type { StudyLog, Child } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  draft:    'bg-gray-100 text-gray-500 border-gray-200',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '확인 대기', approved: '잘했어요! ⭐', rejected: '다시 써봐요 ✏️', draft: '작성 중',
};
const STICKERS = ['⭐','🔥','💪','🎉','👍','🌟','❤️','🥳'];
const SUBJECT_COLORS: Record<string, string> = {
  수학: 'bg-blue-100 text-blue-600', 국어: 'bg-green-100 text-green-600',
  영어: 'bg-purple-100 text-purple-600', 과학: 'bg-yellow-100 text-yellow-600',
  사회: 'bg-orange-100 text-orange-600',
};

export default function Schedule() {
  const { family, isDemo } = useAuth();
  const [filterChild, setFilterChild]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected]         = useState<StudyLog | null>(null);
  const [comment, setComment]           = useState('');
  const [allLogs, setAllLogs]           = useState<StudyLog[]>([]);
  const [children, setChildren]         = useState<Child[]>([]);
  const [loading, setLoading]           = useState(true);
  const [acting, setActing]             = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setAllLogs(MOCK_LOGS);
      setChildren(MOCK_CHILDREN);
    } else if (family?.id && isSupabaseConfigured) {
      const [logs, kids] = await Promise.all([
        getStudyLogs(family.id),
        getChildren(family.id),
      ]);
      setAllLogs(logs);
      setChildren(kids);
    } else if (family?.id) {
      setAllLogs(getSheets(family.id));
      setChildren(localGetChildren(family.id));
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = allLogs
    .filter(l => filterChild === 'all' || l.child_id === filterChild)
    .filter(l => filterStatus === 'all' || l.status === filterStatus)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const doAction = async (log: StudyLog, status: 'approved' | 'rejected') => {
    if (isDemo) { alert('데모 모드에서는 변경할 수 없어요'); return; }
    setActing(true);

    if (isSupabaseConfigured) {
      await updateLogStatus(log.id, status, comment || undefined);
      await addActivityLog(
        family!.id,
        status === 'approved' ? 'approve' : 'reject',
        '부모님',
        `${log.child_name}의 기록 ${STATUS_LABEL[status]} (${log.date})`,
      );
    } else {
      updateSheetStatus(log.id, status, comment || undefined);
      localAddActivity({
        family_id: family!.id, timestamp: new Date().toISOString(),
        type: status === 'approved' ? 'approve' : 'reject',
        actor: '부모님',
        description: `${log.child_name}의 기록 ${STATUS_LABEL[status]} (${log.date})`,
      });
    }

    setActing(false);
    setSelected(null);
    setComment('');
    loadData();
  };

  const doDelete = async (log: StudyLog) => {
    if (isDemo || !confirm(`${log.child_name}의 ${log.date} 기록을 삭제할까요?`)) return;
    setActing(true);

    if (isSupabaseConfigured) {
      await deleteStudyLog(log.id);
      await addActivityLog(family!.id, 'delete', '부모님', `${log.child_name}의 기록 삭제 (${log.date})`);
    } else {
      deleteSheet(log.id);
      localAddActivity({
        family_id: family!.id, timestamp: new Date().toISOString(),
        type: 'delete', actor: '부모님',
        description: `${log.child_name}의 기록 삭제 (${log.date})`,
      });
    }

    setActing(false);
    setSelected(null);
    loadData();
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* 목록 패널 */}
      <div className={`w-full lg:w-80 flex-shrink-0 border-r bg-white flex flex-col ${selected ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm px-1">학습 일정 ({filtered.length})</h2>
            {!isDemo && (
              <button onClick={loadData} className="text-xs text-blue-400 hover:text-blue-600">↻</button>
            )}
          </div>
          <select value={filterChild} onChange={e => setFilterChild(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none">
            <option value="all">전체 자녀</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none">
            <option value="all">전체 상태</option>
            <option value="pending">확인 대기</option>
            <option value="approved">잘했어요</option>
            <option value="rejected">다시 써봐요</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? <div className="flex justify-center py-8">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-blue-300 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            : filtered.length === 0
              ? <div className="p-8 text-center text-gray-400 text-sm">기록이 없어요</div>
              : filtered.map(log => (
                <button key={log.id} onClick={() => { setSelected(log); setComment(log.parent_comment ?? ''); }}
                  className={`w-full p-3 border-b text-left hover:bg-gray-50 transition ${selected?.id === log.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xl mt-0.5">{log.child_avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-medium text-gray-800 text-sm">{log.child_name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[log.status]}`}>
                          {STATUS_LABEL[log.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{log.date}</p>
                      <p className="text-xs text-gray-600 truncate mt-0.5">{log.goal || '(목표 없음)'}</p>
                    </div>
                  </div>
                </button>
              ))
          }
        </div>
      </div>

      {/* 상세 패널 */}
      <div className={`flex-1 overflow-y-auto ${selected ? 'block' : 'hidden lg:block'}`}>
        {!selected
          ? <div className="h-full flex items-center justify-center text-gray-300 flex-col gap-2">
              <p className="text-4xl">📋</p>
              <p className="text-sm">왼쪽에서 기록을 선택하세요</p>
            </div>
          : (
            <div className="p-4 lg:p-6 max-w-2xl">
              <button onClick={() => setSelected(null)} className="lg:hidden text-gray-400 mb-4">← 목록으로</button>

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selected.child_avatar}</span>
                  <div>
                    <p className="font-bold text-gray-800 text-lg">{selected.child_name}</p>
                    <p className="text-gray-400 text-sm">{selected.date} · {selected.child_name.slice(0,2)}의 기록</p>
                  </div>
                </div>
                {!isDemo && (
                  <button onClick={() => doDelete(selected)} disabled={acting}
                    className="text-red-400 hover:text-red-600 border border-red-200 rounded-lg p-2 hover:bg-red-50 transition disabled:opacity-50" title="삭제">
                    🗑️
                  </button>
                )}
              </div>

              <span className={`inline-flex text-sm px-3 py-1 rounded-full border font-medium mb-4 ${STATUS_COLOR[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>

              <div className="bg-blue-50 rounded-2xl p-4 mb-4">
                <p className="text-xs text-blue-500 font-medium mb-1">🎯 오늘의 목표</p>
                <p className="text-gray-800 font-medium">{selected.goal || '(목표 없음)'}</p>
                {selected.total_minutes > 0 && (
                  <p className="text-xs text-gray-500 mt-1">⏱ 총 {Math.floor(selected.total_minutes/60)}시간 {selected.total_minutes%60}분</p>
                )}
              </div>

              {selected.image_url && (
                <img src={selected.image_url} alt="계획표" className="w-full rounded-2xl shadow mb-4 max-h-64 object-contain bg-gray-100" />
              )}

              {selected.items.length > 0 && (
                <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
                  <p className="text-sm font-bold text-gray-700 mb-3">📚 공부 항목</p>
                  <div className="space-y-2.5">
                    {selected.items.map(item => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className={`text-lg flex-shrink-0 ${item.completed ? '' : 'opacity-30'}`}>
                          {item.completed ? '✅' : '⬜'}
                        </span>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SUBJECT_COLORS[item.subject] ?? 'bg-gray-100 text-gray-600'}`}>
                              {item.subject}
                            </span>
                            <span className="text-sm text-gray-800">{item.task_text}</span>
                          </div>
                          {item.quantity_raw && (
                            <p className="text-xs text-gray-400 mt-0.5 ml-0.5">{item.quantity_raw}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.status === 'pending' && !isDemo && (
                <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
                  <p className="text-sm font-bold text-gray-700 mb-2">💬 부모님 응원 메시지</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {STICKERS.map(s => (
                      <button key={s} onClick={() => setComment(c => c + s)}
                        className="text-xl hover:scale-125 active:scale-95 transition-transform">{s}</button>
                    ))}
                  </div>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="아이에게 한 마디 남겨주세요 (선택)" rows={2}
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => doAction(selected, 'approved')} disabled={acting}
                      className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50">
                      {acting ? '처리 중...' : '⭐ 잘했어요!'}
                    </button>
                    <button onClick={() => doAction(selected, 'rejected')} disabled={acting}
                      className="flex-1 bg-orange-400 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition disabled:opacity-50">
                      {acting ? '...' : '✏️ 다시 써봐요'}
                    </button>
                  </div>
                </div>
              )}

              {selected.parent_comment && selected.status !== 'pending' && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
                  <p className="text-xs text-yellow-600 font-medium mb-1">💬 남긴 메시지</p>
                  <p className="text-gray-800 text-sm">{selected.parent_comment}</p>
                </div>
              )}
            </div>
          )
        }
      </div>
    </div>
  );
}
