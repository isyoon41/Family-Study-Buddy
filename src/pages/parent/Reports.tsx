import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren } from '../../lib/db';
import type { StudyLog, Child } from '../../types';

const SUBJECT_COLORS: Record<string, string> = {
  수학: '#3b82f6', 국어: '#10b981', 영어: '#8b5cf6',
  과학: '#f59e0b', 사회: '#f97316',
};

function BarChart({ data }: { data: { label: string; value: number; max: number; color: string }[] }) {
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <p className="text-xs text-gray-500 w-12 text-right flex-shrink-0">{d.label}</p>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div className="h-4 rounded-full transition-all duration-500"
              style={{ width: `${d.max ? (d.value / d.max) * 100 : 0}%`, backgroundColor: d.color }} />
          </div>
          <p className="text-xs font-bold text-gray-700 w-12 flex-shrink-0">{d.value}분</p>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const { family, isDemo } = useAuth();
  const [filterChild, setFilterChild] = useState('all');
  const [allLogs, setAllLogs]         = useState<StudyLog[]>([]);
  const [children, setChildren]       = useState<Child[]>([]);
  const [loading, setLoading]         = useState(true);

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

  const approved = allLogs.filter(l => l.status === 'approved' &&
    (filterChild === 'all' || l.child_id === filterChild));

  // 과목별 시간
  const subjectMap: Record<string, number> = {};
  for (const log of approved) {
    for (const item of log.items) {
      if (!item.subject) continue;
      subjectMap[item.subject] = (subjectMap[item.subject] ?? 0) + Math.floor(log.total_minutes / Math.max(1, log.items.length));
    }
  }
  const maxSubj = Math.max(1, ...Object.values(subjectMap));
  const subjectData = Object.entries(subjectMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, max: maxSubj, color: SUBJECT_COLORS[label] ?? '#6b7280' }));

  // 자녀별 통계
  const childStats = children.map(c => {
    const logs = approved.filter(l => l.child_id === c.id);
    const total_min  = logs.reduce((s, l) => s + l.total_minutes, 0);
    const items_done  = logs.reduce((s, l) => s + l.items.filter(i => i.completed).length, 0);
    const items_total = logs.reduce((s, l) => s + l.items.length, 0);
    return { child: c, logs: logs.length, total_min, items_done, items_total };
  });

  const exportCSV = () => {
    const rows = [
      ['날짜', '자녀', '목표', '과목', '내용', '분량', '완료', '공부시간(분)', '상태'],
      ...allLogs
        .filter(l => filterChild === 'all' || l.child_id === filterChild)
        .flatMap(log =>
          log.items.length > 0
            ? log.items.map(item => [
                log.date, log.child_name, log.goal,
                item.subject, item.task_text, item.quantity_raw,
                item.completed ? '완료' : '미완료', log.total_minutes, log.status,
              ])
            : [[log.date, log.child_name, log.goal, '', '', '', '', log.total_minutes, log.status]],
        ),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `공부기록_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

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
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">리포트</h1>
          <p className="text-gray-400 text-sm">공부 현황을 한눈에 확인해요</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-600 transition shadow">
          📥 CSV 내보내기
        </button>
      </div>

      <div className="flex gap-2">
        <select value={filterChild} onChange={e => setFilterChild(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none">
          <option value="all">전체 자녀</option>
          {children.map(c => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '✅', label: '승인된 기록', value: approved.length },
          { icon: '⏱', label: '총 공부 시간(h)', value: Math.floor(approved.reduce((s,l) => s+l.total_minutes,0)/60) },
          { icon: '📚', label: '완료 항목', value: approved.reduce((s,l) => s+l.items.filter(i=>i.completed).length,0) },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl mb-1">{c.icon}</p>
            <p className="text-2xl font-bold text-gray-800">{c.value}</p>
            <p className="text-xs text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-4">📊 과목별 공부 시간</h2>
        {subjectData.length === 0
          ? <p className="text-gray-400 text-sm text-center py-4">데이터가 없어요</p>
          : <BarChart data={subjectData} />
        }
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-4">👨‍👩‍👧 자녀별 현황</h2>
        <div className="space-y-4">
          {childStats.map(({ child, logs, total_min, items_done, items_total }) => {
            const rate = items_total > 0 ? Math.round((items_done / items_total) * 100) : 0;
            return (
              <div key={child.id} className="flex items-center gap-4 p-3 border rounded-xl">
                <span className="text-3xl">{child.avatar}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-gray-800 text-sm">
                      {child.name} <span className="text-gray-400 font-normal text-xs">{child.grade}</span>
                    </p>
                    <p className="text-xs text-gray-400">{logs}개 기록 · {Math.floor(total_min/60)}h {total_min%60}m</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-400 to-teal-400 h-2 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <p className="text-xs font-bold text-blue-600 w-10 text-right">{rate}%</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">완료 {items_done} / 전체 {items_total} 항목</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
