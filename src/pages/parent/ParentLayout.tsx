import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const NAV = [
  { path: '/parent',          label: '대시보드', icon: '📊' },
  { path: '/parent/children', label: '자녀 관리', icon: '👶' },
  { path: '/parent/schedule', label: '학습 일정', icon: '📅' },
  { path: '/parent/reports',  label: '리포트',   icon: '📄' },
  { path: '/parent/security', label: '활동 로그', icon: '🔒' },
  { path: '/parent/settings', label: '설정',     icon: '⚙️' },
];

export default function ParentLayout() {
  const { parentUser, family, logout, isDemo } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/parent' ? pathname === '/parent' : pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
      {isDemo && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 px-4 py-1.5 text-yellow-700 dark:text-yellow-300 text-xs text-center">
          ✏️ 데모 모드 — 가짜 데이터입니다.
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white text-xl"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <div>
              <p className="font-bold text-gray-800 dark:text-white text-sm leading-tight">{family?.name ?? '공부 플래너'}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{parentUser?.email}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 다크모드 토글 */}
          <button
            onClick={toggle}
            title={dark ? '라이트 모드' : '다크 모드'}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition text-base"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={logout}
            className="text-xs text-gray-400 dark:text-slate-400 hover:text-red-400 dark:hover:text-red-400 transition px-3 py-1.5 border dark:border-slate-600 rounded-lg"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 사이드바 */}
        <>
          {sidebarOpen && (
            <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}
          <aside className={`
            fixed lg:static top-0 left-0 h-full lg:h-auto z-40
            w-56 bg-white dark:bg-slate-800 border-r dark:border-slate-700 flex flex-col shadow-lg lg:shadow-none
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <div className="p-4 pt-16 lg:pt-4 flex-1">
              <nav className="space-y-1">
                {NAV.map(item => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                      ${isActive(item.path)
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-white'
                      }`}
                  >
                    <span>{item.icon}</span> {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        </>

        {/* 본문 */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
