# MR Snake — Design Document

---

## 1. WHAT — 상태 머신 (Beat 기반)

각 Beat는 하나의 경험 단위다. 진입 조건과 전환 조건만으로 전체 흐름을 기술한다.

---

### BEAT_0 : BOOT

**진입** 앱 로드 시 자동

| 동작 |
|------|
| WebXR 세션 초기화 |
| URL 파라미터 파싱 (`?mode=preset\|custom`) |
| SSE 연결 수립 — 서버와 상시 연결 유지 |
| preset 모드: 내장 텍스처 즉시 로드 |
| custom 모드: "대기 화면" 표시, 서버 푸시 대기 |
| 오디오 컨텍스트 초기화 |

**→ BEAT_1 조건 (preset)** WebXR 세션 활성화 + 내장 텍스처 로드 완료  
**→ BEAT_1 조건 (custom)** WebXR 세션 활성화 + SSE로 텍스처 수신 완료  
**→ 에러 정지** XR 미지원 브라우저 → 에러 메시지, 게임 불가

---

### BEAT_1 : READY

**진입** BOOT 완료 / GAME_OVER 이후 "다시하기" / GAME_OVER 이후 큐에서 다음 텍스처 수신

| 동작 |
|------|
| 플레이어 뒤 30cm에 HeadSphere 소환 |
| FoodOrb 3개(빨/노/파 각 1개) 공간 랜덤 배치 |
| 안내 텍스트 MR 공간 표시 |
| 점수 0으로 초기화 |

**→ BEAT_2 조건** 플레이어가 FoodOrb를 처음 그랩하는 순간

---

### BEAT_2 : PLAYING

**진입** 첫 그랩 이벤트

| 상시 동작 |
|-----------|
| HeadSphere가 플레이어 뒤를 따라다님 |
| BodySegment 체인이 뒤따름 |
| FoodOrb 3개 항상 공간에 유지 (먹히면 즉시 새 Orb 랜덤 스폰) |
| 꼬리 끝 BodySegment에 TailIndicator(깜빡임) 활성화 |
| 점수 실시간 표시 |

| 서브 이벤트 (Beat 전환 없음) | 트리거 | 결과 |
|---|---|---|
| 그랩 | 컨트롤러 grip → Orb 범위 내 | Orb "held" 상태 |
| 먹기 | held Orb ↔ HeadPosition ≤ 20cm | EAT — BodySegment 추가 + 점수 +1 + 사운드 |
| 스폰 | EAT 직후 | 같은 색 새 Orb 랜덤 위치에 등장 |

**→ BEAT_3 조건** 플레이어 헤드 위치 ↔ 꼬리 끝 BodySegment 중심 ≤ 10cm

---

### BEAT_3 : GAME_OVER

**진입** 꼬리 충돌 감지

| 동작 |
|------|
| 모든 이동 정지 (HeadSphere, BodySegment freeze) |
| GameOverOverlay 표시 (최종 점수 + 다시하기 프롬프트) |
| HeadSphere idle 흔들림 유지 (완전 정지 회피) |

**→ BEAT_1 조건 A (다시하기)** 플레이어가 "다시하기" 선택 → 같은 텍스처 유지, 점수 초기화  
**→ BEAT_1 조건 B (다음 학생)** 플레이어가 "다음 학생" 선택 + 큐에 텍스처 있음 → 다음 텍스처 로드  
**→ 대기 조건** "다음 학생" 선택했으나 큐 비어있음 → "대기 화면" 표시, SSE 수신 시 자동 BEAT_1

---

## 2. HOW — 컴포넌트 아키텍처

> **원칙** Figma에서 레이어(비주얼)와 인터랙션(로직)이 분리되듯,  
> 비주얼 컴포넌트는 Mesh만 반환하고 게임 로직을 모른다.  
> Scene Composition이 유일하게 둘을 연결한다.

---

### Visual Components — Mesh 반환, 로직 없음

```
HeadSphere
  props  : { texture: Texture, radius: number }
  returns: THREE.Mesh
  notes  : 위치는 외부에서 설정. 내부에 위치 계산 없음.

BodySegment
  props  : { color: 'red'|'yellow'|'blue', radius: number }
  returns: THREE.Mesh
  variant: isLast(boolean) → TailIndicator 포함 여부 결정

FoodOrb
  props  : { color: 'red'|'yellow'|'blue', radius: number }
  returns: THREE.Group (Mesh + PointLight)

TailIndicator
  props  : { targetMesh: THREE.Mesh }
  returns: void
  effect : 깜빡임 + 흰 emissive 틴트 oscillation을 애니메이션 루프에 등록

ScoreDisplay
  props  : { score: number }
  returns: CSS2DObject
  notes  : score prop 변경 시 텍스트만 교체

GameOverOverlay
  props  : { score: number }
  returns: THREE.Group (패널 + 텍스트)
```

---

### Functional Components — 로직만, Mesh 생성 없음

```
GameStateMachine
  역할  : 현재 Beat 관리, 전환 조건 평가, 진입/퇴장 이벤트 emit
          BEAT_2 중 SSE 수신 → 큐에 저장만, 즉시 반영 금지
          BEAT_3 이후 큐 확인 → 있으면 자동 로드, 없으면 대기 화면

SnakeController
  역할  : 플레이어 위치 히스토리 배열 유지, 각 segment 위치 계산
  API   : tick(playerPos) → void
          addSegment(color) → void
          getSegmentPositions() → {pos, color}[]

CollisionDetector
  역할  : 플레이어 위치 vs 꼬리 끝 segment 거리 체크
  API   : check(playerPos, tailPos, radius) → boolean

OrbSpawner
  역할  : 플레이어 최소 거리 보장하며 랜덤 위치 생성, 활성 Orb 목록 관리
  API   : spawn(color) → {position, color}
          remove(orbId) → void

EatDetector
  역할  : held 상태 Orb에 한해 얼굴 근접 판정
  API   : check(orbPos, headPos, threshold) → boolean

ScoreManager
  역할  : 점수 상태 단일 관리
  API   : increment() → void
          reset() → void
          get() → number
```

---

### Config — 매직넘버 없음

```js
const CONFIG = {
  head:    { radius: 0.15 },          // 지름 30cm
  body:    { radius: 0.10 },          // 지름 20cm
  orb:     { radius: 0.04 },
  snake:   { segmentSpacing: 0.22 },  // 구 간격
  eat:     { threshold: 0.20 },       // 얼굴 근접 판정 거리
  collision: { threshold: 0.10 },     // 꼬리 충돌 판정 반지름
  spawn:   { minDistFromPlayer: 0.8 }
}
```

---

### Scene Composition — 유일한 연결 레이어

- Beat 전환 시 비주얼 컴포넌트 생성/제거
- 매 프레임 `tick()`에서 Functional 컴포넌트 실행
- 실행 결과를 Visual 컴포넌트 위치에 반영
- A/B 분기(`mode=preset|custom`)는 이 레이어에서만 처리

```
animate() {
  tick()          // 로직 실행
  syncVisuals()   // 결과 → 메시 위치 동기화
  renderer.render()
}
```

---

## 3. 텍스처 매핑

### 재료

**굵은 수성 마커** 최적. 선이 두껍고 채도가 높아 촬영 시 명확하게 인식됨.

| 재료 | 적합도 | 이유 |
|------|--------|------|
| 굵은 수성/유성 마커 | ✅ 최적 | 두꺼운 선, 높은 채도 |
| 크레파스 | ⚠️ 보통 | 왁스 반사, 얇게 발리면 희미 |
| 색연필 | ❌ 부적합 | 선이 가늘고 연함 |
| 수채화 | ❌ 부적합 | 번짐, 건조 후 색 불균일 |

원 안을 최대한 꽉 채우도록 유도. 여백이 많으면 구 표면에서 얼굴이 작아 보임.

---

### 이미지 추출 위치

**교사 폰 브라우저 (클라이언트 사이드 Canvas API)** 에서 처리 후 서버 업로드.

```
카메라 촬영
  → Canvas API: 원 감지 → 크롭 → 원형 마스크(바깥 투명) → 512×512 리사이즈
  → 처리된 PNG만 서버로 업로드
```

정밀도 향상을 위해 **템플릿지 4모서리에 QR 파인더 패턴 마커 인쇄**.
JS가 마커를 감지해 원 위치를 자동 계산 → 비스듬히 찍어도 원근 보정 가능.

**마커 스펙**

| 항목 | 값 |
|------|----|
| 형태 | QR 코드 코너와 동일한 중첩 사각형 (검정-흰-검정 3단계) |
| 비율 | 검정 1 : 흰 1 : 검정 3 : 흰 1 : 검정 1 |
| 마커 크기 | 20×20mm |
| 외곽 테두리 | 3mm |
| 내부 흰 여백 | 3mm |
| 내부 검정 사각형 | 8×8mm |
| A4 모서리 여백 | 10mm |

원 테두리(두께 3mm)는 마커 감지 및 크롭 기준으로만 사용. **텍스처에 포함하지 않음.**
크롭 시 원 테두리 안쪽만 추출.

---

### 구 매핑 방식

**앞면 정사영 + 항상 플레이어 바라보기** 채택.

원 이미지를 구의 앞 반구에만 매핑하고, 나머지는 흰색. 매 프레임 HeadSphere가 플레이어 방향을 향함.

```
앞 반구 → 내가 그린 얼굴 텍스처 (소프트 페이드)
뒷 반구 → 흰색
```

**경계 처리 — 소프트 페이드**

Canvas API 추출 단계에서 원형 방사형 그라디언트 마스크 적용.
원 테두리는 텍스처에 포함하지 않으며, 경계선이 드러나지 않도록 처리.

```
중앙 → 100% 불투명
원 반지름 70% 지점부터 → 서서히 투명
원 테두리 → 0% (완전 투명)
```

구 기본 소재색을 흰색으로 통일. A4 종이(흰색) 배경과 같은 색이므로 아이가 채우지 않은 여백 영역도 구 표면과 자연스럽게 블렌딩됨.

**항상 바라보기를 선택한 이유**
스네이크 게임에서 플레이어는 긴장하며 뒤를 힐끔 돌아봄. 그 순간 자기 얼굴이 자신을 바라보고 있는 경험이 가장 강한 인상을 줌. 가설 검증(자신이 그린 것과의 연결감)에도 얼굴이 항상 인식되는 쪽이 유리함.

천천히 회전하는 경우, 뒤를 돌아봤을 때 옆면이나 뒷면이 보일 수 있어 "내 얼굴"이라는 인식이 약해짐.

**구현**

```js
// 매 프레임, 급격한 스핀 방지를 위해 slerp 적용
headSphere.quaternion.slerp(targetQuaternion, 0.1)
```

직접 `lookAt` 대신 slerp로 부드럽게 따라가게 함. 플레이어가 제자리 회전 시 구가 급격히 스핀하는 것을 방지.

---

## 4. 금지사항

### 구현

| # | 금지 | 이유 |
|---|------|------|
| 1 | `animate()` 안에 게임 로직 직접 작성 | 렌더 루프는 `tick()` 호출만 담당 |
| 2 | 하나의 함수에 Mesh 생성 + 위치 계산 + 이벤트 혼합 | 비주얼/로직 분리 원칙 위반 |
| 3 | CONFIG 외부에 매직넘버 작성 | `0.15`, `0.22` 등 숫자를 코드에 직접 기입하지 않음 |
| 4 | A/B 분기를 Visual Component 내부에서 처리 | Scene Composition 레이어에서만 처리 |
| 5 | 물리 엔진 도입 (Cannon.js 등) | 거리 계산으로 충분, 불필요한 복잡도 |
| 6 | 꼬리 전체 충돌 판정 | 마지막 구 하나만 체크, 난이도 의도 유지 |
| 7 | BEAT_2 중 SSE 수신 즉시 텍스처 교체 | 플레이 중인 학생의 게임을 방해함, 반드시 큐에만 저장 |

### 경험 설계

| # | 금지 | 이유 |
|---|------|------|
| 1 | 그림 미션 복잡화 | 템플릿 원 안에 얼굴 하나만, 누구나 그릴 수 있어야 함 |
| 2 | 게임 중 텍스처/표정 변경 | 텍스처는 게임 내내 고정 |
| 3 | 동시 멀티플레이어 구조 | 단일 플레이어만 |
| 4 | ML/CV 파싱 (세그멘테이션 등) | 템플릿 크롭만으로 이미지 처리 |
| 5 | 물고기 실루엣처럼 앞/뒤면이 다른 형태 | 구형으로 확정, 앞뒤 문제 없음 |
| 6 | 구 크기 동일화 | 머리(30cm) > 몸통(20cm), 시각적 위계 유지 |
| 7 | 원 테두리를 텍스처에 포함 | 테두리는 감지/크롭 기준으로만 사용, 소프트 페이드로 경계 처리 |
| 8 | 구 기본색을 흰색 외 색상으로 설정 | 흰 종이 배경과 통일해야 블렌딩이 자연스러움 |
