/// <reference types="node" />
// Vercel Serverless Function: Gemini API 프록시
// API 키는 서버측 환경변수(GEMINI_API_KEY)에서만 읽음 → 클라이언트 JS에 절대 노출되지 않음

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `이 이미지는 학생의 공부 계획표 또는 공부 노트 사진입니다.
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
- 공부 시간이 적혀있으면 total_minutes로 변환`;

type GeminiPart = { text?: string; thought?: boolean };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // OPTIONS preflight (CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const reqBody = req.body as { base64?: string; mimeType?: string } | null;
  const base64 = reqBody?.base64;
  const mimeType = reqBody?.mimeType;

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'base64 및 mimeType 필수' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  try {
    const geminiRes = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({})) as { error?: { message?: string } };
      return res.status(geminiRes.status).json({
        error: err?.error?.message ?? `Gemini HTTP ${geminiRes.status}`,
      });
    }

    const data = await geminiRes.json() as GeminiResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p: GeminiPart) => !p.thought)
      .map((p: GeminiPart) => p.text ?? '')
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Gemini 응답에서 JSON을 찾을 수 없습니다.' });
    }

    return res.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
