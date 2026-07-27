import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_CHILDREN, MOCK_TEXTBOOKS } from '../../data/mockData';
import {
  getChildren as localGetChildren,
  saveChild as localSaveChild,
  deleteChild as localDeleteChild,
  getTextbooks as localGetTextbooks,
  saveTextbook as localSaveTextbook,
  deleteTextbook as localDeleteTextbook,
  getTextbookProgress as localGetTextbookProgress,
} from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  getChildren, createChild, updateChild, deleteChild,
  getTextbooksByChild, createTextbook, deleteTextbook, getTextbookProgress,
} from '../../lib/db';
import type { Child, Textbook } from '../../types';

const AVATARS = ['🐶','🦊','🐱','🐻','🐼','🐨','🦁','🐯','🐸','🐙','🦄','🐧'];
const GRADES  = ['유아','초1','초2','초3','초4','초5','초6','중1','중2','중3'];

export default function Children() {
  const { family, isDemo } = useAuth();
  const [children, setChildren]         = useState<Child[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [showAddTb, setShowAddTb]       = useState<string | null>(null);
  const [books, setBooks]               = useState<Record<string, Textbook[]>>({});
  const [progress, setProgress]         = useState<Record<string, number>>({});
  const [form, setForm]                 = useState({ name: '', grade: '초5', pin: '', avatar: '🐶' });
  const [tbForm, setTbForm]             = useState({ subject: '', name: '', total_pages: 0 });
  const [settleChild, setSettleChild]   = useState<Child | null>(null);
  const [settleAmount, setSettleAmount] = useState(500);
  const [settling, setSettling]         = useState(false);
  const [settleError, setSettleError]   = useState('');

  const loadChildren = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setChildren(MOCK_CHILDREN);
    } else if (family?.id && isSupabaseConfigured) {
      setChildren(await getChildren(family.id));
    } else if (family?.id) {
      setChildren(localGetChildren(family.id));
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  const loadBooksForChild = useCallback(async (childId: string) => {
    if (isDemo) {
      setBooks(b => ({ ...b, [childId]: MOCK_TEXTBOOKS.filter(t => t.child_id === childId) }));
      return;
    }
    if (isSupabaseConfigured) {
      const tbs = await getTextbooksByChild(childId);
      setBooks(b => ({ ...b, [childId]: tbs }));
      const entries = await Promise.all(
        tbs.map(async tb => [tb.id, await getTextbookProgress(tb.id, childId)] as [string, number]),
      );
      setProgress(p => ({ ...p, ...Object.fromEntries(entries) }));
    } else {
      setBooks(b => ({ ...b, [childId]: localGetTextbooks(childId) }));
    }
  }, [isDemo]);

  const handleExpand = async (childId: string) => {
    if (expandedChild === childId) { setExpandedChild(null); return; }
    setExpandedChild(childId);
    if (!books[childId]) await loadBooksForChild(childId);
  };

  const openAdd  = () => { setForm({ name:'', grade:'초5', pin:'', avatar:'🐶' }); setEditingChild(null); setShowAddChild(true); };
  const openEdit = (c: Child) => { setForm({ name: c.name, grade: c.grade, pin: c.pin, avatar: c.avatar }); setEditingChild(c); setShowAddChild(true); };

  const handleSaveChild = async () => {
    if (!form.name || form.pin.length !== 4 || isDemo) return;
    setSaving(true);
    if (isSupabaseConfigured && family?.id) {
      if (editingChild) {
        await updateChild(editingChild.id, { name: form.name, grade: form.grade, pin: form.pin, avatar: form.avatar });
      } else {
        await createChild(family.id, { name: form.name, grade: form.grade, pin: form.pin, avatar: form.avatar });
      }
    } else if (family?.id) {
      const child: Child = {
        id: editingChild?.id ?? `child-${Date.now()}`,
        family_id: family.id,
        name: form.name, grade: form.grade, pin: form.pin, avatar: form.avatar,
        active: true, coins: editingChild?.coins ?? 0, created_at: editingChild?.created_at ?? new Date().toISOString(),
      };
      localSaveChild(child);
    }
    setShowAddChild(false);
    setSaving(false);
    loadChildren();
  };

  const handleDelete = async (id: string) => {
    if (isDemo || !confirm('정말 삭제할까요?')) return;
    if (isSupabaseConfigured) {
      await deleteChild(id);
    } else {
      localDeleteChild(id);
    }
    loadChildren();
  };

  const handleSaveTb = async (childId: string) => {
    if (!tbForm.name || !tbForm.subject || tbForm.total_pages <= 0 || isDemo) return;
    setSaving(true);
    if (isSupabaseConfigured && family?.id) {
      await createTextbook({ child_id: childId, family_id: family.id, subject: tbForm.subject, name: tbForm.name, total_pages: tbForm.total_pages });
    } else if (family?.id) {
      const tb: Textbook = {
        id: `tb-${Date.now()}`, child_id: childId, family_id: family.id,
        subject: tbForm.subject, name: tbForm.name, total_pages: tbForm.total_pages,
        created_at: new Date().toISOString(),
      };
      localSaveTextbook(tb);
    }
    setShowAddTb(null);
    setTbForm({ subject:'', name:'', total_pages:0 });
    setSaving(false);
    setBooks(b => ({ ...b, [childId]: [] }));
    await loadBooksForChild(childId);
  };

  const handleDeleteTb = async (tbId: string, childId: string) => {
    if (isSupabaseConfigured) {
      await deleteTextbook(tbId);
    } else {
      localDeleteTextbook(tbId);
    }
    await loadBooksForChild(childId);
  };

  const handleSettle = async () => {
    if (!settleChild || settleAmount <= 0 || isDemo) return;
    setSettling(true); setSettleError('');
    try {
      const res = await fetch('/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'settle',
          childId: settleChild.id,
          familyId: family?.id,
          amount: settleAmount,
          note: `${settleAmount}코인 정산`,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSettleError(data.error ?? '정산 실패'); }
      else {
        setSettleChild(null);
        await loadChildren();
      }
    } catch { setSettleError('네트워크 오류'); }
    setSettling(false);
  };

  const getChildBooks = (childId: string): Textbook[] => {
    if (isDemo) return MOCK_TEXTBOOKS.filter(t => t.child_id === childId);
    return books[childId] ?? [];
  };

  const getProgressValue = (tbId: string, childId: string): number => {
    if (isDemo) {
      if (tbId === 'tb-001') return 120;
      if (tbId === 'tb-002') return 36;
      return 48;
    }
    if (isSupabaseConfigured) return progress[tbId] ?? 0;
    return localGetTextbookProgress(tbId, childId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-300 dark:bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">자녀 관리</h1>
          <p className="text-gray-400 dark:text-slate-500 text-sm">자녀 정보와 교재를 관리해요</p>
        </div>
        {!isDemo && (
          <button onClick={openAdd}
            className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition shadow-sm">
            + 자녀 추가
          </button>
        )}
      </div>

      {isDemo && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl px-4 py-3 text-yellow-700 dark:text-yellow-300 text-sm">
          ✏️ 데모 모드에서는 자녀/교재를 추가·삭제할 수 없어요
        </div>
      )}

      {children.length === 0 && !isDemo && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-10 text-center shadow-sm transition-colors duration-300">
          <p className="text-4xl mb-2">👶</p>
          <p className="text-gray-400 dark:text-slate-500">자녀를 추가해주세요</p>
          <button onClick={openAdd}
            className="mt-4 bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition">
            + 첫 자녀 추가
          </button>
        </div>
      )}

      {children.map(child => {
        const childBooks = getChildBooks(child.id);
        const isExpanded = expandedChild === child.id;
        return (
          <div key={child.id} className="bg-white dark:bg-slate-800 rounded-[28px] shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
            {/* 자녀 헤더 */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                {child.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 dark:text-white">{child.name}</p>
                <p className="text-gray-400 dark:text-slate-500 text-sm">{child.grade} · PIN: {'●'.repeat(child.pin.length)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm">🪙</span>
                  <span className="text-sm font-extrabold text-amber-500 dark:text-amber-400">{child.coins ?? 0}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">코인</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!isDemo && (
                  <>
                    <button
                      onClick={() => { setSettleChild(child); setSettleAmount(500); setSettleError(''); }}
                      className="text-xs text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition font-bold">
                      🪙 정산
                    </button>
                    <button onClick={() => openEdit(child)}
                      className="text-xs text-gray-400 dark:text-slate-400 border dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                      수정
                    </button>
                    <button onClick={() => handleDelete(child.id)}
                      className="text-xs text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                      삭제
                    </button>
                  </>
                )}
                <button onClick={() => handleExpand(child.id)}
                  className="text-xs text-blue-500 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                  교재 {isExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* 교재 목록 */}
            {isExpanded && (
              <div className="border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 rounded-b-2xl p-4 space-y-3 transition-colors duration-300">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-600 dark:text-slate-300">📚 교재 진도 관리</p>
                  {!isDemo && (
                    <button
                      onClick={() => { setShowAddTb(child.id); setTbForm({ subject:'', name:'', total_pages:0 }); }}
                      className="text-xs text-blue-500 dark:text-blue-400 font-medium hover:underline">
                      + 교재 추가
                    </button>
                  )}
                </div>

                {childBooks.length === 0 && (
                  <p className="text-gray-400 dark:text-slate-500 text-xs text-center py-3">등록된 교재가 없어요</p>
                )}

                {childBooks.map(tb => {
                  const reached = getProgressValue(tb.id, child.id);
                  const pct = Math.min(100, Math.round((reached / tb.total_pages) * 100));
                  return (
                    <div key={tb.id} className="bg-white dark:bg-slate-700 rounded-xl p-3 border border-gray-100 dark:border-slate-600 transition-colors duration-300">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            {tb.subject}
                          </span>
                          <p className="font-medium text-gray-800 dark:text-white text-sm mt-1">{tb.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 dark:text-slate-400">{reached} / {tb.total_pages}p</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{pct}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-600 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-400 to-teal-400 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }} />
                      </div>
                      {!isDemo && (
                        <button onClick={() => handleDeleteTb(tb.id, child.id)}
                          className="mt-2 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition">
                          삭제
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 교재 추가 폼 */}
                {showAddTb === child.id && !isDemo && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 space-y-2 border border-blue-100 dark:border-blue-800 animate-fade-in">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">교재 추가</p>
                    <input placeholder="과목 (예: 수학)" value={tbForm.subject}
                      onChange={e => setTbForm(f => ({ ...f, subject: e.target.value }))}
                      className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
                    <input placeholder="교재명 (예: 수학의 정석 기초편)" value={tbForm.name}
                      onChange={e => setTbForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
                    <input type="number" placeholder="총 페이지 수" value={tbForm.total_pages || ''}
                      onChange={e => setTbForm(f => ({ ...f, total_pages: Number(e.target.value) }))}
                      className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveTb(child.id)} disabled={saving}
                        className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-600 transition disabled:opacity-50">
                        {saving ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => setShowAddTb(null)}
                        className="px-4 border dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 자녀 추가/수정 모달 */}
      {showAddChild && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in border dark:border-slate-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
              {editingChild ? '자녀 수정' : '자녀 추가'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">아바타</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {AVATARS.map(a => (
                    <button key={a} onClick={() => setForm(f => ({ ...f, avatar: a }))}
                      className={`text-2xl p-1.5 rounded-xl transition ${
                        form.avatar === a
                          ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <input placeholder="이름" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
              <select value={form.grade}
                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                className="w-full border dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white transition-colors">
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
              <input placeholder="PIN (4자리 숫자)" value={form.pin}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0,4); setForm(f => ({ ...f, pin: v })); }}
                className="w-full border dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                maxLength={4} />
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveChild} disabled={saving}
                  className="flex-1 bg-blue-500 text-white py-2.5 rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setShowAddChild(false)}
                  className="px-5 border dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 코인 정산 모달 */}
      {settleChild && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xs p-6 border dark:border-slate-700">
            <div className="text-center mb-5">
              <span className="text-5xl">🪙</span>
              <h3 className="font-extrabold text-gray-800 dark:text-white mt-2">코인 정산</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {settleChild.avatar} {settleChild.name} · 현재{' '}
                <span className="font-bold text-amber-500">{settleChild.coins ?? 0}코인</span>
              </p>
            </div>

            {/* 빠른 선택 */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[100, 300, 500].map(v => (
                <button key={v} onClick={() => setSettleAmount(v)}
                  className={`py-2 rounded-xl text-sm font-bold transition ${
                    settleAmount === v
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700'
                  }`}>
                  {v}
                </button>
              ))}
            </div>

            <input
              type="number" min={1} max={settleChild.coins ?? 0}
              value={settleAmount}
              onChange={e => setSettleAmount(Number(e.target.value))}
              className="w-full border dark:border-slate-600 rounded-xl px-4 py-2.5 text-center text-lg font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-700 text-gray-800 dark:text-white transition-colors"
              placeholder="코인 수"
            />

            {settleError && <p className="text-red-500 text-sm text-center mb-3">{settleError}</p>}

            <div className="flex gap-2">
              <button onClick={handleSettle} disabled={settling || settleAmount <= 0 || settleAmount > (settleChild.coins ?? 0)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white py-3 rounded-xl font-extrabold transition">
                {settling ? '정산 중...' : `${settleAmount}코인 차감`}
              </button>
              <button onClick={() => setSettleChild(null)}
                className="px-5 border dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                취소
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-3">
              정산 후 잔액: {Math.max(0, (settleChild.coins ?? 0) - settleAmount)}코인
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
