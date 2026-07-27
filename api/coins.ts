/// <reference types="node" />
// 코인 지급/정산 서버리스 함수 (서비스 롤 키로 RLS 우회)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase 환경변수 없음' });
  }

  const { action, childId, familyId, date, amount, note } = req.body ?? {};

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // ── 공통 Supabase REST 헬퍼 ─────────────────────────────────────
  async function query(path: string, opts: RequestInit = {}) {
    const r = await fetch(`${supabaseUrl}/rest/v1${path}`, {
      headers: { ...headers, ...(opts.headers ?? {}) },
      ...opts,
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
  }

  // ── 1. 코인 지급 (자녀 학습일지 제출 후 주간 달성 체크) ─────────
  if (action === 'award') {
    if (!childId || !familyId || !date) {
      return res.status(400).json({ error: 'childId, familyId, date 필수' });
    }

    // 이번 주 월~일 범위 계산 (ISO 주)
    const d    = new Date(date);
    const day  = d.getDay() === 0 ? 7 : d.getDay(); // 1(월)~7(일)
    const mon  = new Date(d); mon.setDate(d.getDate() - (day - 1));
    const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt  = (dt: Date) => dt.toISOString().slice(0, 10);
    const weekLabel = `${mon.getFullYear()}-W${String(getWeekNum(mon)).padStart(2, '0')}`;

    // 이번 주 제출된 날짜 목록 (중복 제외)
    const logsRes = await query(
      `/study_logs?child_id=eq.${childId}&date=gte.${fmt(mon)}&date=lte.${fmt(sun)}&select=date`,
    );
    if (!logsRes.ok) return res.status(500).json({ error: 'study_logs 조회 실패' });
    const distinctDays = new Set((logsRes.data as {date:string}[]).map(l => l.date)).size;

    // 이번 주 이미 지급된 코인 내역 확인
    const txRes = await query(
      `/coin_transactions?child_id=eq.${childId}&week_label=eq.${weekLabel}&select=type`,
    );
    const alreadyGiven = new Set((txRes.data as {type:string}[] ?? []).map(t => t.type));

    const awards: { amount: number; type: string }[] = [];

    if (distinctDays >= 5 && !alreadyGiven.has('award_5days')) {
      awards.push({ amount: 100, type: 'award_5days' });
    }
    if (distinctDays >= 6 && !alreadyGiven.has('award_6days')) {
      awards.push({ amount: 200, type: 'award_6days' }); // 5일 100 + 추가 200 = 총 300
    }

    if (awards.length === 0) return res.status(200).json({ ok: true, awarded: 0 });

    const totalAward = awards.reduce((s, a) => s + a.amount, 0);

    // 코인 잔액 증가
    await query(`/children?id=eq.${childId}`, {
      method: 'PATCH',
      body: JSON.stringify({ coins: { increment: totalAward } }),
    });

    // Supabase REST는 increment 미지원 → RPC로 처리
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_coins`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_child_id: childId, p_amount: totalAward }),
    });

    // 거래 내역 기록
    for (const a of awards) {
      await query('/coin_transactions', {
        method: 'POST',
        body: JSON.stringify({
          child_id: childId, family_id: familyId,
          amount: a.amount, type: a.type,
          week_label: weekLabel,
          note: a.type === 'award_5days' ? '주간 5일 달성 🎉' : '주간 6일 달성 🏆',
        }),
      });
    }

    return res.status(200).json({ ok: true, awarded: totalAward, days: distinctDays });
  }

  // ── 2. 정산 (부모가 코인 차감) ────────────────────────────────────
  if (action === 'settle') {
    if (!childId || !familyId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'childId, familyId, amount(양수) 필수' });
    }

    // 현재 잔액 확인
    const childRes = await query(`/children?id=eq.${childId}&select=coins,name`);
    if (!childRes.ok || !childRes.data?.length) {
      return res.status(404).json({ error: '자녀를 찾을 수 없습니다' });
    }
    const current: number = childRes.data[0].coins;
    if (current < amount) {
      return res.status(400).json({ error: `잔액 부족 (현재 ${current}코인)` });
    }

    // 코인 차감 (RPC)
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_coins`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_child_id: childId, p_amount: -amount }),
    });

    // 거래 내역
    await query('/coin_transactions', {
      method: 'POST',
      body: JSON.stringify({
        child_id: childId, family_id: familyId,
        amount: -amount, type: 'settlement',
        note: note ?? `${amount}코인 정산`,
      }),
    });

    return res.status(200).json({ ok: true, settled: amount, remaining: current - amount });
  }

  return res.status(400).json({ error: '알 수 없는 action' });
}

function getWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
