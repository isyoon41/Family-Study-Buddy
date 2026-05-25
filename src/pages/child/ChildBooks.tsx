import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getChildStudyLogs } from '../../lib/db';
import type { StudyLog } from '../../types';

// ── 색상 팔레트 (책 표지용) ──────────────────────────────────
const PALETTES: [string, string][] = [
  ['#f472b6', '#db2777'], ['#fb923c', '#ea580c'], ['#34d399', '#059669'],
  ['#60a5fa', '#2563eb'], ['#a78bfa', '#7c3aed'], ['#fbbf24', '#d97706'],
  ['#f87171', '#dc2626'], ['#2dd4bf', '#0d9488'], ['#818cf8', '#4f46e5'],
  ['#4ade80', '#16a34a'], ['#c084fc', '#9333ea'], ['#38bdf8', '#0284c7'],
];

function coverColors(title: string): [string, string] {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

interface BookEntry { title: string; date: string; completed: boolean; }
interface MonthGroup { year: number; month: number; books: BookEntry[]; }

// ── 캔버스 유틸 ────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, cx: number, startY: number, maxW: number, lineH: number,
): number {
  let line = '';
  let y = startY;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, y);
      line = ch; y += lineH;
    } else { line = test; }
  }
  if (line) ctx.fillText(line, cx, y);
  return y;
}

// ── 월별 컬렉션 이미지 렌더링 ────────────────────────────────
function renderToCanvas(
  canvas: HTMLCanvasElement,
  { childName, childAvatar, year, month, books }: {
    childName: string; childAvatar: string;
    year: number; month: number; books: BookEntry[];
  },
) {
  const COLS = 3;
  const CW = 230, CH = 195, GAP = 20, PAD = 55;
  const rows = Math.ceil(books.length / COLS);
  const W = COLS * CW + (COLS - 1) * GAP + PAD * 2;
  const H = 240 + rows * (CH + GAP) + 80;
  canvas.width = W; canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  const KO_FONT = `"Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif`;

  // 배경
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fffbf0'); bg.addColorStop(1, '#fef3e2');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // 상단 스트라이프
  const stripe = ctx.createLinearGradient(0, 0, W, 0);
  stripe.addColorStop(0, '#f59e0b'); stripe.addColorStop(1, '#d97706');
  ctx.fillStyle = stripe; ctx.fillRect(0, 0, W, 7);

  // 헤더
  ctx.textAlign = 'center';
  ctx.font = `52px serif`; ctx.fillStyle = '#000';
  ctx.fillText(childAvatar, W / 2, 82);

  ctx.font = `bold 30px ${KO_FONT}`; ctx.fillStyle = '#78350f';
  ctx.fillText(`${year}년 ${MONTH_KO[month - 1]}의 독서 컬렉션`, W / 2, 130);

  ctx.font = `18px ${KO_FONT}`; ctx.fillStyle = '#a16207';
  ctx.fillText(`${childName} · 총 ${books.length}권`, W / 2, 162);

  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 185); ctx.lineTo(W - PAD, 185); ctx.stroke();

  // 책 카드
  const startX = PAD;
  books.forEach((book, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = startX + col * (CW + GAP);
    const y = 205 + row * (CH + GAP);
    const cx = x + CW / 2;
    const [c1, c2] = coverColors(book.title);

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    roundRect(ctx, x + 3, y + 3, CW, CH, 14); ctx.fill();

    // 카드 배경
    const grad = ctx.createLinearGradient(x, y, x + CW, y + CH);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, CW, CH, 14); ctx.fill();

    // 책 아이콘
    ctx.font = '36px serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('📖', cx, y + 48);

    // 제목
    ctx.font = `bold 16px ${KO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    wrapText(ctx, book.title, cx, y + 78, CW - 28, 21);

    // 날짜
    ctx.font = `13px ${KO_FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(book.date, cx, y + CH - 14);

    // 완료 체크
    if (book.completed) {
      ctx.font = '14px serif'; ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('✅', x + CW - 10, y + 22);
      ctx.textAlign = 'center';
    }
  });

  // 푸터
  const footerY = 205 + rows * (CH + GAP) + 12;
  ctx.font = `15px ${KO_FONT}`; ctx.fillStyle = '#b45309';
  ctx.textAlign = 'center';
  ctx.fillText('📖 공부 플래너 · 독서 컬렉션', W / 2, footerY + 30);
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ChildBooks() {
  const navigate = useNavigate();
  const { child } = useAuth();
  const [logs, setLogs]           = useState<StudyLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (child?.id && isSupabaseConfigured) {
      const data = await getChildStudyLogs(child.id, child.pin);
      setLogs(data.filter(l => l.status === 'approved'));
    }
    setLoading(false);
  }, [child]);

  useEffect(() => { load(); }, [load]);

  const monthGroups = useMemo((): MonthGroup[] => {
    const map = new Map<string, MonthGroup & { seen: Set<string> }>();
    for (const log of logs) {
      const [y, m] = log.date.split('-').map(Number);
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { year: y, month: m, books: [], seen: new Set() });
      const group = map.get(key)!;
      for (const item of log.items) {
        if (item.subject !== '독서' || !item.task_text.trim()) continue;
        const title = item.task_text.trim();
        if (group.seen.has(title)) continue;
        group.seen.add(title);
        group.books.push({ title, date: log.date, completed: item.completed });
      }
    }
    return [...map.values()]
      .filter(g => g.books.length > 0)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [logs]);

  const years = useMemo(
    () => [...new Set(monthGroups.map(g => g.year))].sort((a, b) => b - a),
    [monthGroups],
  );

  useEffect(() => {
    if (years.length > 0 && activeYear === null) setActiveYear(years[0]);
  }, [years, activeYear]);

  const visibleGroups = monthGroups.filter(g => g.year === activeYear);
  const totalBooks = useMemo(
    () => new Set(monthGroups.flatMap(g => g.books.map(b => b.title))).size,
    [monthGroups],
  );

  const downloadMonth = (group: MonthGroup) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const key = `${group.year}-${group.month}`;
    setDownloading(key);
    renderToCanvas(canvas, {
      childName: child?.name ?? '',
      childAvatar: child?.avatar ?? '📚',
      year: group.year, month: group.month,
      books: group.books,
    });
    canvas.toBlob(blob => {
      if (!blob) { setDownloading(null); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `독서컬렉션_${group.year}년${MONTH_KO[group.month - 1]}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setDownloading(null);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 dark:bg-slate-900">
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 bg-amber-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 pb-20">
      <canvas ref={canvasRef} className="hidden" />

      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-amber-100 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/child/dashboard')}
          className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-slate-700 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-slate-600 transition">
          ←
        </button>
        <div className="flex-1">
          <h1 className="font-extrabold text-gray-800 dark:text-white text-base leading-none">내 독서 컬렉션</h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            총 <span className="font-bold text-amber-600 dark:text-amber-400">{totalBooks}권</span>의 책을 읽었어요 📚
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-slate-700 flex items-center justify-center text-2xl">
          {child?.avatar}
        </div>
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto">
        {monthGroups.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-7xl mb-5 animate-bounce inline-block">📚</p>
            <p className="text-gray-600 dark:text-slate-300 font-bold text-lg">아직 읽은 책이 없어요</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-2">
              학습일지에 <span className="text-amber-600 font-bold">독서</span> 항목을 추가해 보세요!
            </p>
          </div>
        ) : (
          <>
            {/* 연도 탭 */}
            {years.length > 1 && (
              <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                {years.map(y => (
                  <button key={y} onClick={() => setActiveYear(y)}
                    className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition shadow-sm
                      ${activeYear === y
                        ? 'bg-amber-500 text-white shadow-amber-200 dark:shadow-amber-900'
                        : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
                      }`}>
                    {y}년
                  </button>
                ))}
              </div>
            )}

            {/* 연간 통계 */}
            {activeYear && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-400 rounded-3xl p-4 mb-5 text-white shadow-lg">
                <p className="text-xs font-bold opacity-80 mb-1">{activeYear}년 독서 현황</p>
                <div className="flex items-end gap-1">
                  <p className="text-4xl font-extrabold">
                    {new Set(
                      monthGroups
                        .filter(g => g.year === activeYear)
                        .flatMap(g => g.books.map(b => b.title))
                    ).size}
                  </p>
                  <p className="text-lg font-bold mb-1 opacity-90">권</p>
                </div>
                <p className="text-xs opacity-70 mt-0.5">
                  {monthGroups.filter(g => g.year === activeYear).length}개월 동안 읽음
                </p>
              </div>
            )}

            {/* 월별 섹션 */}
            <div className="space-y-5">
              {visibleGroups.map(group => {
                const key = `${group.year}-${group.month}`;
                return (
                  <div key={key}
                    className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-amber-100 dark:border-slate-700">

                    {/* 월 헤더 */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-amber-50 dark:border-slate-700">
                      <div>
                        <p className="font-extrabold text-gray-800 dark:text-white text-base">
                          {MONTH_KO[group.month - 1]}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                          📚 {group.books.length}권 읽음
                        </p>
                      </div>
                      <button
                        onClick={() => downloadMonth(group)}
                        disabled={!!downloading}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-slate-600
                          text-white px-4 py-2 rounded-2xl text-xs font-bold transition shadow-sm active:scale-95">
                        {downloading === key ? '⏳' : '💾'}
                        {downloading === key ? '저장 중...' : '이미지 저장'}
                      </button>
                    </div>

                    {/* 책 그리드 */}
                    <div className="grid grid-cols-3 gap-3 p-4">
                      {group.books.map(book => {
                        const [c1, c2] = coverColors(book.title);
                        return (
                          <div key={book.title}
                            className="rounded-2xl overflow-hidden shadow-sm flex flex-col">
                            {/* 표지 영역 */}
                            <div
                              className="relative flex flex-col items-center justify-center px-2 pt-3 pb-2 flex-1"
                              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, minHeight: '88px' }}>
                              <span className="text-2xl mb-1.5">📖</span>
                              <p className="text-white font-bold text-center text-xs leading-tight line-clamp-3 px-1 break-words">
                                {book.title}
                              </p>
                              {book.completed && (
                                <span className="absolute top-1.5 right-1.5 text-xs">✅</span>
                              )}
                            </div>
                            {/* 날짜 */}
                            <div className="bg-white dark:bg-slate-700 px-2 py-1.5 text-center">
                              <p className="text-xs text-gray-400 dark:text-slate-400 font-medium">
                                {book.date.slice(5).replace('-', '/')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
