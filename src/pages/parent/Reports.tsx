import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_LOGS, MOCK_CHILDREN } from '../../data/mockData';
import { getSheets, getChildren as localGetChildren } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getStudyLogs, getChildren } from '../../lib/db';
import { calcStreak } from '../../utils/achievements';
import type { StudyLog, Child } from '../../types';

const SUBJECT_COLORS: Record<string, string> = {
  수학: '#3b82f6', 국어: '#10b981', 영어: '#8b5cf6',
  과학: '#f59e0b', 사회: '#f97316',
};
const WEEKDAY_KO  = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_COLOR = [
  'bg-red-400', 'bg-blue-400', 'bg-blue-400', 'bg-blue-400',
  'bg-blue-400', 'bg-blue-400', 'bg-indigo-400',
];

// ── 가로 바 차트 ──────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; max: number; color: string }[] }) {
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 w-12 text-right flex-shrink-0">{d.label}</p>
          <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full transition-all duration-700"
              style={{ width: `${d.max ? (d.value / d.max) * 100 : 0}%`, backgroundColor: d.color }}
            />
          </div>
          <p className="text-xs font-bold text-gray-700 dark:text-slate-300 w-14 flex-shrink-0">{d.value}분</p>
        </div>
      ))}
    </div>
  );
}

// ── 요일별 막대 차트 ──────────────────────────────────────
function WeekdayChart({ data }: { data: number[] }) {
  const maxVal = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((val, i) => {
        const pct = Math.round((val / maxVal) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-xs font-bold text-gray-600 dark:text-slate-300">{val > 0 ? val : ''}</p>
            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: '72px' }}>
              <div
                className={`w-full rounded-t-lg transition-all duration-700 ${WEEKDAY_COLOR[i]}`}
                style={{ height: `${pct}%`, minHeight: val > 0 ? '4px' : '0' }}
              />
            </div>
            <p className={`text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-indigo-400' : 'text-gray-500 dark:text-slate-400'}`}>
              {WEEKDAY_KO[i]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── 원형 진도율 ────────────────────────────────────────────
function RingProgress({ pct, color }: { pct: number; color: string }) {
  const r = 20, circ = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" className="flex-shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="5"
        className="text-gray-100 dark:text-slate-700" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="bold" fill={color}>{pct}%</text>
    </svg>
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
      setAllLogs(MOCK_LOGS); setChildren(MOCK_CHILDREN);
    } else if (family?.id && isSupabaseConfigured) {
      const [logs, kids] = await Promise.all([getStudyLogs(family.id), getChildren(family.id)]);
      setAllLogs(logs); setChildren(kids);
    } else if (family?.id) {
      setAllLogs(getSheets(family.id)); setChildren(localGetChildren(family.id));
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadData(); }, [loadData]);

  const approved = useMemo(() =>
    allLogs.filter(l => l.status === 'approved' && (filterChild === 'all' || l.child_id === filterChild)),
    [allLogs, filterChild],
  );

  // 과목별 공부 시간
  const subjectData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of approved) {
      for (const item of log.items) {
        if (!item.subject) continue;
        map[item.subject] = (map[item.subject] ?? 0) + Math.floor(log.total_minutes / Math.max(1, log.items.length));
      }
    }
    const max = Math.max(1, ...Object.values(map));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
      label, value, max, color: SUBJECT_COLORS[label] ?? '#6b7280',
    }));
  }, [approved]);

  // 요일별 공부 횟수 (승인 기록 기준)
  const weekdayData = useMemo(() => {
    const counts = Array(7).fill(0);
    for (const log of approved) {
      const day = new Date(log.date).getDay();
      counts[day]++;
    }
    return counts;
  }, [approved]);

  // 자녀별 통계 + 스트릭
  const childStats = useMemo(() =>
    children.map(c => {
      const logs = allLogs.filter(l => l.status === 'approved' && l.child_id === c.id);
      const total_min    = logs.reduce((s, l) => s + l.total_minutes, 0);
      const items_done   = logs.reduce((s, l) => s + l.items.filter(i => i.completed).length, 0);
      const items_total  = logs.reduce((s, l) => s + l.items.length, 0);
      const streak       = calcStreak(logs);
      return { child: c, logs: logs.length, total_min, items_done, items_total, streak };
    }),
    [children, allLogs],
  );

  const totalMin = approved.reduce((s, l) => s + l.total_minutes, 0);

  const exportCSV = () => {
    const rows = [
      ['날짜', '자녀', '목표', '과목', '내용', '분량', '완료', '공부시간(분)', '상태'],
      ...allLogs
        .filter(l => filterChild === 'all' || l.child_id === filterChild)
        .flatMap(log =>
          log.items.length > 0
            ? log.items.map(item => [log.date, log.child_name, log.goal, item.subject, item.task_text, item.quantity_raw, item.completed ? '완료' : '미완료', log.total_minutes, log.status])
            : [[log.date, log.child_name, log.goal, '', '', '', '', log.total_minutes, log.status]],
        ),
    ];
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `공부기록_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="flex gap-2">
          {[0,1,2].map(i => <div key={i} className="w-3 h-3 bg-blue-300 dark:bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">리포트</h1>
          <p className="text-gray-400 dark:text-slate-500 text-sm">공부 현황을 한눈에 확인해요</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow">
          📥 CSV
        </button>
      </div>

      {/* 자녀 필터 */}
      <div className="flex gap-2 flex-wrap">
        {[{ id: 'all', avatar: '👨‍👩‍👧', name: '전체' }, ...children.map(c => ({ id: c.id, avatar: c.avatar, name: c.name }))].map(c => (
          <button key={c.id} onClick={() => setFilterChild(c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition
              ${filterChild === c.id
                ? 'bg-blue-500 text-white shadow'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border dark:border-slate-700 hover:border-blue-300'
              }`}>
            <span>{c.avatar}</span>{c.name}
          </button>
        ))}
      </div>

      {/* 요약 통계 3개 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '✅', label: '승인된 기록', value: approved.length, sub: '건' },
          { icon: '⏱', label: '총 공부 시간', value: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`, sub: '' },
          { icon: '📚', label: '완료 항목', value: approved.reduce((s, l) => s + l.items.filter(i => i.completed).length, 0), sub: '개' },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center shadow-sm animate-slide-up transition-colors duration-300">
            <p className="text-2xl mb-1">{c.icon}</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">{c.value}{c.sub}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 요일별 공부 패턴 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-4 flex items-center gap-2">
          📅 요일별 공부 패턴
          <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(승인된 기록 기준)</span>
        </h2>
        {approved.length === 0
          ? <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-4">데이터가 없어요</p>
          : <WeekdayChart data={weekdayData} />
        }
        {approved.length > 0 && (() => {
          const maxDay = weekdayData.indexOf(Math.max(...weekdayData));
          const minNonZero = weekdayData.filter(v => v > 0);
          return (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-3 text-center">
              {`가장 많이 공부한 요일: `}
              <span className="font-bold text-blue-500">{WEEKDAY_KO[maxDay]}요일 ({weekdayData[maxDay]}회)</span>
              {minNonZero.length > 1 && ` · 총 ${minNonZero.reduce((a,b) => a+b, 0)}회`}
            </p>
          );
        })()}
      </div>

      {/* 과목별 공부 시간 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-4">📊 과목별 공부 시간</h2>
        {subjectData.length === 0
          ? <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-4">데이터가 없어요</p>
          : <BarChart data={subjectData} />
        }
      </div>

      {/* 자녀별 현황 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-4">👨‍👩‍👧 자녀별 현황</h2>
        <div className="space-y-4">
          {childStats.map(({ child, logs, total_min, items_done, items_total, streak }) => {
            const rate = items_total > 0 ? Math.round((items_done / items_total) * 100) : 0;
            const ringColor = rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b';
            return (
              <div key={child.id} className="flex items-center gap-4 p-4 border dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-700/50 transition-colors duration-300">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center text-3xl shadow-sm flex-shrink-0">
                  {child.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-800 dark:text-white text-sm">{child.name}</p>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{child.grade}</span>
                    {streak >= 3 && (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 px-2 py-0.5 rounded-full font-bold">
                        🔥 {streak}일 연속
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
                    {logs}개 기록 · {Math.floor(total_min/60)}h {total_min%60}m · 완료 {items_done}/{items_total}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${rate}%`, backgroundColor: ringColor }} />
                    </div>
                    <p className="text-xs font-bold w-10 text-right flex-shrink-0" style={{ color: ringColor }}>{rate}%</p>
                  </div>
                </div>
                <RingProgress pct={rate} color={ringColor} />
              </div>
            );
          })}
          {childStats.length === 0 && (
            <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-4">자녀 데이터가 없어요</p>
          )}
        </div>
      </div>
    </div>
  );
}
