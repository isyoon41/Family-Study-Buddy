/// <reference types="node" />
// Vercel Cron: 매일 오전 9시(KST) — 2일 이상 미등록 자녀가 있으면 부모에게 이메일

import nodemailer from 'nodemailer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gmailUser  = process.env.NOTIFY_GMAIL_USER;
  const gmailPass  = process.env.NOTIFY_GMAIL_PASS;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!gmailUser || !gmailPass || !supabaseUrl || !serviceKey) {
    return res.status(200).json({ ok: true, skipped: 'env_not_configured' });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  async function get(path: string) {
    const r = await fetch(`${supabaseUrl}/rest/v1${path}`, { headers });
    if (!r.ok) return null;
    return r.json();
  }

  // 오늘 기준 2일 전 날짜
  const today    = new Date();
  const cutoff   = new Date(today); cutoff.setDate(today.getDate() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // 모든 활성 자녀 + 가족 정보 조회
  const children = await get('/children?active=eq.true&select=id,name,avatar,family_id');
  if (!children?.length) return res.status(200).json({ ok: true, checked: 0 });

  // 가족별로 미접속 자녀 정리
  const familyInactive: Record<string, { name: string; avatar: string; lastDate: string | null }[]> = {};

  await Promise.all(children.map(async (child: { id: string; name: string; avatar: string; family_id: string }) => {
    // 최근 학습일지 날짜 확인
    const logs = await get(
      `/study_logs?child_id=eq.${child.id}&select=date&order=date.desc&limit=1`,
    );
    const lastDate: string | null = logs?.[0]?.date ?? null;

    // 마지막 기록이 없거나 cutoff보다 오래됐으면 inactive
    if (!lastDate || lastDate < cutoffStr) {
      if (!familyInactive[child.family_id]) familyInactive[child.family_id] = [];
      familyInactive[child.family_id].push({ name: child.name, avatar: child.avatar, lastDate });
    }
  }));

  if (Object.keys(familyInactive).length === 0) {
    return res.status(200).json({ ok: true, reminded: 0 });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  let reminded = 0;

  for (const [familyId, inactiveKids] of Object.entries(familyInactive)) {
    // 부모 이메일 조회
    let parentEmail = '';
    try {
      const fs = await get(`/family_settings?family_id=eq.${familyId}&select=parent_email,notifications_email`);
      if (fs?.[0]?.notifications_email && fs[0].parent_email) {
        parentEmail = fs[0].parent_email;
      }
    } catch { /* ignore */ }

    if (!parentEmail) continue;

    const kidList = inactiveKids.map(k => {
      const last = k.lastDate ? `마지막 기록: ${k.lastDate}` : '아직 기록 없음';
      return `<li style="padding:6px 0;">${k.avatar} <b>${k.name}</b> — ${last}</li>`;
    }).join('');

    const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#f59e0b;">⏰ 학습 등록 알림</h2>
  <p>아직 오늘 학습을 등록하지 않은 자녀가 있어요!</p>
  <ul style="padding-left:20px;color:#374151;">${kidList}</ul>
  <p style="color:#6b7280;font-size:13px;">아이에게 오늘 공부 기록을 남기도록 안내해 주세요 📚</p>
  <a href="https://family-study-buddy.vercel.app"
     style="display:inline-block;margin-top:16px;background:#3b82f6;color:#fff;
            padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">
    공부 플래너 열기
  </a>
</div>`;

    try {
      await transporter.sendMail({
        from: `"공부 플래너" <${gmailUser}>`,
        to: parentEmail,
        subject: `⏰ ${inactiveKids.map(k => k.name).join(', ')} — 오늘 학습 등록이 없어요`,
        html,
      });
      reminded++;
    } catch { /* email 실패 시 계속 */ }
  }

  return res.status(200).json({ ok: true, reminded });
}
