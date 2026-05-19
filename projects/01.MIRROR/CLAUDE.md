# MIRROR MR — AI 컨텍스트 문서

## 프로젝트 한 줄 요약
Quest 3 WebXR AR 앱. 패스스루 위에 손 트래킹 인터랙션을 올리고,
정면 1.5m 거울 평면에 Z축 반전으로 모든 요소를 복제하는 MR 거울 씬.

## 현재 파일 구조
```
05.MIRROR/
├── index.html              ← 모든 코드 (단일 파일)
├── CLAUDE.md               ← 이 파일 (AI 컨텍스트)
├── mixkit-achievement-bell-600.wav
├── mixkit-alert-bells-echo-765.wav
└── snapshots/
    ├── STAGES.md           ← 단계별 기능 설명 + AI 사용법
    └── stage4_wrist_ui.html ← Stage 4 완성본 스냅샷
```

## 핵심 아키텍처 규칙

### 거울 반전
모든 오브젝트는 "실제" + "거울" 쌍으로 존재한다.
```js
mirrorZ = headZ - 1.5;                    // 거울 평면 Z 좌표
mirrorPos.z = 2 * mirrorZ - realPos.z;   // Z 반전 공식
```

### 손 데이터 접근
```js
const hand1 = renderer.xr.getHand(0);   // 손 0번
const joint = hand1.joints['wrist'];     // 관절 접근
joint.getWorldPosition(vec);             // 항상 getWorldPosition() 사용
joint.visible                            // 트래킹 여부 확인
```

### 현재 구현된 기능 (index.html 내부 섹션 순서)
1. THREE.JS SCENE — renderer, camera, lighting
2. 큐브 + 가이드 — 기반 AR 오브젝트
3. 구체 애니메이션 — 거울 통과 이펙트
4. HAND TRACKING — hand1, hand2 선언
5. 손 시각화 — createHandVis(), updateHandVis()
6. 핀치 구체 — createPinchSphere(), updatePinchSphere()
7. 공간 음향 — AudioListener, PositionalAudio
8. 포인터 상수 — INDEX_EXTEND_MIN, CURL_MAX, LAZY_LERP
9. 포인터 빛점 — createPointerDot(), updatePointerDot()
10. 궤적 Trail — HandTrail class, makeTrailMaterial()
11. 손목 UI 패널 — createWristPanel(), updateWristPanel()
12. GLOBAL STATE — spawnPos, mirrorZ, scenario 등
13. HELPER 함수 — reflectZ, sphere 상태머신
14. UI 버튼 이벤트
15. AR SESSION + 애니메이션 루프

## 코드 수정 시 주의사항
- 새 기능 추가 시 반드시 거울 쌍도 함께 구현
- `joint.position` 직접 접근 금지 → `joint.getWorldPosition()` 사용
- `spawnPos` null 체크 후 mirrorZ 사용 (세션 시작 직후 미설정)
- 오디오: AudioListener는 하나만 (`camera`에 붙어 있음)
- ES Module: importmap으로 three만 선언됨

## 거울 아키텍처 원칙 (핵심)
- 거울 = 물리 거울 (디스플레이도, 카메라도, 센서도 아님)
- 물리 거울의 역할 ①: 사용자 본인 모습을 보여줌 (코드 불필요, 자동)
- 물리 거울의 역할 ②: 가상 오브젝트를 반사해야 함 → 물리 빛이 아니므로 코드로 보완 필요
- 모든 가상 오브젝트는 실제 3D 공간 (사용자~거울 사이)에 배치
- 모든 가상 오브젝트는 Z 반전 복사본을 가진다
  → 물리 거울이 반사할 수 없는 가상 빛을 Z 반전 복사본이 보완
- "거울에만 존재하는" 오브젝트는 없다 (실물 없는 복사본 단독 금지)
- 거울 Z 좌표: mirrorZ = headZ - 1.5m (세션 시작 시 확정)
- Z 반전 공식: mirrorPos.z = 2 * mirrorZ - realPos.z

## 다음 예정 작업
- Phase 1.5a: Quest 3에서 마이크 입력 (getUserMedia) 작동 확인
- Phase 1.5b: 소리 반응 물고기 행동 프로토타입 (구체로 대체)
- Phase 2: 물고기 GLB 에셋 교체, 조명, 파티클
- 에셋 붙일 때: GLTFLoader import 추가, geometry만 교체, 로직 유지
```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```
