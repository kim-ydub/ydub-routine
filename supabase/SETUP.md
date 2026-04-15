# Supabase Web Push 설정 가이드

## 1. DB 컬럼 추가
Supabase 대시보드 → SQL Editor에서 실행:

```sql
ALTER TABLE routine_data ADD COLUMN IF NOT EXISTS push_subscription jsonb;
```

---

## 2. Supabase Secrets 등록
대시보드 → Edge Functions → Manage Secrets에서 아래 3개 추가:

| Key | Value |
|-----|-------|
| `VAPID_PUBLIC_KEY` | `BFtj5vMim5jW55vJpD0N_XefpTEkDpnxbmumu2xhpmQui0O2LhTeGFmJIRbtjAONrQ-IXdQ1UKigli7eivo2byk` |
| `VAPID_PRIVATE_KEY` | `ubs3z3bA83ojJm8pBAVQZZpQO0mye2ncKMnb9k2V8tQ` |
| `VAPID_SUBJECT` | `https://eowmbesmcvonpekagubc.supabase.co` |

---

## 3. Edge Function 배포
대시보드 → Edge Functions → New Function → 이름: `notify`
`supabase/functions/notify/index.ts` 내용 붙여넣고 Deploy.

또는 Supabase CLI:
```bash
npx supabase functions deploy notify --project-ref eowmbesmcvonpekagubc
```

---

## 4. Cron 설정 (매분 실행)
대시보드 → SQL Editor에서 실행:

```sql
-- pg_net, pg_cron 활성화 (대시보드 Database → Extensions에서도 가능)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 매분 notify 함수 호출
SELECT cron.schedule(
  'routine-notify',
  '* * * * *',
  $$
  SELECT net.http_post(
    url    := 'https://eowmbesmcvonpekagubc.supabase.co/functions/v1/notify',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvd21iZXNtY3ZvbnBla2FndWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMzYzMTUsImV4cCI6MjA5MTcxMjMxNX0.cXCpeVtn4IiaFxT3g7wdoYOTgiDUizOyfbCycGPlylI"}'::jsonb,
    body   := '{}'::jsonb
  )
  $$
);
```

---

## 5. 동작 확인
- 앱에서 알림 허용 후 → DB `routine_data.push_subscription` 컬럼에 값 확인
- 대시보드 → Cron Jobs에서 실행 로그 확인
- Edge Function 로그: 대시보드 → Edge Functions → notify → Logs

---

## 구조 요약
```
앱 열기
  → subscribePush() → PushSubscription → Supabase 저장

매분 (pg_cron)
  → Edge Function notify
  → KST 현재시각 == morning_time or evening_time?
  → web-push로 발송
  → SW push 이벤트 → 알림 표시
```
