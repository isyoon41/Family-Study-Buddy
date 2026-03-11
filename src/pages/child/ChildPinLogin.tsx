import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_CHILDREN } from '../../data/mockData';

const ENCOURAGEMENTS = ['', '잘하고 있어요! 🌟', '거의 다 됐어요! ✨', '마지막 한 자리! 💪'];

type SimpleChild = { id: string; name: string; avatar: string; grade: string };

export default function ChildPinLogin() {
  const navigate = useNavigate();
  const { childId } = useParams<{ childId: string }>();
  const location = useLocation();
  const { loginAsChild } = useAuth();

  // 1순위: ChildSelect에서 navigate state로 전달된 자녀 정보 (Supabase 실제 자녀)
  // 2순위: 데모 딥링크용 MOCK_CHILDREN 검색
  const stateChild = (location.state as { child?: SimpleChild } | null)?.child;
  const child = stateChild ?? MOCK_CHILDREN.find(c => c.id === childId);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handlePress = async (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      const result = await loginAsChild(childId!, newPin);
      if (result.error) {
        setError(result.error);
        setShake(true);
        setTimeout(() => { setPin(''); setShake(false); setError(''); }, 700);
      } else {
        navigate('/child/dashboard');
      }
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  if (!child) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">자녀를 찾을 수 없어요</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-blue-50 flex flex-col items-center justify-center p-6">
      <button onClick={() => navigate('/child')} className="text-gray-400 self-start mb-6 hover:text-gray-600">
        ← 다른 친구 선택
      </button>

      {/* 아바타 */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-28 h-28 bg-gradient-to-br from-blue-200 to-teal-200 rounded-full flex items-center justify-center text-6xl shadow-lg mb-3">
          {child.avatar}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{child.name}</h1>
        <p className="text-gray-400 text-sm mt-1">비밀번호를 눌러봐요 🔑</p>
      </div>

      {/* PIN 점들 */}
      <div className={`flex gap-4 mb-3 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              i < pin.length ? 'bg-blue-500 border-blue-500 scale-110' : 'border-gray-300 bg-white'
            }`}
          />
        ))}
      </div>

      {/* 응원 메시지 */}
      <p className={`text-sm mb-2 h-5 transition-colors ${error ? 'text-red-500' : 'text-blue-500 font-medium'}`}>
        {error || ENCOURAGEMENTS[pin.length]}
      </p>

      {/* 숫자 패드 */}
      <div className="grid grid-cols-3 gap-3 w-72 mt-2">
        {['1','2','3','4','5','6','7','8','9'].map(n => (
          <button key={n} onClick={() => handlePress(n)}
            className="h-18 py-5 bg-white rounded-2xl text-2xl font-bold text-gray-700 shadow hover:bg-blue-50 hover:shadow-md active:scale-95 transition">
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => handlePress('0')}
          className="h-18 py-5 bg-white rounded-2xl text-2xl font-bold text-gray-700 shadow hover:bg-blue-50 hover:shadow-md active:scale-95 transition">
          0
        </button>
        <button onClick={handleDelete}
          className="h-18 py-5 bg-white rounded-2xl flex items-center justify-center shadow hover:bg-red-50 active:scale-95 transition">
          <span className="text-2xl">⌫</span>
        </button>
      </div>

      <p className="text-gray-300 text-xs mt-6">숫자를 눌러서 비밀번호를 입력해요 🌟</p>
    </div>
  );
}
