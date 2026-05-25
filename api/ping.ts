/// <reference types="node" />
// Vercel Cron Job: Supabase 자동 정지 방지용 핑
// vercel.json의 crons 설정으로 3일마다 자동 호출됨

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // Vercel 크론잡 인증 확인 (외부에서 임의 호출 방지)
  const authHeader = req.headers['authorization'] as string | undefined;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl  = process.env.VITE_SUPABASE_URL;
  const supabaseKey  = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 환경변수 없음' });
  }

  try {
    // families 테이블에 가벼운 SELECT 쿼리 → Supabase DB 활성 유지
    const response = await fetch(`${supabaseUrl}/rest/v1/families?select=id&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: `Supabase 응답 오류: ${response.status}` });
    }

    const now = new Date().toISOString();
    console.log(`[ping] Supabase 핑 성공 — ${now}`);
    return res.status(200).json({ ok: true, timestamp: now });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
