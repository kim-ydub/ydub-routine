# ydub-routine — CLAUDE.md
> 최근 수정: 2026-04-14 16:22:18 (KST)

## 프로젝트 개요
매일 루틴을 체크하고 연속 달성 스트릭(streak)을 쌓는 PWA(Progressive Web App).
단일 HTML 파일 구조로 프레임워크 없이 순수 Vanilla JS로 작성되어 있다.
데이터는 Supabase에 저장되며, 오프라인 시 localStorage를 임시 캐시로 사용한다.

## 파일 구조
```
index.html         # 앱 전체 (HTML + CSS + JS 인라인)
sw.js              # 서비스워커 — 오프라인 캐싱 + 알림 스케줄링
manifest.json      # PWA 매니페스트
vercel.json        # Vercel 배포 설정
icons/             # 앱 아이콘 (icon-96.png, icon-192.png, icon-512.png)
generate_icons.py  # 아이콘 생성 스크립트
```

## 핵심 설계 원칙
- **단일 파일**: index.html 하나에 CSS와 JS가 모두 포함된다. 별도 파일로 분리하지 않는다.
- **프레임워크 없음**: React/Vue 등 사용하지 않음. 순수 Vanilla JS.
- **Supabase 저장**: 상태는 `routine_data` 테이블에 upsert. 오프라인 시 `routine_cache_v1` 키로 localStorage 캐시 사용.
- **오프라인 우선**: 서비스워커가 `/`, `/index.html`, `/manifest.json`을 캐싱.

## Supabase 설정
- **Project URL**: `https://eowmbesmcvonpekagubc.supabase.co`
- **User ID**: `user_1` (단일 사용자 고정)
- **RLS**: 비활성화됨

### DB 테이블 (`routine_data`)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | 고정값 `'user_1'` |
| items | jsonb | 루틴 항목 배열 |
| checks | jsonb | 날짜별 체크 기록 |
| streak | integer | 연속 달성 일수 |
| last_date | text | 마지막 접속 날짜 |
| next_id | integer | 다음 항목 ID |
| morning_time | text | 아침 알림 시각 |
| evening_time | text | 저녁 알림 시각 |
| updated_at | timestamptz | 마지막 저장 시각 |

## 상태 구조 (`S` 객체, 인메모리)
```js
{
  items: [{ id: number, text: string }],       // 루틴 항목 목록
  checks: { "YYYY-MM-DD": { [id]: true } },    // 날짜별 완료 체크
  lastDate: "YYYY-MM-DD",   // 마지막 접속 날짜 (자동 초기화 판단용)
  streak: number,           // 연속 달성 일수
  nextId: number,           // 다음 항목 ID
  morningTime: "HH:MM",    // 아침 알림 시각
  eveningTime: "HH:MM",    // 저녁 알림 시각
  notifGranted: boolean     // 알림 권한 여부 (로컬 전용)
}
```

## 데이터 흐름
### 초기 로드 (`loadData()`)
1. `daily_routine_v2` (구 localStorage) 존재 시 → Supabase로 마이그레이션 후 삭제
2. Supabase `routine_data` 조회 → 성공 시 localStorage 캐시에도 저장
3. Supabase 실패 시 → `routine_cache_v1` 로컬 캐시 사용
4. 캐시도 없으면 → 기본값 사용

### 저장 (`save()`)
- localStorage 캐시에 즉시 저장 (동기)
- Supabase에 upsert (비동기)
- 오프라인 시 Supabase 저장 생략, 온라인 복귀 시 자동 동기화

### 동기화 상태 배지 (헤더 우측)
- `저장 중` → Supabase upsert 진행 중
- `MM/dd hh:mm 수정됨` → 저장 완료 (시각 표시, 다음 저장 전까지 유지)
- `저장 실패` → Supabase 오류

## 핵심 로직
- **자동 초기화**: `maybeReset()`이 날짜 변경을 감지해 체크를 초기화하고 스트릭을 갱신. 60초마다 폴링.
- **스트릭 계산**: 전날 모든 항목이 완료됐을 경우 +1, 하루라도 건너뛰면 0으로 리셋.
- **드래그 순서 변경**: 항목 좌측 핸들(6점 그립)을 터치/마우스로 드래그하여 순서 변경.
- **Pull-to-Refresh**: 최상단에서 80px 이상 아래로 당기면 원형 인디케이터가 나타나며 새로고침.
- **알림**: 서비스워커에 `SCHEDULE` 메시지(morningTime, eveningTime, streak 포함)를 보내고, SW가 `setTimeout`으로 매일 같은 시각에 반복 알림.

## 알림 문구 (sw.js)
- **아침/저녁 공통**
  - title: `꾸준함 n일차` (n = 현재 streak)
  - body: `꾸준함을 이어가 보자.`

## UI 주요 텍스트
| 위치 | 텍스트 |
|------|------|
| 페이지 타이틀 / 브라우저 탭 | `꾸준함` |
| 헤더 | `꾸준함` |
| 스트릭 라벨 | `일간 꾸준하였습니다` |
| 완료 배너 | `오늘 루틴 완료! 💪 내일도 이어가요` |

## 배포
- **플랫폼**: Vercel (GitHub 연동, main 브랜치 push 시 자동 배포)
- **Repository**: `https://github.com/kim-ydub/ydub-routine`
- `vercel.json`: 모든 경로를 `/index.html`로 리다이렉트. `/sw.js`는 `no-cache` + `Service-Worker-Allowed: /` 헤더 설정.

## 주요 색상 (브랜드)
- 메인 그린: `#1D9E75`
- 다크 그린: `#0F6E56`
- 배경: `#f5f5f0`

## 코드 수정 시 주의사항
- **Supabase 스키마 변경** 시 `toRow()` / `fromRow()` 함수를 함께 수정해야 한다.
- **서비스워커 변경** 시 `sw.js`의 `CACHE` 상수 버전을 올려야 구 캐시가 삭제된다. (현재: `routine-v4`)
- **알림 streak 반영**: `scheduleLocalNotifs()`에서 `S.streak`을 SW에 전달하므로, 앱 재방문 시 최신 streak로 갱신된다.
- **Pull-to-Refresh**: `PTR_THRESHOLD = 80`(px). 스탠드얼론 PWA 모드에서만 정상 작동.
