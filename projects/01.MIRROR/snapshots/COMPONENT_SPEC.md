# MIRROR MR — 컴포넌트 명세서 v1
**목적**: 비쥬얼 문법 적용 전 구조 감사(Audit)
**기준**: 피그마 컴포넌트 분해 원칙 적용
**코드 파일**: `index.html` (단일 파일)

> **2026-05-18 갱신**: 테스트 종료에 따라 C01 Cube, C05 HandSkeleton 삭제됨.
> 시나리오 토글(`scenario`/`btnToggle`)도 C01 종속이라 함께 정리됨.
> 물고기 거울 opacity 0.72 → 1.0 (물리 거울 원칙 적용).

---

## 피그마 원칙 → 코드 매핑

| 피그마 개념 | 코드 대응 |
|---|---|
| Component | 기능 단위 함수/클래스 |
| Instance | Real + Mirror 쌍 |
| Variant | state 변수 (phase, scenario 등) |
| Property | Constants / 매개변수 |
| Layer | Mesh / Material / Geometry |
| Auto-layout | 애니메이션 루프 내 업데이트 순서 |
| Atom | 단일 Mesh + Material |
| Molecule | 여러 Atom의 조합 (Group) |
| Organism | 독립 기능 단위 (update 함수 포함) |

---

## 디자인 토큰 (Constants)

피그마에서 Style/Token에 해당하는 전역 상수. 비쥬얼 문법 교체 시 이 값들이 우선 검토 대상.

### 공간 구조 토큰
```
MIRROR_DIST  = 1.5m    거울 평면까지 거리
HEAD_ABOVE   = 0.30m   기준 오브젝트(큐브)의 눈 위 높이
CUBE_SIZE    = 0.20m   기준 오브젝트 크기
```

### 구체 토큰
```
SPHERE_RADIUS      = 0.12m
SPHERE_MOVE_SPEED  = 0.35m/s
SPHERE_STOP_DIST   = 0.5m   (사용자 앞)
SPHERE_HOVER_TIME  = 3.0s
SPHERE_RISE_SPEED  = 0.12m/s
SPHERE_FADE_SPEED  = 0.35/s
```

### 물고기 토큰
```
FISH_MODEL_LENGTH   = 0.22m
FISH_MODEL_YAW      = π     (모델 방향 보정)
FISH_APPROACH_SPEED = 0.45m/s
FISH_SPAWN_DIST     = 1.3m  (거울 뒤)
FISH_CROSS_DUR      = 0.55s
FISH_DRIFT_Z_MIN    = 0.25m (거울 앞)
FISH_DRIFT_Z_MAX    = 0.35m (사용자 앞)
FISH_CALL_DIST      = 0.50m
FISH_ORBIT_R        = 0.40m
```

### 음성 토큰
```
VOICE_THRESH  = 0.02 RMS   진입 기준
VOICE_HOLD    = 2.0s       상태 유지 시간
VOICE_HYST    = 0.25       탈출 히스테리시스
VOICE_ATK     = 0.18       상승 스무딩
VOICE_REL     = 0.04       하강 스무딩
VOICE_LINGER  = 2.5s       침묵 후 여운
```

### 물리 토큰
```
FISH_SPRING_K = 3.5
FISH_SPRING_D = 0.88  (감쇠)
PART_GRAVITY  = -1.0 m/s²
PART_FLOOR_Y  = 0.015m
PART_REST_TIME= 60s
```

### 손 인터랙션 토큰
```
PINCH_THRESHOLD  = 0.02m
INDEX_EXTEND_MIN = 0.14m   (포인팅: 검지 폄 판정)
CURL_MAX         = 0.13m   (포인팅: 나머지 굽힘 판정)
LAZY_LERP        = 0.07    (포인터 추종 속도)
```

### 색상 토큰 (현재 스켈레톤 값 — 교체 예정)
```
실제 손    joint: #ffe8d6, line: #ffccaa, emissive: #ffaa66
거울 손    joint: #88ccff, line: #55aaff, emissive: #2255ff
포인터     core: #ffffff, halo: #88ccff (opacity 0.28)
파티클     gold→white (shader 내장)
파티클     기준 color: vec3(1.0, 0.92, 0.55) → vec3(1.0)
Trail      white→skyblue (vec3(0.55, 0.75, 1.0) → vec3(1.0))
큐브 실    #ff1a1a (red)
큐브 거울  #ff7777 (light red)
가이드     #00e5ff (cyan)
리플 링    #4fc3f7 (light blue)
손목 패널  normal: #888888 / pressed: #ff69b4
```

---

## 글로벌 컨텍스트 (Scene Root)

컴포넌트가 아님. 모든 컴포넌트가 읽는 공유 상태.

```
spawnPos       { x, z }   캘리브레이션 앵커 (세션 시작 1회 확정)
spawnEyeY      number     캘리브레이션 눈 높이
mirrorZ        number     거울 평면 Z = spawnZ - MIRROR_DIST
scenario       1 | 2      디스플레이 모드
currentHeadX/Y/Z          매 프레임 갱신되는 헤드 위치
```

---

## 컴포넌트 카탈로그

---

### ~~C01 — ReferenceObject (Cube)~~ — 삭제됨 (2026-05-18)

테스트용 헤드 레퍼런스. 비쥬얼 문법 적용 단계에서 삭제. `scenario`/`btnToggle`도 함께 정리됨.

---

### C02 — MirrorGuide

> **역할**: 거울 평면 위치 시각화 가이드. 캘리브레이션 완료 후 상시 표시.

**Layer Structure**

```
guideGroup  Group
├── bar       Mesh  BoxGeometry(1.2, 0.012, 0.04)  MeshBasic  #00e5ff
├── post_L    Mesh  BoxGeometry(0.04, 0.28, 0.04)  MeshBasic  #00e5ff
├── post_R    Mesh  BoxGeometry(0.04, 0.28, 0.04)  MeshBasic  #00e5ff
└── arrow     Mesh  ConeGeometry(0.06, 0.15, 4)    MeshBasic  #00e5ff
```

**Variants**

```
Before calibration:  visible = false
After calibration:   visible = true (영구)
```

**Logic**
- 위치: (spawnX, 0.005, mirrorZ) — 1회 고정
- 애니메이션 없음. 업데이트 없음.
- 거울 쌍 없음 (이 자체가 거울 평면에 위치)

**현재 스켈레톤 표식**: cyan U자형 프레임 → 교체 예정 또는 제거

---

### C03 — MirrorCrossingSphere

> **역할**: 거울을 통과하는 데모 오브젝트. 거울 전/후 외관 분리 시연.

**Layer Structure**

```
graySphere  Mesh  SphereGeometry(0.12, 32, 32)  MeshStandard  gray   [뒤]
blueSphere  Mesh  SphereGeometry(0.12, 32, 32)  MeshStandard  blue   [앞]
```
*shared geometry — 같은 SphereGeometry 재사용*

**Instance Props**

| 속성 | graySphere | blueSphere |
|---|---|---|
| color | #9e9e9e | #1565c0 |
| emissive | 없음 | #0d47a1 (0.35) |
| clipping | 거울 뒤쪽만 렌더 | 거울 앞쪽만 렌더 |
| 역할 | 거울 밖 (현실) | 거울 안 (반사면) |

**Variants (Phase)**

```
idle      → 둘 다 hidden
moving    → graySphere VISIBLE  (mirrorZ 쪽으로 이동)
hovering  → graySphere VISIBLE  (userZ - 0.5m 에 정지)
rising    → 둘 다 fade + Y상승  (opacity 감소)

crossing (mirrorZ 근처):
  fullyBehind  → graySphere only, clipping 없음
  fullyInFront → blueSphere only, clipping 없음
  straddling   → 둘 다 VISIBLE, clipping planes 적용
```

**Logic**
- 부유 bob: sin(timestamp × 0.0025) × 0.015
- clipping plane: grayClipPlane (z < mirrorZ), blueClipPlane (z > mirrorZ)
- mirrorZ 교차 시 → C04 MirrorCrossingEffect trigger
- 버튼 토글로 시작/취소

**거울 쌍**: 없음 (gray/blue 분리 자체가 거울 표현)

---

### C04 — MirrorCrossingEffect (VFX)

> **역할**: 오브젝트가 거울면을 통과할 때 발생하는 시각 이펙트.

**Layer Structure**

```
rippleMeshes[0]  Mesh  TorusGeometry(1, 0.018)  MeshBasic  #4fc3f7  delay: 0.0s
rippleMeshes[1]  Mesh  TorusGeometry(1, 0.018)  MeshBasic  #4fc3f7  delay: 0.13s
rippleMeshes[2]  Mesh  TorusGeometry(1, 0.018)  MeshBasic  #4fc3f7  delay: 0.26s
flashMesh        Mesh  SphereGeometry(1)         MeshBasic  #90caf9
mirrorLight      PointLight  #4fc3f7
```

**Variants**

```
inactive  (mirrorEffectTimer = -1):  모두 hidden
active    (timer >= 0):              애니메이션 진행 중
```

**Props (Trigger 시 주입)**
```
position  { x, y, z }  이펙트 발생 위치
```

**Animation Timeline**
```
t=0.00~0.65s  Ripple 0: scale 0→0.55, opacity 0.75→0
t=0.13~0.78s  Ripple 1: 동일 (stagger)
t=0.26~0.91s  Ripple 2: 동일 (stagger)
t=0.00~0.25s  Flash: scale 0→0.3, opacity 0.9→0
t=0.00~0.30s  Light: intensity 0→4→0 (sin curve)
total: ~1.0s
```

**트리거 출처**: C03 sphere 교차 / C11 fish 교차 — 공용

**거울 쌍**: 없음 (mirrorZ 평면 자체에서 발생)

---

### ~~C05 — HandSkeleton~~ — 삭제됨 (2026-05-18)

테스트용 관절 시각화. 사용자 손은 Quest 3 패스스루(실사)로만 보이도록 결정.
인터랙션 레이어(C07 파티클·C08 포인터·C09 트레일·C10 손목패널)만 마법으로 덧칠.
`HAND_JOINTS`, `HAND_CONNECTIONS`, `createHandVis()`, `updateHandVis()` 모두 정리됨.

---

### C06 — PinchGesture

> **역할**: 핀치 제스처 감지. 파티클 방출 및 오디오 트리거.

**Layer Structure**: 없음 (시각 레이어 없음)

**Instances**: 2개 (hand1, hand2)

**Props**
```
realHand    XR Hand 데이터
pinchObj    Object3D  (위치 캐리어 — 오디오 소스 부착용)
pinchAudio  PositionalAudio
wasPinching boolean  (이전 프레임 상태)
```

**Variants / Detection**
```
isPinching = dist(index-tip, thumb-tip) < PINCH_THRESHOLD (0.02m)
```

**Logic**
- rising edge (wasPinching=false → true) 시에만:
  - pinchObj 위치 = 중간점(index+thumb)
  - bellBuffer 재생 (stop+play)
  - emitParticles(mx, my, mz) 호출 → C07에 위임
- returns 현재 isPinching (다음 프레임 wasPinching용)

**의존**: C07 SparkleParticle, C13 SpatialAudio

---

### C07 — SparkleParticle

> **역할**: 핀치 시 방출되는 금빛 파티클. 중력, 바닥 착지, 거울 복제.

**Layer Structure**

```
partMesh   Points  BufferGeometry (custom shader)  [실제]
partMeshM  Points  BufferGeometry (custom shader)  [거울, 같은 Material 공유]
```

**Shader (built-in visual)**
```
vertex:  gl_PointSize = size × (400 / -mv.z)   원근 크기
frag:    glow = 1 - smoothstep(0, 1, r)
         col = mix(gold(1.0,0.92,0.55), white(1.0), 1-r)
         blending: AdditiveBlending
```

**Per-particle State Machine**
```
flying   → 중력 -1.0m/s², 수평 퍼짐, alpha=0.60
resting  → y=PART_FLOOR_Y, 정지, 60s 유지, 마지막 20s fade
```

**Props (emitParticles 호출 시)**
```
x, y, z  방출 위치
count    PART_PER_PINCH = 12 per call
```

**Eviction**: 400개 초과 시 가장 오래된 resting 파티클 제거

**거울 쌍**: _pPosM = (x, y, reflectZ(z)) — 같은 size/alpha 배열 공유

---

### C08 — PointerDot

> **역할**: 검지를 펼쳤을 때 나타나는 빛점. 포인팅 제스처 시각 피드백.

**Layer Structure (per instance)**

```
core   Mesh  SphereGeometry(0.008)  MeshBasic  white  AdditiveBlending
└── halo  Mesh  SphereGeometry(0.024)  MeshBasic  #88ccff  opacity:0.28  Additive
```

**Instances**

| 인스턴스 | 소스 | 역할 |
|---|---|---|
| ptrDot1 | hand1 | 실제 |
| ptrDot2 | hand2 | 실제 |
| mirrorPtrDot1 | hand1 | 거울 |
| mirrorPtrDot2 | hand2 | 거울 |

**Variants**

```
pointing      → VISIBLE, lazy lerp 추종
not pointing  → HIDDEN, lazyPos 스냅 (다음 활성화 시 튀기 방지)
```

**포인팅 판정 (detectPointing)**
```
index-tip ↔ wrist 거리 > INDEX_EXTEND_MIN (0.14m)  AND
middle/ring/pinky-tip ↔ wrist 거리 < CURL_MAX (0.13m)
```

**Logic**
- dot.lazyPos.lerp(indexTip, LAZY_LERP=0.07) → 부드러운 추종
- mirror: position = (x, y, 2×mirrorZ - z)
- returns isPointing → C09 HandTrail에 전달

---

### C09 — HandTrail

> **역할**: 포인터 빛점이 지나간 자리에 남는 잔상. 시간에 따라 사라짐.

**Layer Structure (per instance)**

```
rMesh  Points  BufferGeometry  makeTrailMaterial()  [실제 궤적]
mMesh  Points  BufferGeometry  makeTrailMaterial()  [거울 궤적]
```

**Shader (built-in visual)**
```
vertex:  gl_PointSize = max(1.5, 9.0 × (1 - age/10))   오래될수록 작아짐
frag:    a = (1 - age/10)²                              이차 감쇠
         col = mix(skyblue(0.55,0.75,1.0), white, 1-age/10)
         blending: AdditiveBlending
```

**Instances**: trail1 (hand1), trail2 (hand2) — 각각 real/mirror 쌍 내장

**Props**
```
timestamp   현재 시각
isPointing  boolean  (C08에서 전달)
lazyPos     Vector3  (C08의 dot.lazyPos)
```

**Logic**
- pts 배열: { x, y, z, t } — TRAIL_LIFETIME(10s) 경과 시 제거
- isPointing=true 이고 TRAIL_ADD_INTERVAL(0.033s) 경과 시 새 점 추가
- mirror: mPos[z] = 2×mirrorZ - rPos[z], age 배열 공유

---

### C10 — WristPanel

> **역할**: hand1 손목에 부착된 10cm 패널. hand2 검지로 터치 가능.

**Layer Structure (per instance)**

```
mesh  Mesh  PlaneGeometry(0.10, 0.10)  MeshStandard  [실제]
      └── sound  PositionalAudio  (alert 음원)
```

**Instances**: wristPanel (실제), mirrorWristPanel (거울)

**Position**
```
world position = wrist.getWorldPosition() + (0, WRIST_PANEL_OFFSET, 0) 로컬 Y 방향
quaternion = wrist.quaternion
```

**거울 쌍 변환**
```
position.z = 2×mirrorZ - realPanel.z
quaternion = (q.x, q.y, -q.z, q.w).normalize()   Z축 반사
```

**Variants**

```
Normal   → color: #888888
Pressed  → color: #ff69b4, duration: WRIST_PRESS_DUR (0.3s)
```

**터치 판정**
```
pointerHand index-tip → panel 법선 수직거리 < WRIST_PRESS_DIST (0.025m)
                      AND 패널 로컬 X/Y 내부 ±0.05m
```

**Logic**: rising edge press 시 alertBuffer 재생 + pressTimer 시작

**현재 스켈레톤 표식**: gray/pink plane → 교체 예정

---

### C11 — Fish

> **역할**: 메인 인터랙티브 크리처. 거울 통과 → 현실 공간 자율 유영 → 음성 반응.

**Layer Structure**

```
fishReal        Group  [실제 GLB 모델]
└── (model)     GLTFLoader 로드, FISH_MODEL_LENGTH 기준 정규화, rotation.y=π

fishMirrorMesh  Group  [거울 GLB 모델]
└── (model)     별도 clone, opacity:0.72, depthWrite:false
```

**State Machine (fishPhase)**

```
idle
 ├── spawnFish() 호출 시
 └─→ approach

approach
 ├── fishZ += FISH_APPROACH_SPEED × dt
 ├── bob/sway 애니메이션 (sin 기반)
 ├── fishReal VISIBLE, fishMirrorMesh HIDDEN
 └─→ crossing  (fishZ >= mirrorZ)

crossing
 ├── 계속 이동, FISH_CROSS_DUR (0.55s)
 ├── triggerMirrorEffect() 1회 호출
 ├── opacity 맥동 (sin(crossT × π))
 └─→ drift  (timer >= FISH_CROSS_DUR)

drift
 ├── 둘 다 VISIBLE
 ├── 스프링 물리 (K=3.5, D=0.88)
 ├── 음성 상태에 따른 타겟 결정 (아래)
 └── 거울 position/rotation 갱신
```

**Drift Sub-variants (voiceHeld)**

```
SILENCE   → 웨이포인트 자율 유영 (2.5s 여운 후)
WHISPER   → 웨이포인트 + 35% 사용자 방향 블렌드
CALL      → 사용자 앞 FISH_CALL_DIST (0.5m) 스프링
SING      → 사용자 중심 반지름 FISH_ORBIT_R (0.4m) 선회
```

**Drift 거울 변환**
```
position.z = reflectZ(fishZ)
rotation.x =  fishReal.rotation.x
rotation.y =  π - fishReal.rotation.y
rotation.z = -fishReal.rotation.z
opacity    = 1.0  (2026-05-18 갱신: 실제와 동일)
```

**Waypoint 시스템**
```
zMin = mirrorZ + 0.3
zMax = max(zMin+0.3, headZ - 0.4)
xAmp = ±0.45, yAmp = ±0.14 (spawnEyeY 기준)
간격: 3~7초 random (또는 도착 시 0.1m 이내)
```

**의존**: C04 MirrorCrossingEffect, C12 VoiceAnalyzer

---

### C12 — VoiceAnalyzer

> **역할**: 마이크 입력 분석 → 4단계 음성 상태 산출. C11 Fish의 행동 입력.

**Layer Structure**: 없음 (시각 레이어 없음)

**State Machine (voiceHeld)**

```
SILENCE → WHISPER → CALL → SING
  (상향: 즉시 전환)
  (하향: VOICE_HOLD(2.0s) 대기 후 전환, 단 히스테리시스 구간 예외)
```

**히스테리시스 임계값**

| 상태 | 진입 threshold | 탈출 threshold |
|---|---|---|
| WHISPER | ≥ 0.15 × VOICE_THRESH | ≥ 0.15 × 0.25 |
| CALL | ≥ 0.63 × VOICE_THRESH | ≥ 0.63 × 0.25 |
| SING | ≥ 0.88 × VOICE_THRESH | ≥ 0.88 × 0.25 |

**처리 파이프라인**
```
getUserMedia (AR 시작 시)
  → AudioContext + AnalyserNode (fftSize=2048)
  → getFloatTimeDomainData()
  → RMS = sqrt(mean(x²))
  → 비대칭 스무딩: rise=ATK(0.18), fall=REL(0.04)
  → calcVoiceRaw() → 히스테리시스 → voiceHeld
```

**Output**: `voiceHeld` ('silence'|'whisper'|'call'|'sing') — C11에서 소비

---

### C13 — SpatialAudio

> **역할**: 위치 기반 3D 오디오. 핀치 + 손목 패널 이벤트에 반응.

**Layer Structure**

```
audioListener  AudioListener  (camera에 부착, singleton)

pinchAudio1    PositionalAudio  (pinchObj1에 부착)  bell
pinchAudio2    PositionalAudio  (pinchObj2에 부착)  bell
wristPanel.sound    PositionalAudio  (wristPanel에 부착)  alert
mirrorWristPanel.sound  PositionalAudio  (mirrorPanel에 부착)  alert
```

**Sound Buffers**

| 버퍼 | 파일 | 사용처 |
|---|---|---|
| bellBuffer | mixkit-achievement-bell-600.wav | 핀치 |
| alertBuffer | mixkit-alert-bells-echo-765.wav | 손목 패널 터치 |

**동작**: stop() → setBuffer() → play() (중복 재생 방지)

**감쇠 설정 (공통)**
```
refDistance    = 0.3m
rolloffFactor  = 2
maxDistance    = 4~6m
```

---

## 레이어 매트릭스

현재 코드에서 비쥬얼 / 로직 / 상태가 어떻게 섞여 있는지 일람.

| 컴포넌트 | 비쥬얼 (스켈레톤) | 로직 | 상태 | 비고 |
|---|---|---|---|---|
| ~~C01 ReferenceObject~~ | — | — | — | 삭제됨 |
| C02 MirrorGuide | Mesh + Material | 위치 1회 고정 | visible | 테스트 중 유지 |
| C03 MirrorCrossingSphere | 2× Mesh + Material + clipping | 이동/정지/소멸 | phase(4단계) | 클리핑 로직 내장 |
| C04 MirrorCrossingEffect | 3×Mesh + PointLight | 타이머 기반 애니메이션 | timer | VFX 전용 |
| ~~C05 HandSkeleton~~ | — | — | — | 삭제됨 |
| C06 PinchGesture | 없음 | 거리 감지 + rising edge | wasPinching | 위임자 |
| C07 SparkleParticle | GPU Points + shader | 물리 + 수명 관리 | flying/resting | shader 내 색상 |
| C08 PointerDot | core + halo Mesh | lerp 추종 + 감지 | pointing y/n | 감지·시각 혼재 |
| C09 HandTrail | GPU Points + shader | 점 누적 + 수명 | - | shader 내 감쇠 |
| C10 WristPanel | Plane Mesh | 위치·터치 감지 | normal/pressed | 위치·감지 혼재 |
| C11 Fish | GLB ×2 (skeleton clone + animations) | 상태머신+물리+회전 | idle/approach/crossing/drift | 가장 복잡 |
| C12 VoiceAnalyzer | 없음 | RMS + 히스테리시스 | 4단계 | 순수 로직 |
| C13 SpatialAudio | 없음 | 재생 제어 | playing y/n | 순수 로직 |

---

## 비쥬얼 문법 적용 시 교체 범위 예측

**교체 대상** (스켈레톤 → 최종 비쥬얼):
- C01: red/pink cube → TBD
- C02: cyan U-frame → TBD 또는 제거
- C03: gray/blue sphere → TBD
- C04: blue torus ripple → TBD (VFX 언어 정의 후)
- C05: sphere joints + line segments → TBD (손 비쥬얼 언어)
- C07: gold particle shader → TBD (색상 토큰 교체)
- C08: white core + blue halo → TBD
- C09: skyblue trail → TBD
- C10: gray/pink plane → TBD

**유지 대상** (로직, 교체 불필요):
- 모든 상태머신 (phase, voiceHeld 등)
- 스프링 물리 (FISH_SPRING_K/D)
- 거울 반전 공식 (reflectZ)
- 음성 히스테리시스
- 파티클 물리 (gravity, floor)
- 손 감지 로직 (pinch, pointer, wrist touch)

**주의**: C08 PointerDot은 detectPointing() 로직과 시각 레이어가 같은 함수(updatePointerDot) 안에 있음 → 분리 고려 필요
