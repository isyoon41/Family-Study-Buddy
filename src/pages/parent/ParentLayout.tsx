import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const NAV = [
  { path: '/parent',          label: '대시보드', icon: '📊' },
  { path: '/parent/children', label: '자녀 관리', icon: '👧' },
  { path: '/parent/schedule', label: '학습 일정', icon: '📅' },
  { path: '/parent/reports',  label: '리포트',   icon: '📈' },
  { path: '/parent/security', label: '활동 로그', icon: '🔒' },
  { path: '/parent/settings', label: '설정',     icon: '⚙️' },
];

export default function ParentLayout() {
  const { parentUser, family, logout, isDemo } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (p: string) => p === '/parent' ? pathname === '/parent' : pathname.startsWith(p);

  const G   = '#58CC02';
  const GD  = '#4DA700';
  const bg  = dark ? '#0e1a0e' : '#f4fff0';
  const sidebarBg = dark ? '#111a11' : '#ffffff';
  const headerBg  = dark ? 'rgba(14,26,14,0.95)' : 'rgba(244,255,240,0.95)';
  const border     = dark ? 'rgba(255,255,255,0.07)' : '#e5e5e5';
  const navText    = dark ? '#aaa' : '#4B4B4B';
  const navActiveBg = dark ? 'rgba(88,204,2,.15)' : '#efffdc';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      backgroundColor: bg,
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif' }}>

      {/* 데모 배너 */}
      {isDemo && (
        <div style={{ backgroundColor: '#fff9e0', borderBottom: `2px solid #ffe58a`,
          padding: '6px 24px', fontSize: 12, textAlign: 'center', color: '#8C6900', fontWeight: 700 }}>
          ✏️ 데모 모드 — 가짜 데이터입니다.
        </div>
      )}

      {/* 헤더 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        backgroundColor: headerBg, backdropFilter: 'blur(16px)',
        borderBottom: `2px solid ${border}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 58,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* 햄버거 */}
            <button onClick={() => setOpen(!open)} className="lg:hidden"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: navText, lineHeight: 1 }}>☰</button>

            {/* 로고 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: G,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, boxShadow: `0 3px 0 ${GD}` }}>📖</div>
              <div>
                <p style={{ color: dark ? '#f5f5f5' : '#1C1C1E', fontWeight: 800,
                  fontSize: 14, lineHeight: 1.2, letterSpacing: '-.02em' }}>
                  {family?.name ?? '공부 플래너'}
                </p>
                <p style={{ color: dark ? '#555' : '#AFAFAF', fontSize: 11, fontWeight: 600 }}>
                  {parentUser?.email}
                </p>
              </div>
            </div>
          </div>

          {/* 헤더 오른쪽 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggle} style={{
              width: 36, height: 36, borderRadius: 9999,
              border: `2px solid ${border}`, backgroundColor: 'transparent',
              cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {dark ? '☀️' : '🌙'}
            </button>
            <button onClick={logout} style={{
              borderRadius: 9999, border: `2px solid ${border}`,
              backgroundColor: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
              color: navText, padding: '7px 14px',
            }}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* 오버레이 */}
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,.4)' }}
            onClick={() => setOpen(false)} />
        )}

        {/* 사이드바 */}
        <aside className={`fixed lg:static top-0 left-0 h-full z-40 transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          style={{ width: 220, backgroundColor: sidebarBg,
            borderRight: `2px solid ${border}`, display: 'flex', flexDirection: 'column' }}>

          <nav style={{ padding: '72px 10px 24px 10px', flex: 1 }} className="lg:pt-5">
            {NAV.map(item => {
              const active = isActive(item.path);
              return (
                <button key={item.path}
                  onClick={() => { navigate(item.path); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', borderRadius: 14, border: 'none',
                    marginBottom: 2, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 14, fontWeight: active ? 800 : 600,
                    letterSpacing: active ? '-.01em' : '0',
                    backgroundColor: active ? navActiveBg : 'transparent',
                    color: active ? G : navText,
                    transition: 'all .15s',
                  }}>
                  <span style={{ fontSize: 17, lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {active && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: G, boxShadow: `0 2px 0 ${GD}` }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 하단 스트릭 미니 위젯 */}
          <div style={{ margin: 12, marginBottom: 16, borderRadius: 16,
            backgroundColor: dark ? 'rgba(88,204,2,.1)' : '#efffdc',
            border: `2px solid ${dark ? 'rgba(88,204,2,.2)' : '#b8e890'}`,
            padding: '12px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: G,
              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              이번 주
            </p>
            <p style={{ fontSize: 13, fontWeight: 800, color: dark ? '#ccc' : '#1C1C1E' }}>
              🔥 연속 달성 확인 →
            </p>
          </div>
        </aside>

        {/* 본문 */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
