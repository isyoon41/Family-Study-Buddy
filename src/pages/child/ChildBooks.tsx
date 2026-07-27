import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getChildStudyLogs } from '../../lib/db';
import type { StudyLog } from '../../types';

// ── Pastel palette with paired shading tones ────────────────────
// [highlight top, base mid, deep bottom, text color]
const PASTEL_SPINES: [string, string, string, string][] = [
  ['#f5dada', '#d4989a', '#a86a6c', '#4a1e20'],  // dusty rose
  ['#d8e8f8', '#96b8d8', '#6088b0', '#1a3050'],  // powder blue
  ['#d4eeda', '#90c4a0', '#5a9870', '#1a4228'],  // sage green
  ['#e4d8f4', '#b898d8', '#8860b0', '#2c1848'],  // soft lavender
  ['#f8e4cc', '#ddb888', '#b88850', '#503018'],  // warm peach
  ['#c8eeee', '#80c0c0', '#4a9898', '#124040'],  // teal mist
  ['#f0eacc', '#d0c080', '#a89040', '#403410'],  // warm sand
  ['#f0d0e0', '#d090a8', '#a85878', '#481828'],  // mauve
  ['#ccdcf0', '#88acd0', '#5078a8', '#122840'],  // steel blue
  ['#d8f0cc', '#96c880', '#5ca040', '#1c3c10'],  // mint sage
  ['#e0ccf0', '#b490d0', '#8458a8', '#281040'],  // lilac
  ['#cce8f0', '#7ab8cc', '#3a8898', '#0c2c38'],  // aqua
];
function spineColors(title: string): [string, string, string, string] {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return PASTEL_SPINES[Math.abs(h) % PASTEL_SPINES.length];
}
function spineHeight(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 17 + title.charCodeAt(i)) | 0;
  return 110 + (Math.abs(h) % 52); // 110–162px
}

const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

// Folder colors cycle
const FOLDER_COLORS = [
  { bg: '#efffdc', border: '#b8e890', icon: '#58CC02', label: '#2d6a00' },
  { bg: '#e8f7ff', border: '#b8d8ff', icon: '#1CB0F6', label: '#035d8a' },
  { bg: '#fff9e0', border: '#ffe58a', icon: '#FFD900', label: '#8C6900' },
  { bg: '#f5eaff', border: '#dbb8ff', icon: '#CE82FF', label: '#6B21A8' },
  { bg: '#ffe8d6', border: '#ffb890', icon: '#FF8C42', label: '#8B3A00' },
  { bg: '#dcfce7', border: '#86efac', icon: '#22C55E', label: '#14532D' },
];

interface BookEntry { title: string; date: string; completed: boolean; }
interface MonthGroup { year: number; month: number; books: BookEntry[]; }

// ── Canvas download (keep same function) ─────────────────────────
function wrapText(
  ctx: CanvasRenderingContext2D, text: string, cx: number,
  startY: number, maxW: number, lineH: number,
): number {
  let line = ''; let y = startY;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, cx, y); line = ch; y += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, y);
  return y;
}
function renderCanvas(
  canvas: HTMLCanvasElement,
  { childName, childAvatar, year, month, books }: {
    childName: string; childAvatar: string;
    year: number; month: number; books: BookEntry[];
  },
) {
  const COLS = 3, CW = 230, CH = 195, GAP = 20, PAD = 55;
  const rows = Math.ceil(books.length / COLS);
  const W = COLS * CW + (COLS - 1) * GAP + PAD * 2;
  const H = 240 + rows * (CH + GAP) + 80;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const KO = `"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fffbf0'); bg.addColorStop(1, '#fef3e2');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const stripe = ctx.createLinearGradient(0, 0, W, 0);
  stripe.addColorStop(0, '#58CC02'); stripe.addColorStop(1, '#4DA700');
  ctx.fillStyle = stripe; ctx.fillRect(0, 0, W, 7);

  ctx.textAlign = 'center';
  ctx.font = `52px serif`; ctx.fillStyle = '#000';
  ctx.fillText(childAvatar, W / 2, 82);
  ctx.font = `bold 30px ${KO}`; ctx.fillStyle = '#1C1C1E';
  ctx.fillText(`${year}년 ${MONTH_KO[month - 1]}의 독서 컬렉션`, W / 2, 130);
  ctx.font = `18px ${KO}`; ctx.fillStyle = '#4B4B4B';
  ctx.fillText(`${childName} · 총 ${books.length}권`, W / 2, 162);
  ctx.strokeStyle = '#e5e5e5'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 185); ctx.lineTo(W - PAD, 185); ctx.stroke();

  function roundRect2(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  books.forEach((book, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = PAD + col * (CW + GAP), y = 205 + row * (CH + GAP);
    const cx = x + CW / 2;
    const [c1, c2] = spineColors(book.title);
    ctx.fillStyle = 'rgba(0,0,0,.07)'; roundRect2(x + 3, y + 3, CW, CH, 14); ctx.fill();
    const grad = ctx.createLinearGradient(x, y, x + CW, y + CH);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad; roundRect2(x, y, CW, CH, 14); ctx.fill();
    ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText('📖', cx, y + 48);
    ctx.font = `bold 16px ${KO}`; ctx.fillStyle = 'rgba(255,255,255,.96)';
    wrapText(ctx, book.title, cx, y + 78, CW - 28, 21);
    ctx.font = `13px ${KO}`; ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.fillText(book.date, cx, y + CH - 14);
    if (book.completed) { ctx.font = '14px serif'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText('✅', x + CW - 10, y + 22); ctx.textAlign = 'center'; }
  });
  const fy = 205 + rows * (CH + GAP) + 12;
  ctx.font = `15px ${KO}`; ctx.fillStyle = '#4B4B4B'; ctx.textAlign = 'center';
  ctx.fillText('📖 공부 플래너 · 독서 컬렉션', W / 2, fy + 30);
}

// ── Book Spine component ─────────────────────────────────────────
function BookSpine({ book, index }: { book: BookEntry; index: number }) {
  const [cTop, cMid, cBot, cText] = spineColors(book.title);
  const h = spineHeight(book.title);
  return (
    <div
      title={book.title}
      style={{
        width: 44, height: h, flexShrink: 0,
        background: `linear-gradient(180deg, ${cTop} 0%, ${cMid} 55%, ${cBot} 100%)`,
        borderRadius: '4px 4px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', cursor: 'default',
        // 왼쪽 하이라이트 + 오른쪽 음영 + 드롭 섀도 → 입체감
        boxShadow: [
          'inset 4px 0 8px rgba(255,255,255,0.55)',   // 왼쪽 빛 반사
          'inset -3px 0 6px rgba(0,0,0,0.12)',         // 오른쪽 음영
          '4px 0 10px rgba(0,0,0,0.18)',               // 오른쪽 드롭 섀도
          '0 -1px 0 rgba(255,255,255,0.4)',             // 상단 엣지
        ].join(', '),
        animation: `spine-in .45s ${index * 0.055}s cubic-bezier(.34,1.56,.64,1) both`,
        transformOrigin: 'bottom center',
      }}>
      {/* 왼쪽 바인딩 라인 */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,.1) 100%)`,
        borderRadius: '4px 0 0 0',
      }} />
      {/* 제목 (세로) */}
      <span style={{
        writingMode: 'vertical-rl', textOrientation: 'mixed',
        color: cText, fontSize: 10, fontWeight: 700,
        lineHeight: 1.3, padding: '8px 2px',
        overflow: 'hidden', maxHeight: h - 20,
        userSelect: 'none',
        fontFamily: '"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif',
        letterSpacing: '0.02em',
      }}>
        {book.title}
      </span>
      {/* 완독 표시 — 상단 작은 점 */}
      {book.completed && (
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: cText, opacity: 0.5,
        }} />
      )}
    </div>
  );
}

// ── Bookshelf section ────────────────────────────────────────────
function Bookshelf({ books, isVisible }: { books: BookEntry[]; isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <div style={{ animation: 'shelf-reveal .3s cubic-bezier(.16,1,.3,1) both' }}>
      {/* Scrollable spine track */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 5,
          padding: '28px 20px 0 20px', minWidth: 'max-content',
        }}>
          {books.map((book, i) => (
            <BookSpine key={book.title} book={book} index={i} />
          ))}
        </div>
        {/* Wooden shelf — 월넛 톤 */}
        <div style={{
          height: 22, marginLeft: 20,
          width: `max(calc(100% - 40px), ${books.length * 49}px)`,
          background: [
            'linear-gradient(180deg,',
            '#a07850 0%,',    // 상단 엣지 (밝은 하이라이트)
            '#7a5430 15%,',   // 메인 표면
            '#5c3c1c 60%,',   // 깊은 중간
            '#3c2410 100%',   // 하단 그림자
            ')',
          ].join(' '),
          boxShadow: [
            '0 8px 24px rgba(0,0,0,.35)',
            'inset 0 2px 5px rgba(200,160,80,.3)',  // 상단 광택
            'inset 0 -2px 4px rgba(0,0,0,.2)',      // 하단 음영
          ].join(', '),
        }} />
      </div>
    </div>
  );
}

// ── Month Folder ─────────────────────────────────────────────────
function MonthFolder({
  group, colorIdx, isOpen, onToggle, onDownload, downloading,
}: {
  group: MonthGroup; colorIdx: number; isOpen: boolean;
  onToggle: () => void; onDownload: () => void; downloading: boolean;
}) {
  const c = FOLDER_COLORS[colorIdx % FOLDER_COLORS.length];
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden',
      border: `2px solid ${isOpen ? c.icon : c.border}`,
      transition: 'border-color .2s',
      boxShadow: isOpen ? `0 4px 20px ${c.icon}22` : 'none' }}>

      {/* Folder header */}
      <button onClick={onToggle}
        style={{ width: '100%', padding: '18px 20px',
          background: isOpen ? c.bg : 'white',
          display: 'flex', alignItems: 'center', gap: 14,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          fontFamily: '"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif',
          transition: 'background .2s' }}>

        {/* Folder icon + month */}
        <div style={{ width: 48, height: 48, borderRadius: 14,
          backgroundColor: isOpen ? c.icon : c.border,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0, transition: 'background .2s',
          boxShadow: isOpen ? `0 3px 0 ${c.icon}88` : 'none' }}>
          {isOpen ? '📂' : '📁'}
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: isOpen ? c.label : '#1C1C1E',
            letterSpacing: '-.02em', lineHeight: 1.2,
            fontFamily: 'inherit' }}>
            {group.year}년 {MONTH_KO[group.month - 1]}
          </p>
          <p style={{ fontSize: 13, color: '#AFAFAF', fontWeight: 600, marginTop: 2 }}>
            📚 {group.books.length}권 읽음
          </p>
        </div>

        {/* Book count badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ backgroundColor: isOpen ? c.icon : c.border,
            color: isOpen ? '#fff' : c.label,
            borderRadius: 9999, padding: '4px 12px',
            fontSize: 13, fontWeight: 700,
            transition: 'all .2s' }}>
            {group.books.length}권
          </span>
          <span style={{ color: '#AFAFAF', fontSize: 18, transition: 'transform .3s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'block' }}>
            ▾
          </span>
        </div>
      </button>

      {/* Bookshelf (animated) */}
      {isOpen && (
        <div style={{ backgroundColor: '#fafafa', borderTop: `2px solid ${c.border}` }}>
          <Bookshelf books={group.books} isVisible={isOpen} />

          {/* Action bar */}
          <div style={{ padding: '14px 20px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 600 }}>
              가장 최근: {group.books[group.books.length - 1]?.date.slice(5).replace('-', '/')}
            </p>
            <button onClick={e => { e.stopPropagation(); onDownload(); }}
              disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', gap: 7,
                backgroundColor: downloading ? '#AFAFAF' : c.icon,
                color: '#fff', border: 'none',
                borderBottom: `3px solid ${downloading ? '#999' : c.label}`,
                borderRadius: 12, padding: '9px 18px',
                fontSize: 13, fontWeight: 700, cursor: downloading ? 'default' : 'pointer',
                letterSpacing: '.03em', fontFamily: 'inherit' }}>
              {downloading ? '⏳ 저장 중...' : '💾 이미지 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function ChildBooks() {
  const navigate   = useNavigate();
  const { child }  = useAuth();
  const [logs, setLogs]       = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
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
      const g = map.get(key)!;
      for (const item of log.items) {
        if (item.subject !== '독서' || !item.task_text.trim()) continue;
        const title = item.task_text.trim();
        if (g.seen.has(title)) continue;
        g.seen.add(title);
        g.books.push({ title, date: log.date, completed: item.completed });
      }
    }
    return [...map.values()]
      .filter(g => g.books.length > 0)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [logs]);

  const totalBooks = useMemo(
    () => new Set(monthGroups.flatMap(g => g.books.map(b => b.title))).size,
    [monthGroups],
  );

  const handleToggle = (key: string) => setOpenKey(p => p === key ? null : key);

  const handleDownload = (group: MonthGroup) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const key = `${group.year}-${group.month}`;
    setDownloading(key);
    renderCanvas(canvas, {
      childName: child?.name ?? '', childAvatar: child?.avatar ?? '📚',
      year: group.year, month: group.month, books: group.books,
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', backgroundColor: '#f4fff0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%',
              backgroundColor: '#58CC02', animation: `bounce .8s ${i * .2}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4fff0',
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Keyframes */}
      <style>{`
        @keyframes spine-in {
          0%   { opacity: 0; transform: scaleY(0) translateY(12px); }
          70%  { transform: scaleY(1.08) translateY(-3px); }
          100% { opacity: 1; transform: scaleY(1) translateY(0); }
        }
        @keyframes shelf-reveal {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-12px); }
        }
      `}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: 'rgba(244,255,240,.92)', backdropFilter: 'blur(12px)',
        borderBottom: '2px solid #e5e5e5', padding: '0 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', height: 56,
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/child/dashboard')}
            style={{ width: 36, height: 36, borderRadius: 12,
              backgroundColor: '#efffdc', border: '2px solid #b8e890',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer', color: '#2d6a00', fontWeight: 700 }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#1C1C1E',
              letterSpacing: '-.02em', lineHeight: 1 }}>내 독서 컬렉션</p>
            <p style={{ fontSize: 12, color: '#AFAFAF', marginTop: 2 }}>
              총 <span style={{ color: '#58CC02', fontWeight: 800 }}>{totalBooks}권</span> 읽음 · {monthGroups.length}개월
            </p>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 12,
            backgroundColor: '#efffdc', border: '2px solid #b8e890',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {child?.avatar}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 80px' }}>
        {monthGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 64, marginBottom: 20 }}>📚</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E' }}>아직 읽은 책이 없어요</p>
            <p style={{ fontSize: 14, color: '#AFAFAF', marginTop: 8 }}>
              학습일지에 <span style={{ color: '#58CC02', fontWeight: 700 }}>독서</span> 항목을 추가해 보세요!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {monthGroups.map((group, idx) => {
              const key = `${group.year}-${group.month}`;
              return (
                <MonthFolder
                  key={key}
                  group={group}
                  colorIdx={idx}
                  isOpen={openKey === key}
                  onToggle={() => handleToggle(key)}
                  onDownload={() => handleDownload(group)}
                  downloading={downloading === key}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
