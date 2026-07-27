import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getSettings as localGetSettings, saveSettings as localSaveSettings } from '../../data/storage';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getSettings, saveSettings } from '../../lib/db';
import type { AppSettings } from '../../types';

const DEFAULT_SETTINGS: AppSettings = {
  image_retention_days: 90,
  notifications_email: true,
  lock_after_failures: 3,
  require_page_info: true,
  parent_email: '',
};

export default function Settings() {
  const { family, isDemo } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [pwForm, setPwForm]     = useState({ next: '', confirm: '' });
  const [pwMsg, setPwMsg]       = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setSettings(DEFAULT_SETTINGS);
    } else if (family?.id && isSupabaseConfigured) {
      setSettings(await getSettings(family.id));
    } else if (family?.id) {
      setSettings(localGetSettings());
    }
    setLoading(false);
  }, [family, isDemo]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    if (isDemo || !family?.id) return;
    setSaving(true);
    if (isSupabaseConfigured) {
      await saveSettings(family.id, settings);
    } else {
      localSaveSettings(settings);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChangePw = async () => {
    if (isDemo || !isSupabaseConfigured) return;
    if (pwForm.next.length < 6) { setPwMsg('비밀번호는 6자 이상이어야 해요'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg('비밀번호가 일치하지 않아요'); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    if (error) {
      setPwMsg(`오류: ${error.message}`);
    } else {
      setPwMsg('비밀번호가 변경됐어요 ✅');
      setPwForm({ next: '', confirm: '' });
    }
    setChangingPw(false);
  };

  const copyFamilyCode = async () => {
    if (!family?.id) return;
    await navigator.clipboard.writeText(family.id);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const S = <T extends keyof AppSettings>(key: T, val: AppSettings[T]) => {
    setSettings(s => ({ ...s, [key]: val }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-300 dark:bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">설정</h1>
        <p className="text-gray-400 dark:text-slate-500 text-sm">앱 환경을 설정해요</p>
      </div>

      {isDemo && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl px-4 py-3 text-yellow-700 dark:text-yellow-300 text-sm">
          ✏️ 데모 모드에서는 설정을 저장할 수 없어요
        </div>
      )}

      {/* 가족 코드 */}
      {family?.id && !isDemo && (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔑</span>
            <h2 className="font-bold text-white">가족 코드</h2>
          </div>
          <p className="text-blue-100 text-xs mb-3">
            자녀 기기에서 처음 로그인할 때 이 코드를 입력해야 해요
          </p>
          <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-3 flex items-center justify-between gap-2">
            <p className="font-mono text-sm text-white break-all leading-relaxed">{family.id}</p>
            <button
              onClick={copyFamilyCode}
              className="flex-shrink-0 bg-white/30 hover:bg-white/40 active:bg-white/50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              {codeCopied ? '✅ 복사됨' : '📋 복사'}
            </button>
          </div>
          <p className="text-blue-200 text-xs mt-2">
            자녀 → 로그인 → 가족 코드 입력 화면에 붙여넣기 하세요
          </p>
        </div>
      )}

      {/* 학습 설정 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200">📚 학습 설정</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">페이지 정보 필수</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">공부 기록 제출 시 페이지 정보 필수 여부</p>
          </div>
          <button onClick={() => S('require_page_info', !settings.require_page_info)}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.require_page_info ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.require_page_info ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* 이미지 보관 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200">🖼️ 이미지 보관</h2>
        <div>
          <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">이미지 보관 기간</label>
          <select value={settings.image_retention_days}
            onChange={e => S('image_retention_days', Number(e.target.value))}
            className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 transition-colors">
            {[30, 60, 90, 180, 365].map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </div>
      </div>

      {/* 보안 설정 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200">🔒 보안 설정</h2>
        <div>
          <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">PIN 실패 잠금 횟수</label>
          <select value={settings.lock_after_failures}
            onChange={e => S('lock_after_failures', Number(e.target.value))}
            className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 transition-colors">
            <option value={3}>3회 실패 시 잠금</option>
            <option value={5}>5회 실패 시 잠금</option>
          </select>
        </div>
      </div>

      {/* 알림 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200">🔔 알림</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">이메일 알림</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">자녀가 제출 시 이메일 알림 (Gemini API 키 필요)</p>
          </div>
          <button onClick={() => S('notifications_email', !settings.notifications_email)}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.notifications_email ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.notifications_email ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">알림 받을 이메일</label>
          <input type="email" value={settings.parent_email}
            onChange={e => S('parent_email', e.target.value)}
            placeholder="부모님 이메일 주소"
            className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
        </div>
      </div>

      {/* 비밀번호 변경 */}
      {!isDemo && isSupabaseConfigured && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-3 transition-colors duration-300">
          <h2 className="font-bold text-gray-700 dark:text-slate-200">🔑 비밀번호 변경</h2>
          <input type="password" placeholder="새 비밀번호 (6자 이상)" value={pwForm.next}
            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
            className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
          <input type="password" placeholder="새 비밀번호 확인" value={pwForm.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 transition-colors" />
          {pwMsg && <p className={`text-sm ${pwMsg.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{pwMsg}</p>}
          <button onClick={handleChangePw} disabled={changingPw}
            className="w-full border dark:border-slate-600 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50">
            {changingPw ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      )}

      {/* Gemini API 키 안내 */}
      <div className="bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800 transition-colors duration-300">
        <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-2">🤖 Gemini AI 연동</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
          프로젝트 루트의 <code className="bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 text-xs">.env</code> 파일에
          Gemini API 키를 추가하면 실제 AI 사진 인식이 활성화됩니다.
        </p>
        <div className="bg-white dark:bg-slate-700 rounded-xl p-3 font-mono text-xs text-gray-600 dark:text-slate-300 border dark:border-slate-600">
          VITE_GEMINI_API_KEY=AIzaSy...
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-blue-500 dark:text-blue-400 text-sm hover:underline">
          Google AI Studio에서 키 발급 →
        </a>
      </div>

      {/* Supabase 연동 안내 */}
      {!isSupabaseConfigured && !isDemo && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800 transition-colors duration-300">
          <h2 className="font-bold text-gray-700 dark:text-slate-200 mb-2">☁️ 클라우드 연동 (Supabase)</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
            .env 파일에 Supabase 환경 변수를 추가하면 자녀 폰과 부모 폰 간에 실시간 데이터 공유가 가능합니다.
          </p>
          <div className="bg-white dark:bg-slate-700 rounded-xl p-3 font-mono text-xs text-gray-600 dark:text-slate-300 border dark:border-slate-600 space-y-1">
            <p>VITE_SUPABASE_URL=https://your-project.supabase.co</p>
            <p>VITE_SUPABASE_ANON_KEY=eyJ...</p>
          </div>
        </div>
      )}

      {/* 저장 버튼 */}
      {!isDemo && (
        <button onClick={handleSave} disabled={saving}
          className={`w-full py-3 rounded-2xl font-bold transition shadow disabled:opacity-50 ${saved ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
          {saving ? '저장 중...' : saved ? '✅ 저장됐어요!' : '설정 저장'}
        </button>
      )}
    </div>
  );
}
