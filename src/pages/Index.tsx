import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// ── Geniestudio Design Tokens ───────────────────────────────────
const G = {
  canvas:   '#ebf5ff',
  card:     '#fafdff',
  ink:      '#0a0d12',
  charcoal: '#181d27',
  graphite: '#535862',
  fog:      '#93979f',
  iris:     '#0069e0',
  lavender: '#f1e6ff',
  mint:     '#d3f6e3',
  powder:   '#cce7ff',
  solar:    '#fff9e0',
  peach:    '#ffe8d6',
} as const;

const darkPill: React.CSSProperties = {
  backgroundColor: G.charcoal, color: '#fff', borderRadius: 9999,
  padding: '12px 28px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em',
  border: 'none', cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(10,13,18,0.8), 0 0 0 1px #0a0d12',
  display: 'inline-flex', alignItems: 'center', gap: 8,
};
const ghostPill: React.CSSProperties = {
  backgroundColor: 'transparent', color: G.ink, borderRadius: 9999,
  padding: '12px 28px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em',
  border: '1.5px solid rgba(10,13,18,0.15)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 8,
};
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid rgba(10,13,18,0.12)', borderRadius: 14,
  padding: '12px 16px', fontSize: 15, backgroundColor: '#fff', color: G.ink,
  outline: 'none', letterSpacing: '-0.01em', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const FEATURES = [
  { icon: '📸', title: 'AI 사진 분석', desc: '공부 노트 사진 한 장이면 Gemini AI가 과목·분량을 자동 정리해요', bg: G.lavender },
  { icon: '✅', title: '실시간 부모 확인', desc: '자녀가 제출하면 즉시 이메일 알림 — 어디서나 바로 승인 가능', bg: G.mint },
  { icon: '📊', title: '과목별 리포트', desc: '주간·월간 공부 현황을 한눈에, CSV 내보내기까지 제공해요', bg: G.powder },
  { icon: '🪙', title: '주간 보상 코인', desc: '6일 달성 시 300코인 자동 지급 — 부모님이 직접 정산할 수 있어요', bg: G.solar },
];

const DEMO_CHILDREN = [
  { id: 'child-001', name: '민준', grade: '초5', avatar: '🐶', pin: '1234' },
  { id: 'child-002', name: '서연', grade: '초3', avatar: '🦊', pin: '5678' },
];

export default function Index() {
  const navigate = useNavigate();
  const { loginAsParent, setupAccount } = useAuth();
  const [view, setView] = useState<'landing' | 'parent_login' | 'parent_setup' | 'forgot_password'>('landing');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [resetSent, setResetSent]   = useState(false);

  const go = (v: typeof view) => { setView(v); setError(''); setResetSent(false); };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await loginAsParent(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else navigate('/parent');
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !familyName) { setError('모든 항목을 입력해주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    setLoading(true); setError('');
    const result = await setupAccount(email, password, familyName);
    setLoading(false);
    if (result.error) setError(result.error);
    else navigate('/parent');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('이메일을 입력해주세요.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) setError(err.message);
    else setResetSent(true);
  };

  // ── Shared card wrapper ──────────────────────────────────────
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ backgroundColor: G.card, borderRadius: 32, padding: 40,
      boxShadow: 'rgba(4,69,144,0.08) 0 14px 20px 4px', maxWidth: 440, width: '100%', margin: '0 auto' }}>
      {children}
    </div>
  );

  // ── Non-landing views ────────────────────────────────────────
  if (view !== 'landing') {
    return (
      <div style={{ backgroundColor: G.canvas, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
        {/* Mini nav */}
        <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => go('landing')} style={{ display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>📖</span>
            <span style={{ color: G.ink, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>공부 플래너</span>
          </button>
          <button onClick={() => go('landing')} style={{ ...ghostPill, padding: '8px 18px', fontSize: 13 }}>
            ← 돌아가기
          </button>
        </nav>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          {/* ── 부모 로그인 ── */}
          {view === 'parent_login' && (
            <Card>
              <h2 style={{ color: G.ink, fontSize: 24, fontWeight: 500, letterSpacing: '-0.48px', marginBottom: 6 }}>부모님 로그인</h2>
              <p style={{ color: G.graphite, fontSize: 14, marginBottom: 28 }}>이메일과 비밀번호를 입력하세요</p>
              <form onSubmit={handleParentLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="email" placeholder="이메일" value={email}
                  onChange={e => setEmail(e.target.value)} style={inputStyle} />
                <input type="password" placeholder="비밀번호" value={password}
                  onChange={e => setPassword(e.target.value)} style={inputStyle} />
                {error && <p style={{ color: '#e53e3e', fontSize: 13 }}>{error}</p>}
                <button type="submit" disabled={loading} style={{ ...darkPill, justifyContent: 'center', marginTop: 4, opacity: loading ? 0.6 : 1 }}>
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, paddingTop: 20,
                borderTop: '1px solid rgba(10,13,18,0.08)' }}>
                <button onClick={() => go('forgot_password')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.fog, fontSize: 13, letterSpacing: '-0.01em' }}>
                  비밀번호를 잊으셨나요?
                </button>
                <button onClick={() => go('parent_setup')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.iris, fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  처음 사용하시나요? 계정 만들기 →
                </button>
              </div>
            </Card>
          )}

          {/* ── 계정 만들기 ── */}
          {view === 'parent_setup' && (
            <Card>
              <h2 style={{ color: G.ink, fontSize: 24, fontWeight: 500, letterSpacing: '-0.48px', marginBottom: 6 }}>계정 만들기</h2>
              <p style={{ color: G.graphite, fontSize: 14, marginBottom: 28 }}>우리 가족 전용 학습 공간을 설정해요</p>
              <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="text" placeholder="가족 이름 (예: 김씨 가족)" value={familyName}
                  onChange={e => setFamilyName(e.target.value)} style={inputStyle} />
                <input type="email" placeholder="부모님 이메일" value={email}
                  onChange={e => setEmail(e.target.value)} style={inputStyle} />
                <input type="password" placeholder="비밀번호 (6자 이상)" value={password}
                  onChange={e => setPassword(e.target.value)} style={inputStyle} />
                {error && <p style={{ color: '#e53e3e', fontSize: 13 }}>{error}</p>}
                <button type="submit" disabled={loading} style={{ ...darkPill, justifyContent: 'center', marginTop: 4, opacity: loading ? 0.6 : 1 }}>
                  {loading ? '생성 중...' : '가족 계정 만들기 🎉'}
                </button>
              </form>
              <p style={{ color: G.fog, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
                {isSupabaseConfigured ? '데이터가 클라우드에 안전하게 저장됩니다 ☁️' : 'Supabase 설정 후 클라우드 저장 가능'}
              </p>
            </Card>
          )}

          {/* ── 비밀번호 재설정 ── */}
          {view === 'forgot_password' && (
            <Card>
              <h2 style={{ color: G.ink, fontSize: 24, fontWeight: 500, letterSpacing: '-0.48px', marginBottom: 6 }}>비밀번호 재설정</h2>
              <p style={{ color: G.graphite, fontSize: 14, marginBottom: 28 }}>가입한 이메일로 재설정 링크를 보내드려요</p>
              {resetSent ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ fontSize: 48, marginBottom: 16 }}>📬</p>
                  <p style={{ color: G.ink, fontWeight: 500, fontSize: 16, marginBottom: 8 }}>이메일을 보냈어요!</p>
                  <p style={{ color: G.graphite, fontSize: 13, lineHeight: 1.6 }}>
                    <span style={{ color: G.iris, fontWeight: 500 }}>{email}</span>으로<br />재설정 링크를 전송했습니다.
                  </p>
                  <button onClick={() => go('parent_login')} style={{ ...ghostPill, marginTop: 24, padding: '10px 24px', fontSize: 13 }}>
                    로그인으로 돌아가기
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input type="email" placeholder="가입한 이메일" value={email}
                    onChange={e => setEmail(e.target.value)} style={inputStyle} />
                  {error && <p style={{ color: '#e53e3e', fontSize: 13 }}>{error}</p>}
                  <button type="submit" disabled={loading} style={{ ...darkPill, justifyContent: 'center', marginTop: 4, opacity: loading ? 0.6 : 1 }}>
                    {loading ? '전송 중...' : '재설정 링크 보내기'}
                  </button>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── Landing page ─────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: G.canvas, minHeight: '100vh',
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: 'rgba(235,245,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,105,224,0.08)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>📖</span>
            <span style={{ color: G.ink, fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>공부 플래너</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('/child')} style={{ ...ghostPill, padding: '8px 18px', fontSize: 13 }}>
              자녀 로그인
            </button>
            <button onClick={() => go('parent_login')} style={{ ...darkPill, padding: '9px 20px', fontSize: 13 }}>
              부모님 로그인
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 24px 64px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 72, marginBottom: 24, display: 'block' }}>📚</div>
        <h1 style={{ color: G.ink, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-1.44px',
          fontSize: 'clamp(40px, 8vw, 72px)', marginBottom: 24, margin: '0 auto 24px' }}>
          가족이 함께<br />만드는 학습 습관
        </h1>
        <p style={{ color: G.graphite, fontSize: 18, lineHeight: 1.6, letterSpacing: '-0.18px',
          marginBottom: 48, maxWidth: 520, margin: '0 auto 48px' }}>
          공부 노트 사진 한 장이면 충분해요.<br />
          AI가 내용을 분석하고, 부모님께 실시간으로 알려드려요.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => go('parent_login')} style={darkPill}>
            부모님으로 시작하기
          </button>
          <button onClick={() => navigate('/child')} style={ghostPill}>
            자녀로 로그인
          </button>
        </div>
      </section>

      {/* Feature tiles */}
      <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ backgroundColor: f.bg, borderRadius: 32, padding: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <p style={{ color: G.ink, fontWeight: 500, fontSize: 16, letterSpacing: '-0.01em', marginBottom: 8 }}>{f.title}</p>
              <p style={{ color: G.graphite, fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo section */}
      <section style={{ padding: '0 24px 100px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ backgroundColor: G.card, borderRadius: 32, padding: 40,
          boxShadow: 'rgba(4,69,144,0.08) 0 14px 20px 4px' }}>
          <p style={{ color: G.fog, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em',
            textTransform: 'uppercase', marginBottom: 8 }}>✨ 데모 체험</p>
          <p style={{ color: G.ink, fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 24 }}>
            가짜 데이터로 바로 체험해보세요
          </p>

          <button
            onClick={() => loginAsParent('parent@example.com', 'password123').then(() => navigate('/parent'))}
            style={{ ...darkPill, justifyContent: 'center', width: '100%', boxSizing: 'border-box', marginBottom: 12 }}>
            👨‍👩‍👧 부모님 계정 체험 →
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {DEMO_CHILDREN.map(c => (
              <button key={c.id} onClick={() => navigate(`/child/pin/${c.id}`)}
                style={{ backgroundColor: G.canvas, border: '1.5px solid rgba(10,13,18,0.08)',
                  borderRadius: 16, padding: '14px 12px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 28 }}>{c.avatar}</span>
                <span style={{ color: G.ink, fontSize: 14, fontWeight: 500 }}>{c.name}</span>
                <span style={{ color: G.fog, fontSize: 12 }}>{c.grade} · PIN {c.pin}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(10,13,18,0.06)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: G.fog, fontSize: 13 }}>
          © 2026 공부 플래너 — 가족이 함께 만드는 학습 습관
        </p>
      </footer>
    </div>
  );
}
