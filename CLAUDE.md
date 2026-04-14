# ydub-routine — CLAUDE.md

## 프로젝트 개요
매일 루틴을 체크하고 연속 달성 스트릭(streak)을 쌓는 PWA(Progressive Web App).
단일 HTML 파일 구조로 프레임워크 없이 순수 Vanilla JS로 작성되어 있다.

## 파일 구조
```
index.html      # 앱 전체 (HTML + CSS + JS 인라인)
sw.js           # 서비스워커 — 오프라인 캐싱 + 알림 스케줄링
manifest.json   # PWA 매니페스트
vercel.json     # Vercel 배포 설정
icons/          # 앱 아이콘 (icon-96.png, icon-192.png, icon-512.png)
generate_icons.py  # 아이콘 생성 스크립트
```

## 핵심 설계 원칙
- **단일 파일**: index.html 하나에 CSS와 JS가 모두 포함된다. 별도 파일로 분리하지 않는다.
- **프레임워크 없음**: React/Vue 등 사용하지 않음. 순수 Vanilla JS.
- **localStorage 저장**: 상태는 `daily_routine_v2` 키로 localStorage에 JSON 직렬화하여 저장.
- **오프라인 우선**: 서비스워커가 `/`, `/index.html`, `/manifest.json`을 캐싱.

## 상태 구조 (`S` 객체)
```js
{
  items: [{ id: number, text: string }],  // 루틴 항목 목록
  checks: { "YYYY-MM-DD": { [id]: true } }, // 날짜별 완료 체크
  lastDate: "YYYY-MM-DD",   // 마지막 접속 날짜 (자동 초기화 판단용)
  streak: number,           // 연속 달성 일수
  nextId: number,           // 다음 항목 ID
  morningTime: "HH:MM",    // 아침 알림 시각
  eveningTime: "HH:MM",    // 저녁 알림 시각
  notifGranted: boolean     // 알림 권한 여부
}
```

## 핵심 로직
- **자동 초기화**: `maybeReset()`이 날짜 변경을 감지해 체크를 초기화하고 스트릭을 갱신. 60초마다 폴링.
- **스트릭 계산**: 전날 모든 항목이 완료됐을 경우 +1, 하루라도 건너뛰면 0으로 리셋.
- **알림**: 서비스워커에 `SCHEDULE` 메시지를 보내고, SW가 `setTimeout`으로 매일 같은 시각에 반복 알림.

## 배포
- **플랫폼**: Vercel
- `vercel.json`: 모든 경로를 `/index.html`로 리다이렉트 (SPA 대응). `/sw.js`는 `no-cache` + `Service-Worker-Allowed: /` 헤더 설정.

## 주요 색상 (브랜드)
- 메인 그린: `#1D9E75`
- 다크 그린: `#0F6E56`
- 배경: `#f5f5f0`

## 코드 수정 시 주의사항
- `localStorage` 스키마 변경 시 `STORE` 상수(`daily_routine_v2`)의 버전을 올려야 기존 데이터와 충돌하지 않는다.
- 서비스워커 변경 후에는 `CACHE` 상수(`routine-v1`) 버전도 함께 올려야 구 캐시가 삭제된다.
- 알림 스케줄링은 `setTimeout` 기반이라 SW가 종료되면 타이머가 사라진다 — 앱 재방문 시 `scheduleLocalNotifs()`가 다시 호출되어 재등록됨.
