import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// ── Duolingo Design Tokens ──────────────────────────────────────
const D = {
  green:       '#58CC02',
  greenDark:   '#4DA700',
  greenLight:  '#EFFFDC',
  yellow:      '#FFD900',
  yellowDark:  '#E8C000',
  yellowLight: '#FFFBE6',
  blue:        '#1CB0F6',
  blueDark:    '#0F9FE0',
  blueLight:   '#E8F7FF',
  red:         '#FF4B4B',
  purple:      '#CE82FF',
  purpleLight: '#F5EAFF',
  navy:        '#1C1C1E',
  body:        '#4B4B4B',
  muted:       '#AFAFAF',
  border:      '#E5E5E5',
  canvas:      '#F4FFF0',
  card:        '#FFFFFF',
} as const;

// ── Shared style helpers ────────────────────────────────────────
const btn = (bg: string, shadow: string, color = '#fff'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '13px 28px', borderRadius: 16, fontFamily: 'inherit',
  fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase',
  border: 'none', borderBottom: `4px solid ${shadow}`,
  cursor: 'pointer', backgroundColor: bg, color,
  transition: 'transform .1s, border-bottom-width .1s',
});
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 26px', borderRadius: 16, fontFamily: 'inherit',
  fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase',
  border: `2px solid ${D.border}`, backgroundColor: 'transparent',
  color: D.body, cursor: 'pointer',
};
const inputS: React.CSSProperties = {
  width: '100%', border: `2px solid ${D.border}`, borderRadius: 12,
  padding: '13px 16px', fontSize: 16, backgroundColor: D.card, color: D.navy,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  transition: 'border-color .15s',
};
const card32: React.CSSProperties = {
  backgroundColor: D.card, borderRadius: 24, border: `2px solid ${D.border}`,
  padding: 36, width: '100%', maxWidth: 440, margin: '0 auto',
};

const FEATURES = [
  { icon: '🪙', title: '주간 보상 코인', desc: '주 6일 달성 시 300코인 자동 지급. 부모님이 직접 정산해요.', bg: D.greenLight, titleColor: D.greenDark, badge: '6일 → 300코인', badgeBg: D.green },
  { icon: '📊', title: '실시간 리포트', desc: '과목별 공부 시간, 주간 패턴, 연속 달성일을 한눈에.', bg: D.blueLight, titleColor: D.blueDark, badge: 'CSV 내보내기', badgeBg: D.blue },
  { icon: '📚', title: '독서 컬렉션', desc: '읽은 책을 월별로 모아 이미지로 저장·부모님께 자랑!', bg: D.yellowLight, titleColor: '#8C6900', badge: 'PNG 다운로드', badgeBg: D.yellow, badgeColor: D.navy },
  { icon: '🏆', title: '뱃지 & 스트릭', desc: '연속 달성, 완벽한 하루 등 7가지 뱃지로 성취감을.', bg: D.purpleLight, titleColor: '#7B2FBE', badge: '7가지 뱃지', badgeBg: D.purple },
];

const DEMO_CHILDREN = [
  { id: 'child-001', name: '민준', grade: '초5', avatar: '🐶', pin: '1234' },
  { id: 'child-002', name: '서연', grade: '초3', avatar: '🦊', pin: '5678' },
];

const MASCOTS = [
  { emoji: '🐶', name: '한결', grade: '초5' },
  { emoji: '🦊', name: '지환', grade: '초3' },
  { emoji: '🐱', name: '민준', grade: '초6' },
  { emoji: '🐻', name: '서연', grade: '중1' },
];

const SUBJECTS = [
  { label: '📐 수학', bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' },
  { label: '📝 국어', bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  { label: '🔤 영어', bg: '#EDE9FE', color: '#5B21B6', border: '#DDD6FE' },
  { label: '🔬 과학', bg: '#FEF9C3', color: '#854D0E', border: '#FDE68A' },
  { label: '🌍 사회', bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  { label: '漢 한자', bg: '#FCE7F3', color: '#9D174D', border: '#FBCFE8' },
  { label: '📚 독서', bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  { label: '📋 전과목', bg: '#E8EAF6', color: '#283593', border: '#C5CAE9' },
  { label: '🌿 도덕', bg: '#F1F8E9', color: '#2E7D32', border: '#DCEDC8' },
];

export default function Index() {
  const navigate = useNavigate();
  const { loginAsParent, setupAccount } = useAuth();
  const [view, setView]         = useState<'landing'|'login'|'setup'|'forgot'>('landing');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [family, setFamily]     = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const go = (v: typeof view) => { setView(v); setError(''); setResetSent(false); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const r = await loginAsParent(email, password);
    setLoading(false);
    if (r.error) setError(r.error); else navigate('/parent');
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !family) { setError('모든 항목을 입력해주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    setLoading(true); setError('');
    const r = await setupAccount(email, password, family);
    setLoading(false);
    if (r.error) setError(r.error); else navigate('/parent');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('이메일을 입력해주세요.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) setError(err.message); else setResetSent(true);
  };

  // ── Auth views ───────────────────────────────────────────────
  if (view !== 'landing') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: D.canvas, display: 'flex', flexDirection: 'column',
        fontFamily: '"Apple SD Gothic Neo","Malgun Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif' }}>
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
          <button onClick={() => go('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: D.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              boxShadow: `0 3px 0 ${D.greenDark}` }}>📖</div>
            <span style={{ fontSize: 17, fontWeight: 800, color: D.navy, letterSpacing: '-.02em' }}>공부 플래너</span>
          </button>
          <button onClick={() => go('landing')} style={{ ...btnGhost, padding: '8px 16px', fontSize: 13 }}>← 돌아가기</button>
        </nav>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          {view === 'login' && (
            <div style={card32}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: D.navy, letterSpacing: '-.03em', marginBottom: 4 }}>부모님 로그인</h2>
              <p style={{ color: D.muted, fontSize: 14, marginBottom: 28 }}>이메일과 비밀번호를 입력하세요</p>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} style={inputS} />
                <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} style={inputS} />
                {error && <p style={{ color: D.red, fontSize: 13 }}>{error}</p>}
                <button type="submit" disabled={loading} style={{ ...btn(D.green, D.greenDark), justifyContent: 'center', opacity: loading ? .6 : 1, fontSize: 15, padding: '14px 28px' }}>
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `2px solid ${D.border}`,
                display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <button onClick={() => go('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.muted, fontSize: 13, fontWeight: 600 }}>
                  비밀번호를 잊으셨나요?
                </button>
                <button onClick={() => go('setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.blue, fontSize: 14, fontWeight: 700 }}>
                  처음 사용하시나요? 계정 만들기 →
                </button>
              </div>
            </div>
          )}

          {view === 'setup' && (
            <div style={card32}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: D.navy, letterSpacing: '-.03em', marginBottom: 4 }}>계정 만들기</h2>
              <p style={{ color: D.muted, fontSize: 14, marginBottom: 28 }}>우리 가족 전용 학습 공간을 설정해요</p>
              <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="text" placeholder="가족 이름 (예: 김씨 가족)" value={family} onChange={e => setFamily(e.target.value)} style={inputS} />
                <input type="email" placeholder="부모님 이메일" value={email} onChange={e => setEmail(e.target.value)} style={inputS} />
                <input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} style={inputS} />
                {error && <p style={{ color: D.red, fontSize: 13 }}>{error}</p>}
                <button type="submit" disabled={loading} style={{ ...btn(D.green, D.greenDark), justifyContent: 'center', opacity: loading ? .6 : 1, fontSize: 15, padding: '14px 28px' }}>
                  {loading ? '생성 중...' : '가족 계정 만들기 🎉'}
                </button>
              </form>
              <p style={{ color: D.muted, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
                {isSupabaseConfigured ? '☁️ 데이터가 클라우드에 안전하게 저장됩니다' : 'Supabase 설정 후 클라우드 저장 가능'}
              </p>
            </div>
          )}

          {view === 'forgot' && (
            <div style={card32}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: D.navy, letterSpacing: '-.03em', marginBottom: 4 }}>비밀번호 재설정</h2>
              <p style={{ color: D.muted, fontSize: 14, marginBottom: 28 }}>가입한 이메일로 재설정 링크를 보내드려요</p>
              {resetSent ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ fontSize: 52, marginBottom: 16 }}>📬</p>
                  <p style={{ color: D.navy, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>이메일을 보냈어요!</p>
                  <p style={{ color: D.body, fontSize: 14, lineHeight: 1.6 }}>
                    <span style={{ color: D.blue, fontWeight: 700 }}>{email}</span>으로<br />재설정 링크를 전송했습니다.
                  </p>
                  <button onClick={() => go('login')} style={{ ...btnGhost, marginTop: 24 }}>로그인으로 돌아가기</button>
                </div>
              ) : (
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input type="email" placeholder="가입한 이메일" value={email} onChange={e => setEmail(e.target.value)} style={inputS} />
                  {error && <p style={{ color: D.red, fontSize: 13 }}>{error}</p>}
                  <button type="submit" disabled={loading} style={{ ...btn(D.green, D.greenDark), justifyContent: 'center', opacity: loading ? .6 : 1, fontSize: 15, padding: '14px 28px' }}>
                    {loading ? '전송 중...' : '재설정 링크 보내기'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Landing ──────────────────────────────────────────────────
  const ff = '"Apple SD Gothic Neo","Malgun Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif';
  return (
    <div style={{ minHeight: '100vh', backgroundColor: D.canvas, fontFamily: ff }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(244,255,240,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: `2px solid ${D.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: D.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              boxShadow: `0 3px 0 ${D.greenDark}` }}>📖</div>
            <span style={{ fontSize: 17, fontWeight: 800, color: D.navy, letterSpacing: '-.02em' }}>공부 플래너</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/child')} style={{ ...btnGhost, padding: '9px 18px', fontSize: 13 }}>자녀 로그인</button>
            <button onClick={() => go('login')} style={{ ...btn(D.green, D.greenDark), padding: '9px 20px', fontSize: 13 }}>부모님 로그인</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 48px', textAlign: 'center' }}>
        {/* Mascots */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, marginBottom: 40 }}>
          {MASCOTS.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              animation: `mascot-in .5s ${i * .07}s cubic-bezier(.34,1.56,.64,1) both` }}>
              <div style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: D.card,
                border: `3px solid ${i === 0 ? D.green : D.border}`,
                boxShadow: `0 4px 0 ${i === 0 ? D.greenDark : D.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
                {m.emoji}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: D.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {m.name} {m.grade}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'inline-block', background: D.greenLight, color: D.greenDark,
          borderRadius: 9999, padding: '5px 16px', fontSize: 13, fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 20 }}>
          📱 AI 학습 관리 앱
        </div>

        <h1 style={{ fontSize: 'clamp(38px,7vw,70px)', fontWeight: 900, letterSpacing: '-.04em',
          lineHeight: 1.05, color: D.navy, marginBottom: 20 }}>
          매일 조금씩,<br /><span style={{ color: D.green }}>함께</span> 커나가요
        </h1>

        <p style={{ fontSize: 18, color: D.body, lineHeight: 1.65, maxWidth: 500,
          margin: '0 auto 40px' }}>
          공부 노트 사진 한 장이면 AI가 과목별로 정리해줘요.<br />
          부모님이 바로 확인하고, 아이는 코인으로 보상받아요.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginBottom: 44 }}>
          <button onClick={() => go('setup')} style={{ ...btn(D.green, D.greenDark), padding: '15px 32px', fontSize: 16 }}>
            📸 무료로 시작하기
          </button>
          <button onClick={() => go('login')} style={{ ...btnGhost, padding: '13px 30px', fontSize: 16, border: `2px solid ${D.border}` }}>
            로그인하기
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {[
            { icon: '🔥', val: '14', label: '일 연속 달성', border: '#FF8C00', color: '#FF8C00' },
            { icon: '🪙', val: '2,400', label: '코인 획득', border: D.yellow, color: '#8C6900' },
            { icon: '⭐', val: '98%', label: '부모님 승인율', border: D.blue, color: D.blue },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: D.card, border: `2px solid ${s.border}`, borderRadius: 9999,
              padding: '8px 18px' }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: '-.02em' }}>{s.val}</span>
              <span style={{ fontSize: 12, color: D.muted, fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SUBJECT BADGES */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
        padding: '0 24px 72px', maxWidth: 900, margin: '0 auto' }}>
        {SUBJECTS.map(s => (
          <span key={s.label} style={{ padding: '6px 14px', borderRadius: 9999,
            fontSize: 13, fontWeight: 700, backgroundColor: s.bg, color: s.color,
            border: `2px solid ${s.border}` }}>{s.label}</span>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: D.green, marginBottom: 10 }}>사용 방법</p>
        <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-.03em', color: D.navy, marginBottom: 56 }}>
          3단계로 끝나요
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32 }}>
          {[
            { icon: '📸', bg: '#E8F4FF', shadow: '#B8D8FF', n: '1', title: '사진 찍기', desc: '공부 노트나 계획표를 사진으로 찍어 올려요' },
            { icon: '✨', bg: D.greenLight, shadow: '#B8E890', n: '2', title: 'AI 자동 분석', desc: 'Gemini AI가 과목·내용·분량을 자동으로 정리해요' },
            { icon: '✅', bg: '#FFF3E0', shadow: '#FFCC80', n: '3', title: '부모님 승인', desc: '이메일 알림 받고 바로 확인 — 코인이 자동 지급돼요' },
          ].map(s => (
            <div key={s.n} style={{ textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: s.bg,
                boxShadow: `0 5px 0 ${s.shadow}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 40, margin: '0 auto 16px' }}>{s.icon}</div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: D.green,
                color: '#fff', fontSize: 13, fontWeight: 800, lineHeight: '24px',
                display: 'inline-block', marginBottom: 10 }}>{s.n}</div>
              <p style={{ fontSize: 18, fontWeight: 800, color: D.navy, letterSpacing: '-.02em', marginBottom: 8 }}>{s.title}</p>
              <p style={{ fontSize: 14, color: D.body, lineHeight: 1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: D.green, marginBottom: 10 }}>주요 기능</p>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-.03em', color: D.navy, marginBottom: 40 }}>
          더 스마트하게 공부해요
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ borderRadius: 24, padding: '32px 28px',
              backgroundColor: f.bg, border: '2px solid rgba(0,0,0,.05)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(0,0,0,.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 20 }}>
                {f.icon}
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: f.titleColor, letterSpacing: '-.02em', marginBottom: 8 }}>{f.title}</p>
              <p style={{ fontSize: 14, color: D.body, lineHeight: 1.65, marginBottom: 16 }}>{f.desc}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                backgroundColor: f.badgeBg, color: f.badgeColor ?? '#fff',
                borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {f.badge}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 100px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: D.green, marginBottom: 10 }}>데모 체험</p>
        <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-.03em', color: D.navy, marginBottom: 36 }}>지금 바로 써보세요</h2>
        <div style={{ backgroundColor: D.card, border: `2px solid ${D.border}`, borderRadius: 28, padding: '40px 32px' }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: D.navy, letterSpacing: '-.02em', marginBottom: 6 }}>자녀로 체험하기</p>
          <p style={{ fontSize: 14, color: D.muted, marginBottom: 28 }}>캐릭터를 선택하면 바로 시작돼요</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {DEMO_CHILDREN.map(c => (
              <button key={c.id} onClick={() => navigate(`/child/pin/${c.id}`)}
                style={{ border: `2px solid ${D.border}`, borderRadius: 20, padding: '18px 8px 14px',
                  cursor: 'pointer', background: 'transparent', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 36 }}>{c.avatar}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: D.navy }}>{c.name}</span>
                <span style={{ fontSize: 12, color: D.muted, fontWeight: 600 }}>{c.grade} · PIN {c.pin}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: D.muted, fontSize: 13, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: D.border }} />
            <span>또는</span>
            <div style={{ flex: 1, height: 1, backgroundColor: D.border }} />
          </div>
          <button
            onClick={() => loginAsParent('parent@example.com', 'password123').then(() => navigate('/parent'))}
            style={{ ...btn(D.green, D.greenDark), width: '100%', justifyContent: 'center', padding: '15px 28px', fontSize: 15 }}>
            👨‍👩‍👧 부모님 계정으로 체험하기
          </button>
        </div>
      </section>

      <footer style={{ borderTop: `2px solid ${D.border}`, padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: D.muted, fontSize: 13 }}>© 2026 공부 플래너 — 가족이 함께 만드는 학습 습관</p>
      </footer>

      <style>{`
        @keyframes mascot-in {
          from { opacity: 0; transform: scale(.6) translateY(20px); }
          to   { opacity: 1; transform: scale(1)  translateY(0);   }
        }
      `}</style>
    </div>
  );
}
