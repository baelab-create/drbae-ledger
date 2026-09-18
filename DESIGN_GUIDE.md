# 배랩 뉴모픽 UI 디자인 가이드 (Red & Blue Neumorphic)

배랩 파트너 관리대장에서 확정한 뉴모픽(Neumorphic) 컬러·디자인 규칙입니다.
다른 프로그램에서도 **같은 모습**을 내기 위한 기준 문서이며, 맨 아래의 토큰 CSS를 그대로 붙이면 절반은 끝납니다.

- 기준 구현: `shared/neo.css` (기존 스타일 뒤에 실어 겉모습만 덮어쓰는 테마 파일)
- 확정일: 2026-09-18
- 한 줄 요약: **거의 흰 회색 바탕 위에, 바탕보다 살짝 밝은 면이 부드러운 그림자로 떠 있고, 입력하는 곳은 안으로 눌려 있다. 고르는 것은 레드, 열어서 보고 쓰는 것은 블루.**

---

## 1. 핵심 원칙 7가지

1. **면은 세 가지 높이만 쓴다.** 바탕(0) · 떠 있는 면(+1) · 눌린 면(−1). 그 밖의 높이는 만들지 않는다.
2. **높이는 한 단계씩 번갈아 쌓는다.** 떠 있는 카드 → 그 안의 눌린 입력칸·우물 → 그 안의 떠 있는 작은 카드. 떠 있는 면 안에 또 떠 있는 상자를 넣지 않는다(이중 그림자 금지).
3. **테두리 선 대신 그림자로 구분한다.** `border`는 쓰지 않는다. 예외는 의미를 가진 1px 강조 외곽선(선택·경고)과 표의 가는 구분선뿐이다.
4. **빛은 왼쪽 위에서 온다.** 밝은 그림자는 왼쪽 위, 어두운 그림자는 오른쪽 아래. 모든 요소가 같은 방향이어야 한다.
5. **흰 하이라이트만 믿지 않는다.** 바탕이 밝아 왼쪽·위 가장자리가 묻히므로, 떠 있는 면에는 항상 ‘사방 얕은 음영 + 1px 흰 안쪽 테두리’를 함께 준다(3장 참고).
6. **색은 두 가지 역할로만 쓴다.** 레드 = 고르기·이동(탭, 정렬, 선택된 항목, 주요 실행). 블루 = 열어 본 내용·입력(상세 상자 안, 기록 폼, 바깥으로 나가는 버튼).
7. **그라데이션은 가로 방향, 왼쪽이 진하고 오른쪽이 연하다.** 대각선 그라데이션은 쓰지 않는다.

---

## 2. 컬러

### 2-1. 중립색 (면과 글자)

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--paper` | `#E9EAEC` | 눌린 면의 색, 입력칸·우물·홈(track) 바탕 |
| `--face` | `#F7F8FA` | 떠 있는 면(카드·버튼·칩)의 색. 바탕보다 반드시 밝게 |
| `--ink` | `#3A3E48` | 본문·제목 글자 (순검정 금지) |
| `--ink-2` | `#666B78` | 보조 글자, 선택 안 된 탭·칩 |
| `--ink-3` | `#9BA1AD` | 설명·라벨·자리표시자 |
| `--line` / `--line-2` | `#E2E4E8` / `#E6E8EC` | 표 구분선, 카드 머리글 아래 1px 선 |
| `--sh-dark` | `#CFD2D8` | 어두운 그림자 색 |
| `--sh-light` | `#FFFFFF` | 밝은 그림자 색 |

### 2-2. 페이지 배경

단색이 아니라 **회색 → 흰색으로 흐르는 은은한 대각 그라데이션 + 가운데 위쪽의 옅은 빛**을 쓴다. 화면에 고정(`fixed`)한다.

```css
body{
  background:
    radial-gradient(1200px 700px at 62% 38%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 60%),
    linear-gradient(135deg,#D9DBE0 0%,#E4E6EA 40%,#EEEFF2 75%,#F6F6F8 100%);
  background-attachment:fixed;
}
```

- 시작 색을 `#C9CBD1`보다 어둡게 하면 과하다(시도 후 되돌림). `#D9DBE0` 정도가 한계.
- 배경 그라데이션만 예외적으로 135도 대각선이다. 버튼 그라데이션과 혼동하지 말 것.

### 2-3. 강조색

| 역할 | 토큰 | 값 |
|---|---|---|
| 레드 기본 / 진한 | `--acc` / `--acc-2` | `#F5484F` / `#E5303A` |
| 레드 그라데이션 | `--acc-grad` | `linear-gradient(90deg,#E5303A 0%,#FF7B7B 100%)` |
| 레드 그림자 | `--sh-acc` | `0 8px 18px rgba(240,53,63,.30), -3px -3px 8px rgba(255,255,255,.7)` |
| 블루 기본 / 진한 | `--blue` / `--blue-2` | `#3B82F6` / `#2563EB` |
| 블루 그라데이션 | `--blue-grad` | `linear-gradient(90deg,#2F6BE0 0%,#6AA6FF 100%)` |
| 블루 그림자 | `--sh-blue` | `0 5px 12px rgba(47,107,224,.35), 0 1px 0 rgba(255,255,255,.5) inset` |

그라데이션 위의 글자는 항상 `#fff`.

### 2-4. 레드와 블루를 나누는 규칙

| 레드(고르기·이동) | 블루(내용·입력) |
|---|---|
| 상단 탭의 선택 상태 | 펼친 상세 상자 안의 번호·링크 버튼·라벨 |
| 정렬·필터 칩의 선택 상태 | 기록·입력 폼의 선택 칩, 저장 버튼 |
| 목록에서 선택된 줄의 번호·이름·가는 외곽선 | 입력칸 포커스 테두리 |
| 접이식 머리글(“신규 ○○ 추가하기”) | 제자리 수정 폼의 외곽선 |
| 목록 화면의 주요 실행 버튼 | 바깥 페이지로 나가는 버튼(자료실 등) |
| 경고·미완료 표시, “이번 달” 태그 | 안내문 상자의 왼쪽 띠 |

판단이 애매하면: **목록·내비게이션 층이면 레드, 한 항목 안으로 들어간 뒤면 블루.**

### 2-5. 의미색 (상태 표시에만)

| 의미 | 색 | 표현 |
|---|---|---|
| 완료·정상 | `#4E9A6E` | 흰 면 + 1px 초록 외곽선 알약 |
| 미완료·위험 | `--acc-2` | 흰 면 + 1px 레드 외곽선 알약 |
| 주의 | `#C9871B` | 숫자 색 또는 옅은 배경 `rgba(201,135,27,.06)` |
| 없음·비활성 | `--ink-3` | 눌린 회색 알약 |

상태는 **배경색 덩어리가 아니라 외곽선**으로 표현한다. 분류용 고유색(예: 연락 방식 전화 `#4C7FC9`·카톡 `#E5B800`·문자 `#3E9C87`·대면 `#8A5FC2`, 제품군 그래프 색)은 카드 왼쪽 5px 띠나 작은 칩에만 쓴다.

---

## 3. 그림자 (이 디자인의 핵심)

### 3-1. 세 가지 크기 × 두 가지 방향

| 토큰 | 용도 |
|---|---|
| `--sh-out` | 큰 카드, 현황 카드, 선택된 줄, 로그인 상자 |
| `--sh-out-s` | 목록의 줄, 일반 버튼, 표 상자, 폼 카드, 기록 카드 |
| `--sh-out-xs` | 칩, 작은 버튼, 알약, 메모 상자 |
| `--sh-in` | 큰 입력칸(여러 줄 입력), 기록 우물 |
| `--sh-in-s` | 한 줄 입력칸, 드롭다운, 번호 동그라미, 탭 홈(track), 링크 상자, 로그 |

### 3-2. 떠 있는 면은 네 겹

```css
--sh-amb : 0 1px 3px rgba(58,62,72,.12), 0 0 0 1px rgba(58,62,72,.045);  /* 사방 얕은 음영 */
--sh-edge: inset 0 0 0 1px rgba(255,255,255,.85);                        /* 1px 흰 안쪽 테두리 */
--sh-out : 8px 8px 18px var(--sh-dark), -6px -6px 14px var(--sh-light), var(--sh-amb), var(--sh-edge);
```

① 오른쪽 아래 어두운 그림자 ② 왼쪽 위 흰 그림자 ③ 사방 얕은 음영 ④ 1px 흰 안쪽 테두리.
③④가 없으면 왼쪽·위 가장자리가 배경에 묻힌다. **네 겹을 항상 함께 쓴다.**

### 3-3. 눌린 면은 세 겹

```css
--sh-in: inset 5px 5px 11px var(--sh-dark), inset -5px -5px 11px var(--sh-light), inset 0 0 0 1px rgba(58,62,72,.05);
```

눌린 면의 바탕은 `--paper`(어두운 쪽), 떠 있는 면의 바탕은 `--face`(밝은 쪽). 이 두 색을 바꿔 쓰면 입체가 뒤집혀 보인다.

### 3-4. 색 있는 버튼의 그림자

그라데이션 버튼은 회색 그림자 대신 **자기 색의 번짐**을 쓴다(`--sh-acc`, `--sh-blue`). 작은 요소는 `0 3px 8px rgba(색,.35)` 정도로 줄인다.

---

## 4. 모양·크기

| 항목 | 값 |
|---|---|
| 큰 카드 모서리 `--r` | 18px |
| 작은 면·입력칸 `--r-s` | 12px |
| 탭 홈(track) / 탭 버튼 | 16px / 12px |
| 칩(정렬·필터) | 20px (알약) |
| 상태 알약 | 12px, 안쪽 여백 3px 10px |
| 번호 동그라미 | 28px 원 |
| 카드 안쪽 여백 | 20px 22px (큰 카드), 16px 18px (현황·작은 카드) |
| 목록 줄 머리글 여백 | 13px 18px (펼친 상태 16px 20px 14px) |
| 입력칸 안쪽 여백 | 9px 12px (여러 줄 입력 12px 14px, 최소 높이 120~150px) |
| 버튼 안쪽 여백 | 8px 15px (작은 버튼 5px 11px, 탭 9px 18px) |
| 카드 사이 간격 | 8~16px |
| 글자 굵기 | 버튼·탭·칩 700, 제목 800, 본문 400~600 |

전환 효과는 `box-shadow .15s, color .15s, transform .08s`만 쓴다. 움직임은 누를 때 1px 내려가는 것이 전부다.

---

## 5. 컴포넌트 규칙

### 5-1. 헤더(로고 바 + 탭)
- 로고 바와 탭 줄을 **한 덩어리**로 본다. 그림자는 헤더 전체 아래에 한 번만(`0 12px 24px -16px rgba(58,62,72,.45)`). 로고 바 자체에는 그림자를 주지 않는다.
- 고정(sticky) 헤더는 `rgba(232,233,236,.8)` + `backdrop-filter:blur(10px)`로 반투명 처리해 배경 그라데이션이 끊기지 않게 한다.
- 어두운 색 바를 쓰지 않는다. 로고는 진한 색 버전을 쓴다.

### 5-2. 탭 = 눌린 홈 안의 세그먼트
- 탭 버튼들을 **눌린 홈(track) 하나**에 넣는다: `background:var(--paper); box-shadow:var(--sh-in-s); border-radius:16px; padding:5px; gap:4px`.
- 홈 안의 버튼은 배경·그림자 없음. 마우스를 올리면 `rgba(255,255,255,.55)`.
- 선택된 버튼만 레드 그라데이션 + 레드 그림자 + 위쪽 1px 흰 안쪽 선.
- 탭이 아닌 **바깥으로 나가는 버튼**은 홈에서 빼내 오른쪽에 단독으로 두고 블루 그라데이션.
- 좁은 화면에서는 홈을 가로 스크롤(스크롤바 숨김)하고, 헤더의 부가 문구는 숨긴다.

### 5-3. 버튼
| 종류 | 모습 |
|---|---|
| 기본 | `--face` 면 + `--sh-out-s`, 글자 `--ink`. 올리면 글자만 강조색 |
| 주요 실행 | 레드 그라데이션 + `--sh-acc` (상세·입력 영역 안에서는 블루) |
| 작은 버튼 | `--sh-out-xs` |
| 위험(삭제·중지) | 흰 면 그대로, 글자만 `#C8102E` |
| 누름 | `translateY(1px)` + `--sh-in-s` |
| 비활성 | 투명도 .5 |

### 5-4. 칩(정렬·필터·선택)
- 선택 안 됨: `--face` + `--sh-out-xs`, 글자 `--ink-2`.
- 선택됨: 그라데이션(목록 층은 레드, 입력 층은 블루) + 같은 색 그림자.
- 의미별 고유색이 있던 선택 칩도 **선택 상태는 테마 색 하나로 통일**한다.

### 5-5. 입력칸
- 테두리 없음, `--paper` 바탕, `--sh-in-s`(큰 칸은 `--sh-in`), 모서리 12px.
- 포커스: 그림자 유지 + `0 0 0 1.5px rgba(47,107,224,.45)`(블루) 추가. `outline`은 끈다.
- 자리표시자 `#A3ACC2`. 체크박스는 `accent-color`로 강조색.
- 기존 코드에 입력칸 전용 `border`·초록 포커스 등이 남아 있으면 **선택자 우선순위를 맞춰 반드시 덮어쓴다.**

### 5-6. 카드와 목록의 줄
- 카드: `--face` + `--sh-out`(줄은 `--sh-out-s`), 테두리 없음.
- 선택·펼친 줄: 그림자를 한 단계 키우고 `0 0 0 1px rgba(240,53,63,.55)` 가는 레드 외곽선, 이름은 레드, 번호 동그라미는 레드 그라데이션.
- 선택 안 된 줄의 번호 동그라미는 눌린 회색.
- 집중 모드에서 나머지 줄은 투명도 .5(올리면 .85).
- 펼친 머리글과 본문은 같은 면으로 잇고 1px `--line-2` 선만 둔다. 머리글에 다른 배경색을 깔지 않는다.

### 5-7. 상세 상자(펼친 내용)
- 구역은 **눌린 패널**(`--paper` + `--sh-in-s`, 모서리 12px).
- 구역 번호 동그라미, 링크 버튼, 라벨 강조, 하단 이동 버튼은 블루.
- 패널 안의 메모처럼 다시 떠야 하는 것은 `--face` + `--sh-out-xs`.

### 5-8. 기록·입력 폼
- 폼을 별도 상자로 감싸지 않고 카드 면 위에 바로 놓는다.
- 제목 앞에 8px 블루 점, 날짜 같은 보조 입력은 제목 줄 오른쪽 끝.
- 순서: 선택 칩 → 큰 입력칸(눌림) → 오른쪽 아래 저장(블루).
- 이전 기록은 **눌린 우물** 안에 **떠 있는 카드**로. 카드 왼쪽 5px 띠로 분류색 표시. “이번 달” 태그는 레드, 지난 달 태그는 흰 알약.
- 제자리 수정은 그 카드만 입력 상태로 바꾸고 1px 블루 외곽선을 준다. 옆 패널을 열지 않는다.

### 5-9. 현황(숫자) 카드
- 큰 숫자(800 굵기) + 작은 라벨. 기본 숫자는 `--ink`, 위험만 레드.
- 특별히 주의를 끌 카드 하나에만 손그림 강조(형광펜 라벨, 손글씨 밑줄, 한 획 별표)와 레드 외곽선을 허용한다. 값이 0이면 강조를 모두 끈다.

### 5-10. 표·알림·기타
- 표: 떠 있는 상자 안에, 머리글 배경 없음, 1px 구분선만. 경고 줄은 옅은 색 배경.
- 알람 카드: 흰 면 + 왼쪽 5px 레드 띠 + 1px 레드 외곽선.
- 안내문: 흰 면 + 왼쪽 5px 블루 띠.
- 링크·코드·로그 상자: 눌린 홈.
- 토스트: 레드 그라데이션, 모서리 14px.
- 접이식 머리글: 전체 폭 레드 그라데이션 막대, 펼치면 위쪽 모서리만 둥글게.

---

## 6. 하지 말 것

- 떠 있는 면 안에 떠 있는 상자를 또 넣기(이중 그림자).
- 면을 구분하려고 회색 `border` 쓰기.
- 버튼마다 그림자를 준 채 탭을 나란히 놓기 → 홈 하나에 넣는다.
- 어두운 색 상단 바, 순검정 글자, 순백 페이지 바탕.
- 대각선 버튼 그라데이션, 오른쪽이 진한 그라데이션.
- 레드와 블루를 한 영역 안에서 섞기, 제3의 강조색(초록·갈색·노랑 버튼) 추가.
- 상태를 색 덩어리 배경으로 표시하기.
- 클릭할 때 화면을 자동으로 스크롤시키기.
- 예전 스타일의 `border`·`background`를 남겨 둔 채 그림자만 얹기(우선순위에 밀려 어색한 조각이 남는다).

---

## 7. 적용 순서 (기존 프로그램에 입힐 때)

1. 테마 파일 하나(`neo.css`)를 만들어 **기존 스타일 뒤에** 불러온다. 기존 파일은 고치지 않는다. 되돌릴 때는 그 한 줄만 뺀다.
2. 8장의 토큰 블록을 붙이고 `body` 배경을 넣는다.
3. 면을 세 종류로 분류한다: 떠 있는 것(카드·버튼·칩) / 눌린 것(입력·홈·우물) / 바탕. 각각 `--face`·`--paper`와 그림자 토큰을 지정한다.
4. 모든 `border`를 0으로 하고, 필요한 곳만 1px 강조 외곽선을 `box-shadow`의 `0 0 0 1px`로 넣는다.
5. 헤더를 한 덩어리로, 탭을 홈 안 세그먼트로 바꾼다.
6. 레드/블루 역할표(2-4)에 따라 선택·실행 요소의 색을 정한다.
7. 화면별로 캡처해 확인한다: ① 네 변이 다 보이는가 ② 이중 그림자가 없는가 ③ 예전 색(초록·남색·크림)이 남지 않았는가 ④ 그라데이션이 왼쪽 진함인가.
8. 좁은 화면(375px)에서 헤더 높이와 탭 가로 스크롤을 확인한다.
9. 스타일 파일 주소에 버전 쿼리(`neo.css?v=17`)를 붙여 캐시를 끊는다.

---

## 8. 토큰 CSS (그대로 붙여 쓰기)

```css
:root{
  /* 글자 */
  --ink:#3A3E48; --ink-2:#666B78; --ink-3:#9BA1AD;
  /* 면 */
  --paper:#E9EAEC;            /* 눌린 면 */
  --face:#F7F8FA;             /* 떠 있는 면 */
  --line:#E2E4E8; --line-2:#E6E8EC;
  /* 레드: 고르기·이동 */
  --acc:#F5484F; --acc-2:#E5303A;
  --acc-grad:linear-gradient(90deg,#E5303A 0%,#FF7B7B 100%);
  --sh-acc:0 8px 18px rgba(240,53,63,.30),-3px -3px 8px rgba(255,255,255,.7);
  /* 블루: 내용·입력 */
  --blue:#3B82F6; --blue-2:#2563EB;
  --blue-grad:linear-gradient(90deg,#2F6BE0 0%,#6AA6FF 100%);
  --sh-blue:0 5px 12px rgba(47,107,224,.35),0 1px 0 rgba(255,255,255,.5) inset;
  /* 그림자 */
  --sh-dark:#CFD2D8; --sh-light:#FFFFFF;
  --sh-amb:0 1px 3px rgba(58,62,72,.12),0 0 0 1px rgba(58,62,72,.045);
  --sh-edge:inset 0 0 0 1px rgba(255,255,255,.85);
  --sh-out:8px 8px 18px var(--sh-dark),-6px -6px 14px var(--sh-light),var(--sh-amb),var(--sh-edge);
  --sh-out-s:5px 5px 12px var(--sh-dark),-4px -4px 10px var(--sh-light),var(--sh-amb),var(--sh-edge);
  --sh-out-xs:3px 3px 7px var(--sh-dark),-2px -2px 6px var(--sh-light),var(--sh-amb),var(--sh-edge);
  --sh-in:inset 5px 5px 11px var(--sh-dark),inset -5px -5px 11px var(--sh-light),inset 0 0 0 1px rgba(58,62,72,.05);
  --sh-in-s:inset 3px 3px 7px var(--sh-dark),inset -3px -3px 7px var(--sh-light),inset 0 0 0 1px rgba(58,62,72,.05);
  /* 모양 */
  --r:18px; --r-s:12px;
}
html{background:#EDEEF0}
body{
  color:var(--ink);
  background:
    radial-gradient(1200px 700px at 62% 38%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 60%),
    linear-gradient(135deg,#D9DBE0 0%,#E4E6EA 40%,#EEEFF2 75%,#F6F6F8 100%);
  background-attachment:fixed; min-height:100vh;
}

/* 기본 조각 */
.neo-raised   {background:var(--face); border:0; border-radius:var(--r);   box-shadow:var(--sh-out)}
.neo-raised-s {background:var(--face); border:0; border-radius:var(--r-s); box-shadow:var(--sh-out-s)}
.neo-raised-xs{background:var(--face); border:0; border-radius:var(--r-s); box-shadow:var(--sh-out-xs)}
.neo-inset    {background:var(--paper);border:0; border-radius:var(--r);   box-shadow:var(--sh-in)}
.neo-inset-s  {background:var(--paper);border:0; border-radius:var(--r-s); box-shadow:var(--sh-in-s)}
.neo-red      {background:var(--acc-grad); color:#fff; border:0; box-shadow:var(--sh-acc)}
.neo-blue     {background:var(--blue-grad);color:#fff; border:0; box-shadow:var(--sh-blue)}
.neo-selected {box-shadow:var(--sh-out),0 0 0 1px rgba(240,53,63,.55)}
.neo-editing  {box-shadow:var(--sh-out-s),0 0 0 1px rgba(47,107,224,.45)}

/* 입력칸 */
input,select,textarea{background:var(--paper);border:0;border-radius:var(--r-s);box-shadow:var(--sh-in-s);color:var(--ink);padding:9px 12px;outline:none;transition:box-shadow .15s}
input:focus,select:focus,textarea:focus{box-shadow:var(--sh-in-s),0 0 0 1.5px rgba(47,107,224,.45)}
input::placeholder,textarea::placeholder{color:#A3ACC2}

/* 버튼 */
.btn{background:var(--face);border:0;border-radius:var(--r-s);box-shadow:var(--sh-out-s);color:var(--ink);font-weight:700;padding:8px 15px;cursor:pointer;transition:box-shadow .15s,transform .08s,color .15s}
.btn:active{transform:translateY(1px);box-shadow:var(--sh-in-s)}
.btn.primary{background:var(--acc-grad);color:#fff;box-shadow:var(--sh-acc)}
.btn.primary.blue{background:var(--blue-grad);box-shadow:var(--sh-blue)}

/* 탭: 눌린 홈 안의 세그먼트 */
.tabs{display:inline-flex;gap:4px;padding:5px;border-radius:16px;background:var(--paper);box-shadow:var(--sh-in-s)}
.tabs button{background:transparent;border:0;border-radius:12px;padding:9px 18px;color:var(--ink-2);font-weight:700;cursor:pointer}
.tabs button:hover{background:rgba(255,255,255,.55);color:var(--ink)}
.tabs button[aria-selected="true"]{background:var(--acc-grad);color:#fff;box-shadow:0 5px 12px rgba(240,53,63,.35),0 1px 0 rgba(255,255,255,.6) inset}

/* 칩 */
.chip{background:var(--face);border:0;border-radius:20px;box-shadow:var(--sh-out-xs);color:var(--ink-2);padding:6px 13px;font-size:12px;font-weight:700;cursor:pointer}
.chip.on{background:var(--acc-grad);color:#fff;box-shadow:var(--sh-acc)}

/* 상태 알약 */
.pill{display:inline-block;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:600;background:var(--face)}
.pill.ok  {color:#4E9A6E;      box-shadow:var(--sh-out-xs),0 0 0 1px rgba(78,154,110,.45)}
.pill.crit{color:var(--acc-2); box-shadow:var(--sh-out-xs),0 0 0 1px rgba(240,53,63,.55)}
.pill.idle{color:var(--ink-3); background:var(--paper); box-shadow:var(--sh-in-s)}

/* 고정 헤더 */
.header{position:sticky;top:0;z-index:50;background:rgba(232,233,236,.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 12px 24px -16px rgba(58,62,72,.45)}
```

---

## 9. 점검표 (배포 전)

- [ ] 페이지 바탕이 단색이 아니라 회색→흰색 그라데이션인가
- [ ] 떠 있는 면은 `--face`, 눌린 면은 `--paper`인가 (뒤바뀌지 않았는가)
- [ ] 떠 있는 면의 왼쪽·위 가장자리가 배경과 구분되는가
- [ ] 떠 있는 면 안에 떠 있는 상자가 또 없는가
- [ ] `border`로 그린 상자가 남아 있지 않은가
- [ ] 탭이 홈 하나에 들어가 있고, 헤더 그림자가 한 번만 깔리는가
- [ ] 선택·이동은 레드, 상세·입력은 블루로 나뉘어 있는가
- [ ] 그라데이션이 가로 방향, 왼쪽 진함인가
- [ ] 입력칸 포커스가 블루 1.5px인가 (예전 색이 남지 않았는가)
- [ ] 상태 표시는 외곽선 알약인가
- [ ] 375px 화면에서 헤더가 두 줄을 넘지 않는가
