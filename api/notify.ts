/// <reference types="node" />
// 자녀 학습일지 제출 시 부모 이메일 알림

import nodemailer from 'nodemailer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gmailUser = process.env.NOTIFY_GMAIL_USER;
  const gmailPass = process.env.NOTIFY_GMAIL_PASS;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Gmail 미설정 → 조용히 스킵 (기능 비활성 상태)
  if (!gmailUser || !gmailPass) {
    return res.status(200).json({ ok: true, skipped: 'gmail_not_configured' });
  }

  const { familyId, childName, childAvatar, date, goal, items, totalMinutes } = req.body ?? {};
  if (!familyId) return res.status(400).json({ error: 'familyId required' });

  // ── 부모 이메일 조회 ─────────────────────────────────────────────
  let parentEmail = '';

  if (supabaseUrl && serviceKey) {
    // 1) family_settings.parent_email
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/family_settings?family_id=eq.${familyId}&select=parent_email,notifications_email`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) {
        if (rows[0].notifications_email === false) {
          return res.status(200).json({ ok: true, skipped: 'notifications_disabled' });
        }
        parentEmail = rows[0].parent_email ?? '';
      }
    } catch { /* DB 오류는 무시하고 계속 */ }

    // 2) parent_profiles → auth user email (fallback)
    if (!parentEmail) {
      try {
        const pr = await fetch(
          `${supabaseUrl}/rest/v1/parent_profiles?family_id=eq.${familyId}&select=id&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        const profiles = await pr.json();
        const userId = Array.isArray(profiles) && profiles[0]?.id;
        if (userId) {
          const ur = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          });
          const userData = await ur.json();
          parentEmail = userData?.email ?? '';
        }
      } catch { /* 무시 */ }
    }
  }

  if (!parentEmail) {
    return res.status(200).json({ ok: true, skipped: 'no_parent_email' });
  }

  // ── 이메일 HTML 구성 ─────────────────────────────────────────────
  const safeItems: { completed: boolean; subject: string; task_text: string; quantity_raw: string }[] =
    Array.isArray(items) ? items : [];

  const completedCount = safeItems.filter(i => i.completed).length;
  const total = safeItems.length;
  const rate  = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const hrs   = Math.floor((totalMinutes ?? 0) / 60);
  const mins  = (totalMinutes ?? 0) % 60;

  const rateColor = rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b';

  const rowsHtml = safeItems.map(i => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px;font-size:16px;">${i.completed ? '✅' : '⬜'}</td>
      <td style="padding:8px 12px;font-size:13px;color:#6b7280;white-space:nowrap;">${i.subject || '-'}</td>
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${i.task_text || '-'}</td>
      <td style="padding:8px 12px;font-size:12px;color:#9ca3af;">${i.quantity_raw || '-'}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;padding:0 16px;">

    <!-- 헤더 카드 -->
    <div style="background:linear-gradient(135deg,#3b82f6,#14b8a6);border-radius:20px;padding:28px 24px;text-align:center;margin-bottom:16px;">
      <div style="font-size:56px;margin-bottom:8px;">${childAvatar ?? '📚'}</div>
      <h1 style="margin:0 0 6px;color:#fff;font-size:20px;font-weight:700;">${childName ?? '자녀'}이(가) 학습일지를 제출했어요!</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">${date ?? ''} &nbsp;·&nbsp; ${hrs}시간 ${mins}분</p>
    </div>

    <!-- 완료율 -->
    <div style="background:#fff;border-radius:16px;padding:20px 24px;margin-bottom:12px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <p style="margin:0 0 4px;font-size:36px;font-weight:700;color:${rateColor};">${rate}%</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">완료율 &nbsp;(${completedCount} / ${total} 항목)</p>
      <div style="background:#f3f4f6;border-radius:999px;height:8px;margin-top:12px;overflow:hidden;">
        <div style="background:${rateColor};height:8px;width:${rate}%;border-radius:999px;"></div>
      </div>
    </div>

    ${goal ? `
    <!-- 목표 -->
    <div style="background:#eff6ff;border-radius:16px;padding:16px 20px;margin-bottom:12px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;">🎯 오늘의 목표</p>
      <p style="margin:0;font-size:15px;color:#1f2937;font-weight:500;">${goal}</p>
    </div>` : ''}

    ${rowsHtml ? `
    <!-- 공부 항목 -->
    <div style="background:#fff;border-radius:16px;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <div style="padding:14px 20px 10px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#374151;">📚 공부 항목</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;">완료</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;">과목</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;">내용</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;">분량</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>` : ''}

    <!-- 안내 -->
    <div style="text-align:center;padding:8px 0 24px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">공부 플래너에서 확인 후 승인 또는 응원 메시지를 남겨주세요 ❤️</p>
    </div>
  </div>
</body>
</html>`;

  // ── Gmail SMTP 발송 ───────────────────────────────────────────────
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"공부 플래너" <${gmailUser}>`,
      to: parentEmail,
      subject: `${childAvatar ?? '📚'} ${childName ?? '자녀'} 학습일지 제출 알림 — ${date ?? ''}`,
      html,
    });

    console.log(`[notify] 이메일 발송 완료 → ${parentEmail}`);
    return res.status(200).json({ ok: true, to: parentEmail });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[notify] 이메일 발송 실패:', message);
    return res.status(500).json({ error: message });
  }
}
