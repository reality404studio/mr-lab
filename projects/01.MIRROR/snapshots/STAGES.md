# MIRROR MR — 단계별 개발 스냅샷

> AI에게 이 파일을 보여주면 "어느 단계 코드 위에서 작업하는지" 즉시 이해시킬 수 있습니다.
> 전체 파일 대신 이 문서 + 해당 스냅샷 파일을 함께 제시하세요.

---

## 공통 전제 (모든 단계)

- **렌더러**: Three.js r160, ES Module (`type="module"` + importmap)
- **세션**: `immersive-ar`, `local-floor` + `hand-tracking` optional
- **좌표계**: Z축이 사용자 정면 방향, `mirrorZ = headZ - 1.5m` (거울 평면)
- **거울 반전 공식**: `mirrorZ_coord = 2 * mirrorZ - realZ`
- **손 인덱스**: `hand1 = getHand(0)`, `hand2 = getHand(1)`

---

## Stage 0 — 기반 AR 씬 (hand tracking 이전)

**파일**: `index.html` (git 초기 커밋 기준)

**포함 기능**
- 패스스루 AR 씬 (Quest 3)
- 빨간 큐브: 머리 위 30cm, Z 반전으로 거울 큐브 복제
- 구체 소환 애니메이션 (거울 통과 클리핑 이펙트)
- 거울 위치 가이드 (시안색 바)

**핵심 패턴**
```js
// 거울 반전의 기본 공식 — 이후 모든 단계에서 재사용
function reflectZ(z) { return 2 * mirrorZ - z; }
```

---

## Stage 1 — 손 조인트 시각화

**파일**: *(재구성 가능, stage4에서 hand tracking 섹션 참조)*

**추가된 것**
- `HAND_JOINTS` 배열 (25개 관절명)
- `HAND_CONNECTIONS` 배열 (27개 본 연결)
- `createHandVis(jointColor, lineColor, emissiveColor)` 팩토리
- `updateHandVis(realHand, vis, invertZ)` — invertZ=true이면 거울
- 실제 손: 크림색 (`0xffe8d6`), 거울 손: 파란색 (`0x88ccff`)

**핵심 패턴**
```js
// 매 프레임: 조인트 월드 좌표 읽기 → Z 반전
joint.getWorldPosition(_tmpPos);
const z = invertZ ? 2 * mirrorZ - _tmpPos.z : _tmpPos.z;
sphere.position.set(_tmpPos.x, _tmpPos.y, z);
```

**테스트 통과 조건**
- 패스스루에서 크림색 조인트 보임
- 거울 위치에서 파란색 조인트 보임

---

## Stage 2 — 핀치 감지 + 사운드

**파일**: *(stage4에서 PINCH 섹션 참조)*

**추가된 것**
- `PINCH_THRESHOLD = 0.02` (2cm)
- `createPinchSphere()` — 지름 15cm, 노란↔초록
- `updatePinchSphere(hand, pinchVis, mirrorVis, audio, wasPinching)` — return isPinching
- `THREE.AudioListener` + `THREE.PositionalAudio` (공간 음향)
- 사운드: `mixkit-achievement-bell-600.wav`
- 구체 위치: 손목→핀치 중심 방향으로 20cm 오프셋

**핵심 패턴**
```js
// 핀치 판정
indexJoint.getWorldPosition(_indexPos);
thumbJoint.getWorldPosition(_thumbPos);
const isPinching = _indexPos.distanceTo(_thumbPos) < PINCH_THRESHOLD;

// Rising edge 감지 (한 번만 재생)
if (isPinching && !wasPinching && bellBuffer) { audio.play(); }
```

**테스트 통과 조건**
- 핀치 시 구체 노란→초록 전환
- 머리 돌리면 소리 좌우 이동
- 거울에도 동일하게 반영

---

## Stage 3 — 포인터 감지 + 궤적 Trail

**파일**: *(stage4에서 POINTER/TRAIL 섹션 참조)*

**추가된 것**
- `detectPointing(hand)` — 검지 폄(≥14cm) + 중지/약지/소지 굽힘(≤13cm)
- `createPointerDot()` — 흰 코어 + 하늘색 헤일로, AdditiveBlending
- `updatePointerDot(hand, dot, mirrorDot)` — lazy lerp(0.07), return isPointing
- `HandTrail` class — 30ms 간격으로 점 추가, 10초 후 fadeout
- `makeTrailMaterial()` — ShaderMaterial, age attribute로 크기·투명도 제어

**핵심 패턴**
```js
// Pointer 판정 로직
const indexDist = wristPos.distanceTo(indexTipPos);  // 크면 폄
const midDist   = wristPos.distanceTo(midTipPos);    // 작으면 굽힘
const isPointing = indexDist > 0.14 && midDist < 0.13 && ...

// Lazy 추종 (느리게 따라옴)
dot.lazyPos.lerp(targetPos, LAZY_LERP); // 0.07

// Trail GLSL 핵심
// gl_PointSize = 9.0 * (1.0 - age / 10.0);
// float a = (1.0 - age/10.0)^2;   // 이차 감쇠
```

**테스트 통과 조건**
- 검지만 펴면 흰 빛점 + 느린 추종
- 포인팅하면서 손 움직이면 하늘색 궤적 생김
- 10초 후 궤적 fadeout

---

## Stage 4 — 손목 UI 패널 ✅ 현재

**파일**: `snapshots/stage4_wrist_ui.html`

**추가된 것**
- `createWristPanel()` — 10×10cm PlaneGeometry, DoubleSide
- `updateWristPanel(wristHand, pointerHand, panel, mirrorPanel, timestamp)`
- 패널 위치: `wrist.position + (wrist.localY * 0.05)`
- 충돌 감지: 다른 손 index-tip → 패널 법선 수직거리 < 2.5cm + 범위 내
- 색: 기본 회색 → 터치 시 핑크 (0.3초 유지)
- 사운드: `mixkit-alert-bells-echo-765.wav`
- 거울 패널: Z 반전 + quaternion qz 부호 반전

**핵심 패턴**
```js
// 손목 로컬 축을 월드로 변환해서 오프셋
_wristOffset.set(0, 0.05, 0).applyQuaternion(wrist.quaternion);
panel.mesh.position.copy(wristWorldPos).add(_wristOffset);
panel.mesh.quaternion.copy(wrist.quaternion);

// 패널 평면 충돌
_panelNormal.set(0, 0, 1).applyQuaternion(panel.mesh.quaternion);
const perpDist = Math.abs(tipToPanel.dot(_panelNormal));
const inBounds = localX < half && localY < half;
```

**테스트 통과 조건**
- hand1 손목 위에 회색 패널 보임
- hand2 검지로 찌르면 핑크 전환 + 소리
- 거울에도 패널이 반영됨

---

## AI에게 이 파일 사용하는 법

### 새 기능 추가 요청 시
```
[STAGES.md 첨부] + [stage4_wrist_ui.html 첨부]

"Stage 4 코드 기반으로 [새 기능]을 추가해주세요.
기존 패턴 중 [참고할 패턴명]과 동일한 방식으로 구현하되,
[구체적 조건]을 지켜주세요."
```

### 버그 수정 요청 시
```
"stage4_wrist_ui.html의 updateWristPanel 함수에서
[증상]이 발생합니다. STAGES.md의 Stage 4 핵심 패턴 참고해서 수정해주세요."
```

### 에셋 교체 요청 시
```
"stage4_wrist_ui.html의 createHandVis()에서
SphereGeometry 대신 GLTFLoader로 [파일명.glb]를 로드해서 붙여주세요.
joint 위치 추적 로직(updateHandVis)은 유지."
```
