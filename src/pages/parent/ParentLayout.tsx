import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const NAV = [
  { path: '/parent',          label: '대시보드', icon: '◼' },
  { path: '/parent/children', label: '자녀 관리', icon: '◼' },
  { path: '/parent/schedule', label: '학습 일정', icon: '◼' },
  { path: '/parent/reports',  label: '리포트',   icon: '◼' },
  { path: '/parent/security', label: '활동 로그', icon: '◼' },
  { path: '/parent/settings', label: '설정',     icon: '◼' },
];

const NAV_EMOJI: Record<string, string> = {
  '/parent':          '📊',
  '/parent/children': '👧',
  '/parent/schedule': '📅',
  '/parent/reports':  '📈',
  '/parent/security': '🔒',
  '/parent/settings': '⚙️',
};

export default function ParentLayout() {
  const { parentUser, family, logout, isDemo } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/parent' ? pathname === '/parent' : pathname.startsWith(path);

  return (
    <div className="min-h-screen flex flex-col"
      style={{ backgroundColor: dark ? '#0f172a' : '#f8faff', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

      {/* 데모 배너 */}
      {isDemo && (
        <div style={{ backgroundColor: '#fff9e0', borderBottom: '1px solid rgba(10,13,18,0.06)',
          padding: '6px 24px', fontSize: 12, textAlign: 'center', color: '#92400e', letterSpacing: '-0.01em' }}>
          ✏️ 데모 모드 — 가짜 데이터입니다.
        </div>
      )}

      {/* 헤더 */}
      <header className="sticky top-0 z-40 transition-colors duration-200"
        style={{ backgroundColor: dark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,255,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(10,13,18,0.06)',
          padding: '0 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* 왼쪽: 햄버거 + 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: dark ? '#94a3b8' : '#535862', fontSize: 18, lineHeight: 1 }}>
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📖</span>
              <div>
                <p style={{ color: dark ? '#f1f5f9' : '#0a0d12', fontWeight: 600,
                  fontSize: 14, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {family?.name ?? '공부 플래너'}
                </p>
                <p style={{ color: dark ? '#64748b' : '#93979f', fontSize: 11, letterSpacing: '-0.01em' }}>
                  {parentUser?.email}
                </p>
              </div>
            </div>
          </div>

          {/* 오른쪽: 다크모드 + 로그아웃 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggle}
              style={{ width: 34, height: 34, borderRadius: 9999,
                border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(10,13,18,0.1)',
                backgroundColor: 'transparent', cursor: 'pointer', fontSize: 15,
                color: dark ? '#94a3b8' : '#535862', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {dark ? '☀️' : '🌙'}
            </button>
            <button onClick={logout}
              style={{ borderRadius: 9999,
                border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(10,13,18,0.1)',
                backgroundColor: 'transparent', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
                color: dark ? '#64748b' : '#93979f',
                padding: '6px 14px' }}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* 사이드바 오버레이 (모바일) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 lg:hidden"
            style={{ backgroundColor: 'rgba(10,13,18,0.4)' }}
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* 사이드바 */}
        <aside className={`fixed lg:static top-0 left-0 h-full z-40 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          style={{ width: 220,
            backgroundColor: dark ? '#0f172a' : '#ffffff',
            borderRight: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(10,13,18,0.06)',
            display: 'flex', flexDirection: 'column' }}>

          <nav style={{ padding: '72px 12px 24px 12px', flex: 1 }} className="lg:pt-6">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV.map(item => {
                const active = isActive(item.path);
                return (
                  <button key={item.path}
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 12, border: 'none',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      fontSize: 14, fontWeight: active ? 500 : 400,
                      letterSpacing: '-0.01em',
                      backgroundColor: active
                        ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,13,18,0.05)')
                        : 'transparent',
                      color: active
                        ? (dark ? '#f1f5f9' : '#0a0d12')
                        : (dark ? '#64748b' : '#93979f'),
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{NAV_EMOJI[item.path]}</span>
                    {item.label}
                    {active && (
                      <span style={{ marginLeft: 'auto', width: 5, height: 5,
                        borderRadius: '50%', backgroundColor: dark ? '#60a5fa' : '#0069e0' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* 본문 */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
