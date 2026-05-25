import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { extractStudyFromImage, hasPageInfo } from '../../utils/gemini';
import { saveSheet, addActivityLog as localAddActivity, matchTextbook as localMatchTextbook } from '../../data/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { submitChildStudyLog, getChildTextbooks } from '../../lib/db';
import type { StudyItem, OcrItem, Textbook } from '../../types';

type Step = 'upload' | 'analyzing' | 'review' | 'done';

const SUBJECT_COLORS: Record<string, string> = {
  수학: 'bg-blue-100 text-blue-600', 국어: 'bg-green-100 text-green-600',
  영어: 'bg-purple-100 text-purple-600', 과학: 'bg-yellow-100 text-yellow-600',
  사회: 'bg-orange-100 text-orange-600',
};

/** 이미지 base64를 최대 800px / 80% 품질로 압축 */
function compressImage(dataUrl: string, maxPx = 800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
  });
}

export default function ChildUpload() {
  const navigate = useNavigate();
  const { child, family, isDemo } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]               = useState<Step>('upload');
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [goal, setGoal]               = useState('');
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [totalMinutes, setTotalMinutes] = useState(60);
  const [items, setItems]             = useState<StudyItem[]>([]);
  const [pageError, setPageError]     = useState(false);
  const [error, setError]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // 교재 목록 미리 로드 (자동 매칭용)
  const booksRef = useRef<Textbook[]>([]);
  useEffect(() => {
    if (!isDemo && child?.id && child?.pin && isSupabaseConfigured) {
      getChildTextbooks(child.id, child.pin).then(books => { booksRef.current = books; });
    }
  }, [child, isDemo]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있어요.'); return; }

    // 이미지 읽기 + 압축
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setImageUrl(compressed);
    };
    reader.readAsDataURL(file);

    setStep('analyzing');
    setError('');
    try {
      const result = await extractStudyFromImage(file);
      if (result.goal)          setGoal(result.goal);
      if (result.date)          setDate(result.date);
      if (result.total_minutes) setTotalMinutes(result.total_minutes);

      const mapped: StudyItem[] = (result.items as OcrItem[]).map((it, i) => {
        let tbId: string | undefined;
        if (!isDemo && isSupabaseConfigured) {
          const lower = it.task_text.toLowerCase();
          const found = booksRef.current.find(
            b => lower.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(lower),
          );
          tbId = found?.id;
        } else {
          tbId = localMatchTextbook(it.task_text, child?.id ?? '')?.id;
        }
        return {
          id: `item-${Date.now()}-${i}`,
          subject: it.subject, task_text: it.task_text,
          quantity_raw: it.quantity_raw, completed: it.completed,
          textbook_id: tbId,
        };
      });
      setItems(mapped.length > 0 ? mapped : [{ id: 'item-1', subject: '', task_text: '', quantity_raw: '', completed: false }]);
      setStep('review');
    } catch (e) {
      setError(`분석 실패: ${(e as Error).message}`);
      setStep('upload');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const updateItem = (id: string, field: keyof StudyItem, value: string | boolean) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addItem = () =>
    setItems(prev => [...prev, { id: `item-${Date.now()}`, subject: '', task_text: '', quantity_raw: '', completed: false }]);

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const handleSubmit = async () => {
    setPageError(false);
    if (!hasPageInfo(items)) { setPageError(true); return; }

    setSubmitting(true);

    if (isDemo) {
      // 데모 모드: localStorage 저장
      const sheet = {
        id: `sheet-${Date.now()}`,
        child_id: child!.id, child_name: child!.name, child_avatar: child!.avatar,
        family_id: family!.id, date, goal, items,
        total_minutes: totalMinutes, status: 'pending' as const,
        image_url: imageUrl ?? undefined, created_at: new Date().toISOString(),
      };
      saveSheet(sheet);
      localAddActivity({
        family_id: family!.id, timestamp: new Date().toISOString(),
        type: 'submit', actor: `${child!.name} ${child!.avatar}`,
        description: `공부 기록 제출 (${date})`,
      });
      setSubmitting(false);
      setStep('done');
      return;
    }

    // 실 계정: Supabase RPC
    try {
      await submitChildStudyLog(child!.id, child!.pin, {
        date, goal, totalMinutes,
        imageUrl: imageUrl ?? '',
        items,
      });

      // 부모 이메일 알림 (fire-and-forget — 실패해도 제출은 완료)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: family?.id,
          childName: child?.name,
          childAvatar: child?.avatar,
          date,
          goal,
          items,
          totalMinutes,
        }),
      }).catch(() => {});

      setSubmitting(false);
      setStep('done');
    } catch (e) {
      const msg = (e as Error).message;
      console.error('제출 오류:', msg);
      setError(`제출 오류: ${msg}`);
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-4 animate-bounce">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">제출 완료!</h1>
        <p className="text-gray-500 mb-2">부모님이 확인해주실 거예요 😊</p>
        {isDemo && <p className="text-yellow-600 text-xs mb-4">(데모 모드: 이 기기에만 저장됩니다)</p>}
        <button onClick={() => navigate('/child/dashboard')}
          className="bg-gradient-to-r from-blue-500 to-teal-400 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:opacity-90">
          대시보드로 →
        </button>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🤖</div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">AI가 공부 내용을 분석하고 있어요</h2>
        <div className="flex gap-2 mt-3">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <p className="text-gray-400 text-sm mt-4">잠깐만 기다려봐요 ✨</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => step === 'review' ? setStep('upload') : navigate('/child/dashboard')}
          className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="font-bold text-gray-800">
          {step === 'upload' ? '📸 계획표 올리기' : '📝 내용 확인 & 수정'}
        </h1>
      </div>

      {/* 업로드 화면 */}
      {step === 'upload' && (
        <div className="max-w-md mx-auto p-4 space-y-4">
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-blue-300 rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition bg-white"
          >
            <div className="text-6xl mb-3">📷</div>
            <p className="font-bold text-gray-700 text-lg">사진을 여기에 올려요!</p>
            <p className="text-gray-400 text-sm mt-1">공부 계획표 사진을 찍어서 올려봐요</p>
            <div className="mt-4 bg-gradient-to-r from-blue-500 to-teal-400 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow">
              📂 파일 선택 / 📷 카메라
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-600 text-sm text-center">{error}</div>}
          <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
            <p className="font-bold mb-1">💡 이렇게 써야 잘 인식돼요!</p>
            <p>• 공부한 페이지: <strong>p.12~15</strong> 또는 <strong>12~15쪽</strong></p>
            <p>• 문제 수: <strong>10문제</strong></p>
            <p>• 완료 표시: ✓ 체크 또는 O 표시</p>
          </div>
        </div>
      )}

      {/* 검토 화면 */}
      {step === 'review' && (
        <div className="max-w-md mx-auto p-4 space-y-4 pb-28">
          {imageUrl && (
            <img src={imageUrl} alt="업로드된 계획표" className="w-full rounded-2xl shadow object-contain max-h-52" />
          )}

          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">📅 날짜</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">🎯 오늘의 목표</label>
              <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="오늘의 목표를 써봐요!"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">⏱ 공부 시간 (분)</label>
              <input type="number" min={0} max={480} value={totalMinutes}
                onChange={e => setTotalMinutes(Number(e.target.value))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">{Math.floor(totalMinutes/60)}시간 {totalMinutes%60}분</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold text-gray-700">📚 공부 항목</p>
              <button onClick={addItem} className="text-blue-500 text-sm font-medium hover:text-blue-700">+ 추가</button>
            </div>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateItem(item.id, 'completed', !item.completed)} className="text-xl flex-shrink-0">
                      {item.completed ? '✅' : '⬜'}
                    </button>
                    <input placeholder="과목" value={item.subject} onChange={e => updateItem(item.id, 'subject', e.target.value)}
                      className="w-16 border rounded-lg px-2 py-1.5 text-xs focus:outline-none text-center" />
                    <input placeholder="공부한 내용" value={item.task_text} onChange={e => updateItem(item.id, 'task_text', e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    <button onClick={() => removeItem(item.id)} className="text-red-300 hover:text-red-500 text-lg">×</button>
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <input placeholder="분량 (예: p.12~15, 10문제)" value={item.quantity_raw}
                      onChange={e => updateItem(item.id, 'quantity_raw', e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    {item.subject && (
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${SUBJECT_COLORS[item.subject] ?? 'bg-gray-100 text-gray-500'}`}>
                        {item.subject}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {pageError && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-1">📄</p>
              <p className="font-bold text-orange-700">공부한 페이지를 적어주세요!</p>
              <p className="text-orange-600 text-sm mt-1">분량 칸에 페이지를 기록해야 제출할 수 있어요</p>
              <p className="text-orange-500 text-xs mt-1">예시: <strong>p.12~15</strong> 또는 <strong>12~15쪽</strong></p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-600 text-sm text-center">{error}</div>
          )}

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
            <div className="max-w-md mx-auto">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-500 to-teal-400 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting
                  ? <><span className="animate-spin inline-block">⏳</span> 전송 중...</>
                  : <><span>✉️</span> 부모님께 보내기!</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
