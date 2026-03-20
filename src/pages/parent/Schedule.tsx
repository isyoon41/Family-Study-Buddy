import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren, updateSheetStatus, deleteSheet, updateSheetContent, addActivityLog as localAddActivity } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren, updateLogStatus, deleteStudyLog, updateStudyLogContent, addActivityLog } from '../../lib/db';
import type { StudyLog, Child, StudyItem } from '../../types';

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
const SUBJECTS = ['수학', '국어', '영어', '과학', '사회', '기타'];

interface EditData {
  date: string;
  goal: string;
  total_minutes: number;
  items: StudyItem[];
}

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
  const [editMode, setEditMode]         = useState(false);
  const [editData, setEditData]         = useState<EditData | null>(null);

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

  const startEdit = (log: StudyLog) => {
    setEditData({
      date: log.date,
      goal: log.goal,
      total_minutes: log.total_minutes,
      items: log.items.map(i => ({ ...i })),
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData(null);
  };

  const doSaveEdit = async () => {
    if (!selected || !editData || isDemo) return;
    setActing(true);

    if (isSupabaseConfigured) {
      await updateStudyLogContent(selected.id, editData);
      await addActivityLog(
        family!.id, 'approve', '부모님',
        `${selected.child_name}의 기록 내용 수정 (${editData.date})`,
      );
    } else {
      updateSheetContent(selected.id, editData);
      localAddActivity({
        family_id: family!.id, timestamp: new Date().toISOString(),
        type: 'approve', actor: '부모님',
        description: `${selected.child_name}의 기록 내용 수정 (${editData.date})`,
      });
    }

    // selected를 즉시 업데이트해서 화면에 바로 반영
    setSelected({ ...selected, ...editData });
    setActing(false);
    setEditMode(false);
    setEditData(null);
    loadData();
  };

  const updateEditItem = (idx: number, field: keyof StudyItem, value: string | boolean) => {
    if (!editData) return;
    const items = editData.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setEditData({ ...editData, items });
  };

  const addEditItem = () => {
    if (!editData) return;
    const newItem: StudyItem = {
      id: `new-${Date.now()}`,
      subject: '수학',
      task_text: '',
      quantity_raw: '',
      completed: false,
    };
    setEditData({ ...editData, items: [...editData.items, newItem] });
  };

  const removeEditItem = (idx: number) => {
    if (!editData) return;
    setEditData({ ...editData, items: editData.items.filter((_, i) => i !== idx) });
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
                <button key={log.id} onClick={() => { setSelected(log); setComment(log.parent_comment ?? ''); cancelEdit(); }}
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
              <button onClick={() => { setSelected(null); cancelEdit(); }} className="lg:hidden text-gray-400 mb-4">← 목록으로</button>

              {/* 헤더 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selected.child_avatar}</span>
                  <div>
                    <p className="font-bold text-gray-800 text-lg">{selected.child_name}</p>
                    <p className="text-gray-400 text-sm">{selected.date} · {selected.child_name.slice(0,2)}의 기록</p>
                  </div>
                </div>
                {!isDemo && (
                  <div className="flex gap-2">
                    {!editMode && (
                      <button onClick={() => startEdit(selected)} disabled={acting}
                        className="text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition text-sm font-medium disabled:opacity-50">
                        ✏️ 편집
                      </button>
                    )}
                    <button onClick={() => doDelete(selected)} disabled={acting || editMode}
                      className="text-red-400 hover:text-red-600 border border-red-200 rounded-lg p-2 hover:bg-red-50 transition disabled:opacity-50" title="삭제">
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              <span className={`inline-flex text-sm px-3 py-1 rounded-full border font-medium mb-4 ${STATUS_COLOR[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>

              {/* ── 편집 모드 ── */}
              {editMode && editData ? (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                    <p className="text-xs text-orange-600 font-bold mb-3">✏️ 편집 모드 — 내용을 수정하고 저장하세요</p>

                    {/* 날짜 */}
                    <label className="block mb-3">
                      <span className="text-xs text-gray-500 font-medium">📅 날짜</span>
                      <input type="date" value={editData.date}
                        onChange={e => setEditData({ ...editData, date: e.target.value })}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    </label>

                    {/* 목표 */}
                    <label className="block mb-3">
                      <span className="text-xs text-gray-500 font-medium">🎯 오늘의 목표</span>
                      <input type="text" value={editData.goal}
                        onChange={e => setEditData({ ...editData, goal: e.target.value })}
                        placeholder="목표를 입력하세요"
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    </label>

                    {/* 총 시간 */}
                    <label className="block mb-4">
                      <span className="text-xs text-gray-500 font-medium">⏱ 총 공부 시간 (분)</span>
                      <input type="number" min={0} value={editData.total_minutes}
                        onChange={e => setEditData({ ...editData, total_minutes: Number(e.target.value) })}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    </label>

                    {/* 공부 항목 */}
                    <p className="text-xs text-gray-500 font-medium mb-2">📚 공부 항목</p>
                    <div className="space-y-3 mb-3">
                      {editData.items.map((item, idx) => (
                        <div key={item.id} className="bg-white rounded-xl border p-3 space-y-2">
                          <div className="flex gap-2 items-center">
                            <select value={item.subject}
                              onChange={e => updateEditItem(idx, 'subject', e.target.value)}
                              className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300">
                              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer ml-auto">
                              <input type="checkbox" checked={item.completed}
                                onChange={e => updateEditItem(idx, 'completed', e.target.checked)}
                                className="rounded" />
                              완료
                            </label>
                            <button onClick={() => removeEditItem(idx)}
                              className="text-red-400 hover:text-red-600 text-xs px-1.5 py-0.5 rounded hover:bg-red-50">
                              ✕
                            </button>
                          </div>
                          <input type="text" value={item.task_text}
                            onChange={e => updateEditItem(idx, 'task_text', e.target.value)}
                            placeholder="할 일 내용 (예: 수학의 정석 5단원)"
                            className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300" />
                          <input type="text" value={item.quantity_raw}
                            onChange={e => updateEditItem(idx, 'quantity_raw', e.target.value)}
                            placeholder="분량 (예: p.12~15, 10문제)"
                            className="w-full border rounded-lg px-2 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-300" />
                        </div>
                      ))}
                    </div>

                    <button onClick={addEditItem}
                      className="w-full border-2 border-dashed border-orange-300 text-orange-500 rounded-xl py-2 text-sm hover:bg-orange-50 transition">
                      + 항목 추가
                    </button>
                  </div>

                  {/* 저장 / 취소 */}
                  <div className="flex gap-2">
                    <button onClick={doSaveEdit} disabled={acting}
                      className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50">
                      {acting ? '저장 중...' : '💾 수정 저장'}
                    </button>
                    <button onClick={cancelEdit} disabled={acting}
                      className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition disabled:opacity-50">
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 보기 모드 ── */
                <>
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
                </>
              )}
            </div>
          )
        }
      </div>
    </div>
  );
}
