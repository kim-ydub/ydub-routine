// Supabase Edge Function: notify
// 매분 실행되어 현재 KST 시각과 사용자의 morning_time/evening_time이 일치하면 Web Push 발송

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
const supabaseKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey= Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject   = Deno.env.get('VAPID_SUBJECT') ?? 'https://eowmbesmcvonpekagubc.supabase.co';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const sb = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (_req) => {
  // 현재 KST 시각 (HH:MM)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentTime = `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}`;

  // 알림 시각과 일치하는 구독자 조회
  const { data: users, error } = await sb
    .from('routine_data')
    .select('id, streak, morning_time, evening_time, push_subscription')
    .not('push_subscription', 'is', null)
    .or(`morning_time.eq.${currentTime},evening_time.eq.${currentTime}`);

  if (error) {
    console.error('DB error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];
  for (const user of (users ?? [])) {
    const tag     = user.morning_time === currentTime ? 'morning' : 'evening';
    const payload = JSON.stringify({
      title: `꾸준함 ${user.streak ?? 0}일차`,
      body:  '꾸준함을 이어가 보자.',
      tag,
    });

    try {
      await webpush.sendNotification(user.push_subscription, payload);
      results.push({ id: user.id, ok: true });
    } catch (e: any) {
      console.error(`send failed for ${user.id}:`, e.statusCode, e.message);
      // 만료/삭제된 구독은 DB에서 제거
      if (e.statusCode === 410 || e.statusCode === 404) {
        await sb.from('routine_data')
          .update({ push_subscription: null })
          .eq('id', user.id);
      }
      results.push({ id: user.id, ok: false, status: e.statusCode });
    }
  }

  return new Response(
    JSON.stringify({ time: currentTime, sent: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
