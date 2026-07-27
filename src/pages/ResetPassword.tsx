import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 이미 세션이 수립됐다면(App.tsx에서 이벤트 처리 후 리다이렉트) 즉시 준비 완료
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    // 직접 링크로 접근한 경우 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) setError(err.message);
    else setDone(true);
  };

  const inputCls = 'w-full border dark:border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-6 border dark:border-slate-700">
        <div className="text-center mb-5">
          <span className="text-4xl">🔐</span>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white mt-2">새 비밀번호 설정</h1>
        </div>

        {done ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold text-gray-800 dark:text-white mb-1">비밀번호가 변경됐어요!</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">새 비밀번호로 로그인해 주세요.</p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition">
              로그인 화면으로
            </button>
          </div>
        ) : !ready ? (
          <div className="text-center py-6">
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-3 h-3 bg-blue-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">링크를 확인하는 중...</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              이메일의 링크를 통해 접근해 주세요.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="password" placeholder="새 비밀번호 (6자 이상)" value={password}
              onChange={e => setPassword(e.target.value)} className={inputCls} />
            <input type="password" placeholder="비밀번호 확인" value={confirm}
              onChange={e => setConfirm(e.target.value)} className={inputCls} />
            {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50">
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
