import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { path: '/parent',          label: '대시보드',        icon: '📊' },
  { path: '/parent/children', label: '자녀 관리',        icon: '👶' },
  { path: '/parent/schedule', label: '학습 일정',        icon: '📅' },
  { path: '/parent/reports',  label: '리포트',           icon: '📄' },
  { path: '/parent/security', label: '활동 로그',        icon: '🔒' },
  { path: '/parent/settings', label: '설정',             icon: '⚙️' },
];

export default function ParentLayout() {
  const { parentUser, family, logout, isDemo } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/parent' ? pathname === '/parent' : pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {isDemo && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 text-yellow-700 text-xs text-center">
          ✏️ 데모 모드 — 가짜 데이터입니다. 실제 로그인 시 데이터가 저장됩니다.
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-500 hover:text-gray-800 text-xl">
            ☰
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">{family?.name ?? '공부 플래너'}</p>
              <p className="text-xs text-gray-400">{parentUser?.email}</p>
            </div>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-red-400 transition px-3 py-1.5 border rounded-lg">
          로그아웃
        </button>
      </header>

      <div className="flex flex-1">
        {/* 사이드바 */}
        <>
          {sidebarOpen && (
            <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}
          <aside className={`
            fixed lg:static top-0 left-0 h-full lg:h-auto z-40
            w-56 bg-white border-r flex flex-col shadow-lg lg:shadow-none
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
                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
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
