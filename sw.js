// sw.js — 서비스워커
const CACHE = 'routine-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// 설치 & 캐싱
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 오프라인 대응
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ──────────────────────────────
// 알림 스케줄링
// ──────────────────────────────
let morningTimer = null;
let eveningTimer = null;

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    const { morningTime, eveningTime } = e.data;
    clearTimeout(morningTimer);
    clearTimeout(eveningTimer);
    scheduleDailyNotif(morningTime, '아침 루틴 시작! 💪', '오늘도 루틴을 시작해볼까요?', 'morning');
    scheduleDailyNotif(eveningTime, '저녁 리마인드 🌙', '오늘 루틴, 아직 완료하지 않은 항목이 있어요.', 'evening');
  }
});

function scheduleDailyNotif(timeStr, title, body, tag) {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // 이미 지났으면 내일
  const delay = target - now;

  const t = setTimeout(async () => {
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag,
      renotify: true,
      data: { url: '/' }
    });
    // 내일 같은 시간에 다시
    scheduleDailyNotif(timeStr, title, body, tag);
  }, delay);

  if (tag === 'morning') morningTimer = t;
  else eveningTimer = t;
}

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const match = cs.find(c => c.url.includes(self.location.origin));
      if (match) return match.focus();
      return clients.openWindow('/');
    })
  );
});
