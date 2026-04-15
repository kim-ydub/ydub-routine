// sw.js — 서비스워커
const CACHE = 'routine-v7';
const ASSETS = ['/', '/index.html', '/manifest.json', '/CLAUDE.md'];

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
  // SW 재시작 시 저장된 스케줄로 타이머 복원
  if (!timerRestored) {
    timerRestored = true;
    restoreSchedule();
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ──────────────────────────────
// IndexedDB 헬퍼
// ──────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('routine-sw', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}
function idbGet(key) {
  return openDB().then(db => new Promise((res, rej) => {
    const req = db.transaction('kv','readonly').objectStore('kv').get(key);
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  }));
}
function idbSet(key, val) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv','readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = res;
    tx.onerror = rej;
  }));
}

// ──────────────────────────────
// 알림 스케줄링
// ──────────────────────────────
let morningTimer = null;
let eveningTimer = null;
let timerRestored = false;

async function restoreSchedule() {
  try {
    const data = await idbGet('schedule');
    if (data) applySchedule(data);
  } catch(e) {}
}

function applySchedule({ morningTime, eveningTime, streak }) {
  clearTimeout(morningTimer);
  clearTimeout(eveningTimer);
  const title = `꾸준함 ${streak || 0}일차`;
  const body = '꾸준함을 이어가 보자.';
  scheduleDailyNotif(morningTime, title, body, 'morning');
  scheduleDailyNotif(eveningTime, title, body, 'evening');
}

self.addEventListener('message', async e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    const { morningTime, eveningTime, streak } = e.data;
    await idbSet('schedule', { morningTime, eveningTime, streak });
    applySchedule({ morningTime, eveningTime, streak });
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

// 서버 Web Push 수신
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? '꾸준함', {
      body:      data.body ?? '꾸준함을 이어가 보자.',
      icon:      '/icons/icon-192.png',
      badge:     '/icons/icon-96.png',
      tag:       data.tag ?? 'routine',
      renotify:  true,
      data:      { url: '/' },
    })
  );
});

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
