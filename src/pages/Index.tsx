import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const MINI_CARDS = [
  { bg: 'from-blue-500 to-purple-500', title: '자녀 대시보드', icon: '🐶', lines: ['민준 · 초5', '✅ 수학 p.112~120', '✅ 국어 독해 p.34~36', '⏳ 영어 단어 20개'] },
  { bg: 'from-green-400 to-teal-500', title: '오늘의 계획표', icon: '📚', lines: ['수학 ████████ 80%', '국어 ██████ 60%', '영어 ████ 40%'] },
  { bg: 'from-yellow-400 to-orange-400', title: '부모님 승인', icon: '⭐', lines: ['잘했어요! ⭐', '민준이 오늘도 최고!', '🔥 연속 5일 달성'] },
  { bg: 'from-gray-800 to-gray-900', title: 'AI 사진 인식', icon: '📷', lines: ['사진 → 텍스트 자동 추출', '✨ Gemini AI 분석 중...', '수학 · 국어 · 영어'] },
  { bg: 'from-pink-500 to-purple-600', title: '주간 리포트', icon: '📊', lines: ['이번 주 출석률 92%', '총 공부 시간 14h', '과목별 진도 차트'] },
  { bg: 'from-orange-400 to-rose-400', title: '부모님 메시지', icon: '💬', lines: ['💪 오늘도 화이팅!', '🎉 100점 축하해!', '⭐ 정말 잘했어요'] },
  { bg: 'from-sky-400 to-blue-500', title: 'PIN 로그인', icon: '🔑', lines: ['●●●●', '4자리 PIN으로', '쉽게 로그인'] },
  { bg: 'from-emerald-600 to-green-700', title: '교재 진도 관리', icon: '📖', lines: ['수학의 정석 120/350p', '국어 독해 36/160p', '진도율 34%'] },
];

export default function Index() {
  const navigate = useNavigate();
  const { loginAsParent } = useAuth();
  const { dark, toggle } = useTheme();
  const [view, setView] = useState<'landing' | 'parent_login' | 'parent_setup' | 'forgot_password'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { setupAccount } = useAuth();

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

  const inputCls = 'w-full border dark:border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── 왼쪽 패널 (카드 그리드 배경) ── */}
      <div className="lg:w-2/5 bg-gradient-to-br from-blue-600 via-teal-500 to-emerald-500 relative overflow-hidden min-h-[260px] lg:min-h-screen">
        <div className="absolute inset-[-20%] rotate-[-4deg] scale-110 overflow-hidden opacity-30">
          <div className="grid grid-cols-2 gap-3 p-4">
            {MINI_CARDS.map((card, i) => (
              <div key={i} className={`bg-gradient-to-br ${card.bg} rounded-2xl p-3 shadow-lg`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xl">{card.icon}</span>
                  <p className="text-white text-xs font-bold truncate">{card.title}</p>
                </div>
                {card.lines.map((l, j) => (
                  <p key={j} className="text-white/80 text-xs truncate leading-5">{l}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/70 via-teal-500/50 to-emerald-500/60" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full py-10 px-6 text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-lg">📖</div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">공부 플래너</h1>
          <p className="text-white/80 text-sm mb-6">가족이 함께 만드는 학습 습관</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['📸 사진 한 장으로 기록', '✅ 부모님 바로 확인', '🤖 AI 자동 분석', '📊 과목별 리포트'].map(t => (
              <span key={t} className="bg-white/20 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 오른쪽 패널 ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-300 relative">
        {/* 다크모드 토글 */}
        <button
          onClick={toggle}
          title={dark ? '라이트 모드' : '다크 모드'}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition text-base"
        >
          {dark ? '☀️' : '🌙'}
        </button>

        <div className="w-full max-w-sm">

          {/* 랜딩 */}
          {view === 'landing' && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-slate-900/50 p-6 animate-fade-in border dark:border-slate-700 transition-colors duration-300">
              <h2 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-1">시작하기</h2>
              <p className="text-gray-400 dark:text-slate-500 text-sm text-center mb-5">누구로 시작할까요?</p>

              <button
                onClick={() => navigate('/child')}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-100 dark:border-slate-700 rounded-2xl hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition mb-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎒</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 dark:text-white">자녀로 로그인</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs">PIN 번호 사용</p>
                  </div>
                </div>
                <span className="text-gray-400 dark:text-slate-500">›</span>
              </button>

              <button
                onClick={() => setView('parent_login')}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-100 dark:border-slate-700 rounded-2xl hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition mb-5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👨‍👩‍👧</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 dark:text-white">부모님으로 로그인</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs">이메일과 비밀번호 사용</p>
                  </div>
                </div>
                <span className="text-gray-400 dark:text-slate-500">›</span>
              </button>

              {/* 데모 체험 */}
              <div className="border-t dark:border-slate-700 pt-4">
                <p className="text-center text-gray-400 dark:text-slate-500 text-xs mb-3">✨ 가짜 데이터로 바로 체험</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 space-y-2 border dark:border-blue-800/50">
                  <button
                    onClick={() => loginAsParent('parent@example.com', 'password123').then(() => navigate('/parent'))}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-600 transition shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👨‍👩‍👧</span>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-800 dark:text-white">부모님 계정 체험</p>
                        <p className="text-xs text-gray-400 dark:text-slate-400">승인·리포트·교재관리</p>
                      </div>
                    </div>
                    <span className="text-gray-400 dark:text-slate-400 text-sm">→</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'child-001', name: '민준', grade: '초5', avatar: '🐶', pin: '1234' },
                      { id: 'child-002', name: '서연', grade: '초3', avatar: '🦊', pin: '5678' }].map(c => (
                      <button key={c.id} onClick={() => navigate(`/child/pin/${c.id}`)}
                        className="flex flex-col items-center p-3 bg-white dark:bg-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-600 transition shadow-sm">
                        <span className="text-3xl">{c.avatar}</span>
                        <p className="font-bold text-sm text-gray-800 dark:text-white mt-1">{c.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-400">{c.grade} · PIN {c.pin}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 부모님 로그인 */}
          {view === 'parent_login' && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-slate-900/50 p-6 animate-fade-in border dark:border-slate-700 transition-colors duration-300">
              <button onClick={() => { setView('landing'); setError(''); }}
                className="text-gray-400 dark:text-slate-500 mb-4 hover:text-gray-600 dark:hover:text-slate-300 transition text-sm flex items-center gap-1">
                ← 뒤로
              </button>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">부모님 로그인</h2>
              <p className="text-gray-400 dark:text-slate-500 text-sm mb-4">이메일과 비밀번호를 입력하세요</p>
              <form onSubmit={handleParentLogin} className="space-y-3">
                <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50">
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>
              <div className="mt-3 flex flex-col gap-1.5 text-center text-sm">
                <button onClick={() => { setView('forgot_password'); setError(''); setResetSent(false); }}
                  className="text-gray-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
                  비밀번호를 잊으셨나요?
                </button>
                <button onClick={() => { setView('parent_setup'); setError(''); }}
                  className="text-blue-500 dark:text-blue-400 hover:underline">
                  처음 사용하시나요? 계정 만들기 →
                </button>
              </div>
            </div>
          )}

          {/* 비밀번호 재설정 */}
          {view === 'forgot_password' && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-slate-900/50 p-6 animate-fade-in border dark:border-slate-700 transition-colors duration-300">
              <button onClick={() => { setView('parent_login'); setError(''); setResetSent(false); }}
                className="text-gray-400 dark:text-slate-500 mb-4 hover:text-gray-600 dark:hover:text-slate-300 transition text-sm flex items-center gap-1">
                ← 뒤로
              </button>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">비밀번호 재설정</h2>
              <p className="text-gray-400 dark:text-slate-500 text-sm mb-4">
                가입한 이메일을 입력하면 재설정 링크를 보내드려요
              </p>
              {resetSent ? (
                <div className="text-center py-6">
                  <p className="text-4xl mb-3">📬</p>
                  <p className="font-bold text-gray-800 dark:text-white mb-1">이메일을 보냈어요!</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    <span className="font-medium text-blue-500">{email}</span>으로<br />
                    재설정 링크를 전송했습니다.<br />
                    받은 편지함을 확인해 주세요.
                  </p>
                  <button onClick={() => { setView('parent_login'); setResetSent(false); }}
                    className="mt-5 text-sm text-blue-500 dark:text-blue-400 hover:underline">
                    로그인 화면으로 돌아가기
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <input type="email" placeholder="가입한 이메일" value={email}
                    onChange={e => setEmail(e.target.value)} className={inputCls} />
                  {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50">
                    {loading ? '전송 중...' : '재설정 링크 보내기'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 첫 계정 생성 */}
          {view === 'parent_setup' && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-slate-900/50 p-6 animate-fade-in border dark:border-slate-700 transition-colors duration-300">
              <button onClick={() => { setView('parent_login'); setError(''); }}
                className="text-gray-400 dark:text-slate-500 mb-4 hover:text-gray-600 dark:hover:text-slate-300 transition text-sm flex items-center gap-1">
                ← 뒤로
              </button>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">계정 만들기</h2>
              <p className="text-gray-400 dark:text-slate-500 text-sm mb-4">우리 가족 전용 계정을 설정해요</p>
              <form onSubmit={handleSetup} className="space-y-3">
                <input type="text" placeholder="가족 이름 (예: 김씨 가족)" value={familyName} onChange={e => setFamilyName(e.target.value)} className={inputCls} />
                <input type="email" placeholder="부모님 이메일" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                <input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition disabled:opacity-50">
                  {loading ? '생성 중...' : '가족 계정 만들기 🎉'}
                </button>
              </form>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-3 text-center">
                {isSupabaseConfigured ? '데이터가 클라우드에 저장됩니다 ☁️' : 'Supabase 설정 후 클라우드 저장 가능'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
