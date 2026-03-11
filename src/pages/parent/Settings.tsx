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

  const S = <T extends keyof AppSettings>(key: T, val: AppSettings[T]) => {
    setSettings(s => ({ ...s, [key]: val }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-300 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">설정</h1>
        <p className="text-gray-400 text-sm">앱 환경을 설정해요</p>
      </div>

      {isDemo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-yellow-700 text-sm">
          ✏️ 데모 모드에서는 설정을 저장할 수 없어요
        </div>
      )}

      {/* 학습 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-700">📚 학습 설정</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">페이지 정보 필수</p>
            <p className="text-xs text-gray-400">공부 기록 제출 시 페이지 정보 필수 여부</p>
          </div>
          <button onClick={() => S('require_page_info', !settings.require_page_info)}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.require_page_info ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.require_page_info ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* 이미지 보관 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-700">🖼️ 이미지 보관</h2>
        <div>
          <label className="text-sm text-gray-600 block mb-1">이미지 보관 기간</label>
          <select value={settings.image_retention_days}
            onChange={e => S('image_retention_days', Number(e.target.value))}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none">
            {[30, 60, 90, 180, 365].map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </div>
      </div>

      {/* 보안 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-700">🔒 보안 설정</h2>
        <div>
          <label className="text-sm text-gray-600 block mb-1">PIN 실패 잠금 횟수</label>
          <select value={settings.lock_after_failures}
            onChange={e => S('lock_after_failures', Number(e.target.value))}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none">
            <option value={3}>3회 실패 시 잠금</option>
            <option value={5}>5회 실패 시 잠금</option>
          </select>
        </div>
      </div>

      {/* 알림 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-700">🔔 알림</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">이메일 알림</p>
            <p className="text-xs text-gray-400">자녀가 제출 시 이메일 알림 (Gemini API 키 필요)</p>
          </div>
          <button onClick={() => S('notifications_email', !settings.notifications_email)}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.notifications_email ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.notifications_email ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">알림 받을 이메일</label>
          <input type="email" value={settings.parent_email}
            onChange={e => S('parent_email', e.target.value)}
            placeholder="부모님 이메일 주소"
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>

      {/* 비밀번호 변경 (Supabase 모드에서만) */}
      {!isDemo && isSupabaseConfigured && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-gray-700">🔑 비밀번호 변경</h2>
          <input type="password" placeholder="새 비밀번호 (6자 이상)" value={pwForm.next}
            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <input type="password" placeholder="새 비밀번호 확인" value={pwForm.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          {pwMsg && <p className={`text-sm ${pwMsg.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>}
          <button onClick={handleChangePw} disabled={changingPw}
            className="w-full border border-gray-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
            {changingPw ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      )}

      {/* Gemini API 키 안내 */}
      <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-5 border border-blue-100">
        <h2 className="font-bold text-gray-700 mb-2">🤖 Gemini AI 연동</h2>
        <p className="text-sm text-gray-600 mb-3">
          프로젝트 루트의 <code className="bg-white px-1.5 py-0.5 rounded text-blue-600 text-xs">.env</code> 파일에
          Gemini API 키를 추가하면 실제 AI 사진 인식이 활성화됩니다.
        </p>
        <div className="bg-white rounded-xl p-3 font-mono text-xs text-gray-600 border">
          VITE_GEMINI_API_KEY=AIzaSy...
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-blue-500 text-sm hover:underline">
          Google AI Studio에서 키 발급 →
        </a>
      </div>

      {/* Supabase 연동 안내 */}
      {!isSupabaseConfigured && !isDemo && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
          <h2 className="font-bold text-gray-700 mb-2">☁️ 클라우드 연동 (Supabase)</h2>
          <p className="text-sm text-gray-600 mb-3">
            .env 파일에 Supabase 환경 변수를 추가하면 자녀 폰과 부모 폰 간에 실시간 데이터 공유가 가능합니다.
          </p>
          <div className="bg-white rounded-xl p-3 font-mono text-xs text-gray-600 border space-y-1">
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
