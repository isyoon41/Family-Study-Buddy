import type { OcrResult } from '../types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `
이 이미지는 학생의 공부 계획표 또는 공부 노트 사진입니다.
다음 JSON 형식으로 공부 내용을 추출해주세요. 절대 다른 텍스트 없이 JSON만 반환하세요.

{
  "date": "YYYY-MM-DD 또는 null",
  "goal": "오늘의 목표 문장 또는 null",
  "total_minutes": 숫자(분) 또는 null,
  "items": [
    {
      "subject": "과목명 (수학/국어/영어/과학/사회/기타)",
      "task_text": "공부한 내용 (교재명 포함)",
      "quantity_raw": "분량 (예: p.12~15, 10문제, 3쪽 등)",
      "completed": true 또는 false
    }
  ]
}

- date가 없으면 null
- 페이지 범위는 "12~15" 또는 "p.12~15" 형식으로
- 완료 표시(체크, ✓, O)가 있으면 completed: true
- 공부 시간이 적혀있으면 total_minutes로 변환
`;

/** 페이지 정보가 quantity_raw 에 포함되어 있는지 검사 */
export function hasPageInfo(items: { quantity_raw: string }[]): boolean {
  const pagePattern = /(\d+\s*[~\-]\s*\d+)|(페이지|쪽|\bp\.?\s*\d)/i;
  return items.some(item => pagePattern.test(item.quantity_raw));
}

/** base64 → Gemini API 호출 */
async function callGemini(base64: string, mimeType: string): Promise<OcrResult> {
  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON을 파싱할 수 없습니다.');
  return JSON.parse(jsonMatch[0]) as OcrResult;
}

/** 모의 OCR 결과 (API 키 없을 때) */
function mockOcr(): OcrResult {
  return {
    date: new Date().toISOString().slice(0, 10),
    goal: '오늘의 공부 계획 (데모)',
    total_minutes: 90,
    items: [
      { subject: '수학', task_text: '수학의 정석 5단원', quantity_raw: 'p.112~120', completed: true },
      { subject: '국어', task_text: '독해 문제집', quantity_raw: 'p.34~36', completed: false },
      { subject: '영어', task_text: '단어 외우기', quantity_raw: '20개', completed: true },
    ],
  };
}

/** 이미지 파일 → OcrResult */
export async function extractStudyFromImage(file: File): Promise<OcrResult> {
  const toBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  if (!API_KEY) {
    // 데모: 1.5초 딜레이 후 모의 결과
    await new Promise(r => setTimeout(r, 1500));
    return mockOcr();
  }

  const base64 = await toBase64(file);
  return callGemini(base64, file.type || 'image/jpeg');
}
