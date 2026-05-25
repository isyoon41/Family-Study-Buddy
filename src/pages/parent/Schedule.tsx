import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren, updateSheetStatus, deleteSheet, updateSheetContent, addActivityLog as localAddActivity } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren, updateLogStatus, deleteStudyLog, updateStudyLogContent, addActivityLog } from '../../lib/db';
import type { StudyLog, Child, StudyItem } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  approved: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  rejected: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  draft:    'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '확인 대기', approved: '잘했어요! ⭐', rejected: '다시 써봐요 ✏️', draft: '작성 중',
};
const STICKERS = ['⭐','🔥','💪','🎉','👍','🌟','❤️','🥳'];
const SUBJECT_COLORS: Record<string, string> = {
  수학: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  국어: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
  영어: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
  과학: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300',
  사회: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
  한자: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  중국어: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  '성경 말씀(큐티)': 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
  독서: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  '전과목 학습지': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
};
const SUBJECTS = ['수학', '국어', '영어', '과학', '사회', '한자', '중국어', '성경 말씀(큐티)', '독서', '전과목 학습지', '기타'];
const STATUS_TABS = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '⏳ 대기' },
  { value: 'approved', label: '✅ 승인' },
  { value: 'rejected', label: '✏️ 반려' },
];

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
  const [lightboxImg, setLightboxImg]   = useState<string | null>(null);

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

  const pendingCount = allLogs.filter(l => l.status === 'pending').length;

  return (
    <>
      {/* 이미지 라이트박스 */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxImg(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-light transition z-10"
            onClick={() => setLightboxImg(null)}
          >
            ✕
          </button>
          <img
            src={lightboxImg}
            alt="계획표 확대"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* 목록 패널 */}
        <div className={`w-full lg:w-80 flex-shrink-0 border-r dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col transition-colors duration-300 ${selected ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 border-b dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-800 dark:text-white text-sm px-1">학습 일정</h2>
                {pendingCount > 0 && (
                  <span className="bg-yellow-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </div>
              {!isDemo && (
                <button onClick={loadData} className="text-xs text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition">↻ 새로고침</button>
              )}
            </div>

            {/* 자녀 필터 */}
            <select value={filterChild} onChange={e => setFilterChild(e.target.value)}
              className="w-full border dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors duration-300">
              <option value="all">👨‍👩‍👧 전체 자녀</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
            </select>

            {/* 상태 탭 필터 */}
            <div className="flex gap-1">
              {STATUS_TABS.map(tab => (
                <button key={tab.value} onClick={() => setFilterStatus(tab.value)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition
                    ${filterStatus === tab.value
                      ? 'bg-blue-500 text-white shadow'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-400 dark:text-slate-500 text-right">{filtered.length}건</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading
              ? <div className="flex justify-center py-8">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-blue-300 dark:bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              : filtered.length === 0
                ? <div className="p-8 text-center">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-gray-400 dark:text-slate-500 text-sm">기록이 없어요</p>
                  </div>
                : filtered.map(log => (
                  <button key={log.id}
                    onClick={() => { setSelected(log); setComment(log.parent_comment ?? ''); cancelEdit(); }}
                    className={`w-full p-3 border-b dark:border-slate-700 text-left transition
                      ${selected?.id === log.id
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                      }`}>
                    <div className="flex items-start gap-2">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <span className="text-xl">{log.child_avatar}</span>
                        {log.status === 'pending' && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-white dark:border-slate-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-1">
                          <p className="font-medium text-gray-800 dark:text-white text-sm">{log.child_name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[log.status]}`}>
                            {STATUS_LABEL[log.status]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{log.date}</p>
                        <p className="text-xs text-gray-600 dark:text-slate-400 truncate mt-0.5">{log.goal || '(목표 없음)'}</p>
                      </div>
                    </div>
                  </button>
                ))
            }
          </div>
        </div>

        {/* 상세 패널 */}
        <div className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 transition-colors duration-300 ${selected ? 'block' : 'hidden lg:block'}`}>
          {!selected
            ? <div className="h-full flex items-center justify-center flex-col gap-3">
                <p className="text-5xl opacity-30">📋</p>
                <p className="text-sm text-gray-400 dark:text-slate-600">왼쪽에서 기록을 선택하세요</p>
                {pendingCount > 0 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-full border border-yellow-200 dark:border-yellow-700">
                    ⏳ 확인 대기 {pendingCount}건이 있어요
                  </p>
                )}
              </div>
            : (
              <div className="p-4 lg:p-6 max-w-2xl">
                <button
                  onClick={() => { setSelected(null); cancelEdit(); }}
                  className="lg:hidden text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 mb-4 flex items-center gap-1 transition">
                  ← 목록으로
                </button>

                {/* 헤더 */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-3xl shadow-sm border dark:border-slate-700">
                      {selected.child_avatar}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white text-lg">{selected.child_name}</p>
                      <p className="text-gray-400 dark:text-slate-500 text-sm">{selected.date}</p>
                      <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-full border font-medium mt-1 ${STATUS_COLOR[selected.status]}`}>
                        {STATUS_LABEL[selected.status]}
                      </span>
                    </div>
                  </div>
                  {!isDemo && (
                    <div className="flex gap-2">
                      {!editMode && (
                        <button onClick={() => startEdit(selected)} disabled={acting}
                          className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-sm font-medium disabled:opacity-50">
                          ✏️ 편집
                        </button>
                      )}
                      <button onClick={() => doDelete(selected)} disabled={acting || editMode}
                        className="text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 border border-red-200 dark:border-red-800 rounded-xl p-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                        title="삭제">
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* ── 편집 모드 ── */}
                {editMode && editData ? (
                  <div className="space-y-4">
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-2xl p-4">
                      <p className="text-xs text-orange-600 dark:text-orange-300 font-bold mb-3">✏️ 편집 모드 — 내용을 수정하고 저장하세요</p>

                      <label className="block mb-3">
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">📅 날짜</span>
                        <input type="date" value={editData.date}
                          onChange={e => setEditData({ ...editData, date: e.target.value })}
                          className="mt-1 w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white transition-colors" />
                      </label>

                      <label className="block mb-3">
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">🎯 오늘의 목표</span>
                        <input type="text" value={editData.goal}
                          onChange={e => setEditData({ ...editData, goal: e.target.value })}
                          placeholder="목표를 입력하세요"
                          className="mt-1 w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
                      </label>

                      <label className="block mb-4">
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">⏱ 총 공부 시간 (분)</span>
                        <input type="number" min={0} value={editData.total_minutes}
                          onChange={e => setEditData({ ...editData, total_minutes: Number(e.target.value) })}
                          className="mt-1 w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white transition-colors" />
                      </label>

                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-2">📚 공부 항목</p>
                      <div className="space-y-3 mb-3">
                        {editData.items.map((item, idx) => (
                          <div key={item.id} className="bg-white dark:bg-slate-700 rounded-xl border dark:border-slate-600 p-3 space-y-2">
                            <div className="flex gap-2 items-center">
                              <select value={item.subject}
                                onChange={e => updateEditItem(idx, 'subject', e.target.value)}
                                className="border dark:border-slate-500 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white dark:bg-slate-600 text-gray-700 dark:text-slate-200">
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 cursor-pointer ml-auto">
                                <input type="checkbox" checked={item.completed}
                                  onChange={e => updateEditItem(idx, 'completed', e.target.checked)}
                                  className="rounded" />
                                완료
                              </label>
                              <button onClick={() => removeEditItem(idx)}
                                className="text-red-400 hover:text-red-600 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                                ✕
                              </button>
                            </div>
                            <input type="text" value={item.task_text}
                              onChange={e => updateEditItem(idx, 'task_text', e.target.value)}
                              placeholder="할 일 내용 (예: 수학의 정석 5단원)"
                              className="w-full border dark:border-slate-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white dark:bg-slate-600 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500" />
                            <input type="text" value={item.quantity_raw}
                              onChange={e => updateEditItem(idx, 'quantity_raw', e.target.value)}
                              placeholder="분량 (예: p.12~15, 10문제)"
                              className="w-full border dark:border-slate-500 rounded-lg px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white dark:bg-slate-600 placeholder-gray-400 dark:placeholder-slate-500" />
                          </div>
                        ))}
                      </div>

                      <button onClick={addEditItem}
                        className="w-full border-2 border-dashed border-orange-300 dark:border-orange-600 text-orange-500 dark:text-orange-400 rounded-xl py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition">
                        + 항목 추가
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={doSaveEdit} disabled={acting}
                        className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50 shadow-md shadow-orange-200 dark:shadow-orange-900/30">
                        {acting ? '저장 중...' : '💾 수정 저장'}
                      </button>
                      <button onClick={cancelEdit} disabled={acting}
                        className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition disabled:opacity-50">
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── 보기 모드 ── */
                  <>
                    {/* 목표 카드 */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 mb-4">
                      <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mb-1">🎯 오늘의 목표</p>
                      <p className="text-gray-800 dark:text-white font-medium">{selected.goal || '(목표 없음)'}</p>
                      {selected.total_minutes > 0 && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                          ⏱ 총 <span className="font-bold text-blue-500 dark:text-blue-400">{Math.floor(selected.total_minutes/60)}시간 {selected.total_minutes%60}분</span> 공부
                        </p>
                      )}
                    </div>

                    {/* 계획표 이미지 */}
                    {selected.image_url && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2 flex items-center gap-1">
                          🖼 계획표 사진
                          <span className="text-gray-300 dark:text-slate-600">— 클릭하면 크게 볼 수 있어요</span>
                        </p>
                        <button
                          onClick={() => setLightboxImg(selected.image_url!)}
                          className="w-full rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border dark:border-slate-700 group"
                        >
                          <img
                            src={selected.image_url}
                            alt="계획표"
                            className="w-full max-h-64 object-contain bg-gray-100 dark:bg-slate-700 group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        </button>
                      </div>
                    )}

                    {/* 공부 항목 */}
                    {selected.items.length > 0 && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm p-4 mb-4 transition-colors duration-300">
                        <p className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-3">📚 공부 항목</p>
                        <div className="space-y-2.5">
                          {selected.items.map(item => (
                            <div key={item.id} className="flex items-start gap-2">
                              <span className={`text-lg flex-shrink-0 ${item.completed ? '' : 'opacity-30'}`}>
                                {item.completed ? '✅' : '⬜'}
                              </span>
                              <div className="flex-1">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SUBJECT_COLORS[item.subject] ?? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {item.subject}
                                  </span>
                                  <span className="text-sm text-gray-800 dark:text-slate-200">{item.task_text}</span>
                                </div>
                                {item.quantity_raw && (
                                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-0.5">{item.quantity_raw}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* 완료율 바 */}
                        {selected.items.length > 0 && (() => {
                          const done = selected.items.filter(i => i.completed).length;
                          const rate = Math.round((done / selected.items.length) * 100);
                          return (
                            <div className="mt-3 pt-3 border-t dark:border-slate-700">
                              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mb-1">
                                <span>완료율</span>
                                <span className="font-bold" style={{ color: rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b' }}>
                                  {done}/{selected.items.length} ({rate}%)
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-2 rounded-full transition-all duration-700"
                                  style={{
                                    width: `${rate}%`,
                                    backgroundColor: rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* 승인/반려 영역 */}
                    {selected.status === 'pending' && !isDemo && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm p-4 mb-4 transition-colors duration-300">
                        <p className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-3">💬 응원 메시지 남기기</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {STICKERS.map(s => (
                            <button key={s} onClick={() => setComment(c => c + s)}
                              className="text-2xl hover:scale-125 active:scale-95 transition-transform">
                              {s}
                            </button>
                          ))}
                        </div>
                        <textarea value={comment} onChange={e => setComment(e.target.value)}
                          placeholder="아이에게 한 마디 남겨주세요 (선택)" rows={2}
                          className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() => doAction(selected, 'approved')}
                            disabled={acting}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white py-3.5 rounded-2xl font-bold text-base hover:from-green-500 hover:to-emerald-600 transition shadow-lg shadow-green-200 dark:shadow-green-900/40 active:scale-95 disabled:opacity-50"
                          >
                            {acting ? '처리 중...' : <><span className="text-lg">⭐</span> 잘했어요!</>}
                          </button>
                          <button
                            onClick={() => doAction(selected, 'rejected')}
                            disabled={acting}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-400 to-amber-500 text-white py-3.5 rounded-2xl font-bold text-base hover:from-orange-500 hover:to-amber-600 transition shadow-lg shadow-orange-200 dark:shadow-orange-900/40 active:scale-95 disabled:opacity-50"
                          >
                            {acting ? '...' : <><span className="text-lg">✏️</span> 다시 써봐요</>}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 이미 남긴 메시지 */}
                    {selected.parent_comment && selected.status !== 'pending' && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-700 rounded-2xl p-4">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">💬 남긴 메시지</p>
                        <p className="text-gray-800 dark:text-slate-200 text-sm">{selected.parent_comment}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          }
        </div>
      </div>
    </>
  );
}
