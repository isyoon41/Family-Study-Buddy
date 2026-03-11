import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_CHILDREN } from '../../data/mockData';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getChildrenPublic } from '../../lib/db';
import { DEVICE_FAMILY_KEY } from '../../contexts/AuthContext';

type SimpleChild = { id: string; name: string; avatar: string; grade: string };

export default function ChildSelect() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<SimpleChild[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [familyCode, setFamilyCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Supabase 미설정 → 항상 데모 모드
      if (!isSupabaseConfigured) {
        setChildren(MOCK_CHILDREN);
        setIsDemo(true);
        setLoading(false);
        return;
      }

      // 기기에 저장된 family ID가 있으면 Supabase에서 실제 자녀 조회
      const savedFamilyId = localStorage.getItem(DEVICE_FAMILY_KEY);
      if (savedFamilyId) {
        const real = await getChildrenPublic(savedFamilyId);
        if (real.length > 0) {
          setChildren(real);
          setIsDemo(false);
          setLoading(false);
          return;
        }
      }

      // 저장된 family ID 없음 → 가족 코드 입력 화면 표시
      setShowCodeInput(true);
      setLoading(false);
    }
    load();
  }, []);

  const handleFamilyCode = async () => {
    setCodeError('');
    const trimmed = familyCode.trim();
    if (!trimmed) return;

    // 가족 코드 = family UUID (또는 앞 8자리)
    // 전체 UUID 길이가 아닌 경우 wildcard 매칭은 지원하지 않으므로 전체 UUID 입력 필요
    setLoading(true);
    const real = await getChildrenPublic(trimmed);
    setLoading(false);

    if (real.length === 0) {
      setCodeError('자녀를 찾을 수 없어요. 가족 코드를 다시 확인해주세요.');
      return;
    }
    localStorage.setItem(DEVICE_FAMILY_KEY, trimmed);
    setChildren(real);
    setIsDemo(false);
    setShowCodeInput(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-300 via-blue-400 to-indigo-500 flex items-center justify-center">
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-white/70 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // 가족 코드 입력 화면
  if (showCodeInput && isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-300 via-blue-400 to-indigo-500 flex flex-col items-center justify-center p-6">
        <button onClick={() => navigate('/')} className="text-white/80 self-start mb-6 flex items-center gap-1 hover:text-white">
          ← 처음으로
        </button>
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-white drop-shadow">가족 코드 입력</h1>
          <p className="text-white/80 mt-1 text-sm">부모님께 가족 코드를 받아서 입력해요</p>
        </div>
        <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-xl space-y-4">
          <input
            value={familyCode}
            onChange={e => setFamilyCode(e.target.value)}
            placeholder="가족 코드를 입력하세요"
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {codeError && <p className="text-red-500 text-sm">{codeError}</p>}
          <button
            onClick={handleFamilyCode}
            className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition"
          >
            확인
          </button>
          <button
            onClick={() => { setChildren(MOCK_CHILDREN); setIsDemo(true); setShowCodeInput(false); }}
            className="w-full text-gray-400 text-sm hover:text-gray-600 py-1"
          >
            데모로 체험해보기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-blue-400 to-indigo-500 flex flex-col items-center justify-center p-6">
      <button onClick={() => navigate('/')} className="text-white/80 self-start mb-6 flex items-center gap-1 hover:text-white">
        ← 처음으로
      </button>

      <div className="text-center mb-8">
        <div className="text-6xl mb-3 animate-bounce">👋</div>
        <h1 className="text-3xl font-bold text-white drop-shadow">안녕! 나는 누구?</h1>
        <p className="text-white/80 mt-1">내 이름을 눌러봐요 😊</p>
        {isDemo && (
          <span className="inline-block mt-2 bg-white/20 text-white text-xs px-3 py-1 rounded-full">
            ✏️ 체험 모드
          </span>
        )}
      </div>

      <div className={`grid gap-4 w-full max-w-xs ${children.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {children.map(child => (
          <button
            key={child.id}
            onClick={() => navigate(`/child/pin/${child.id}`, { state: { child } })}
            className="bg-white rounded-3xl p-6 flex flex-col items-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            <div className="text-6xl mb-2">{child.avatar}</div>
            <p className="font-bold text-gray-800 text-lg">{child.name}</p>
            <p className="text-gray-400 text-sm">{child.grade}</p>
            <div className="mt-2 bg-blue-100 text-blue-600 text-xs px-3 py-1 rounded-full font-medium">
              선택하기 →
            </div>
          </button>
        ))}
      </div>

      {!isDemo && isSupabaseConfigured && (
        <button
          onClick={() => { localStorage.removeItem(DEVICE_FAMILY_KEY); setShowCodeInput(true); }}
          className="mt-6 text-white/60 text-xs hover:text-white/90"
        >
          다른 가족 코드 입력하기
        </button>
      )}
    </div>
  );
}
