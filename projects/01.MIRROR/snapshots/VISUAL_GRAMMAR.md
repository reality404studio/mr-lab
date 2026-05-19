# MIRROR MR — 비쥬얼 문법 v1
**상태**: 컴포넌트 적용 전 합의용 문서
**참조**: `COMPONENT_SPEC.md`의 13개 컴포넌트가 이 문법에 따라 비쥬얼 교체됨

---

## 0. 비전

> **헤드셋 쓴 내 모습이 왠지 디즈니 공주 같아.**

- 출력 형태: Instagram Reel 15초, **거울 셀카의 확장판**
- 사용자: 헤드셋 안에서 1인칭으로 체험
- 관람자: 3인칭(거울+사용자 외부 카메라)으로 영상 감상
- 두 시점이 모두 "프린세스가 노래하는 그 장면"으로 읽혀야 함

---

## 1. 무드 앵커 (Reference Coordinates)

### Primary
- **Moana — "How Far I'll Go" / "Where You Are"** 바닷가 장면의 청록 라군 + 햇빛 산란
- **Ariel — "Part of Your World"** 노래 장면의 부드러운 빛기둥 + 떠오르는 거품
- **Frutiger Aero (2004–2013)** Windows Vista 배경, iPod Touch 광고, 유리 구슬/물방울/맑은 청록
- 디즈니 동물 친구들 (플라운더, 푸아, 쥐들) — 호기심, 친근, 표정 있는 단순함

### 빌리기
- Moana → **컬러 라군 톤 + 햇빛 카우스틱**
- Ariel → **수직 빛기둥 + 거품 상승**
- Frutiger Aero → **유리·물방울 재질 + 글로시 + 부드러운 블러**
- 디즈니 캐릭터 → **물고기의 표정/태도**

### 피하기
- 다크 모드 / 어두운 라이팅 / 사이버펑크
- 채도 낮은 무채색 / 모노톤
- 거친 표면 / 매트 / 콘크리트
- 끊김 있는 staccato 모션

---

## 2. 컬러 토큰

### 베이스 팔레트 (사용 빈도 높음)

| 토큰 | HEX | 역할 |
|---|---|---|
| `DEEP_OCEAN` | `#0077B6` | 깊이감, 그림자 톤 |
| `LAGOON` | `#00B4D8` | 메인 컬러, 메인 오브젝트 |
| `SHALLOW` | `#90E0EF` | 라이트 톤, 하이라이트 |
| `FOAM` | `#CAF0F8` | 거의 흰색, 거품/하이라이트 |
| `PEARL` | `#FFFCEC` | 따뜻한 흰, 코어 글로우 |

### 악센트 팔레트 (사용 빈도 낮음 — 통통 튀는 강조)

| 토큰 | HEX | 역할 |
|---|---|---|
| `SPIRIT_GREEN` | `#00E658` | 정령 같은 채도 높은 초록, 핵심 순간만 (톤 보고 조정 가능) |
| `GOLD_SHIMMER` | `#FFE066` | 파티클 반짝, 햇빛 산란 (기존 자산 유지) |
| `CORAL_BLUSH` | `#FFB5A7` | Ariel 톤 따뜻한 강조 (옵션) |

### 사용 비율 가이드 (60-30-10 룰)
- 60% : `LAGOON` + `SHALLOW`
- 30% : `DEEP_OCEAN` + `FOAM` + `PEARL`
- 10% : `SPIRIT_GREEN` + `GOLD_SHIMMER`

---

## 3. 재료 어휘 (Material Vocabulary)

각 어휘는 비쥬얼 문법의 "재료 카드". 컴포넌트마다 어떤 카드를 쓸지 명시.

### M1. 유리 구슬 (Glass Orb)
- **느낌**: Frutiger Aero 아이콘, 물방울, 매끄러운 표면 장력
- **특성**: 투명도 60-80%, 가장자리 림 라이트 강함, 내부에 약한 색
- **Three.js**: `MeshPhysicalMaterial` (`transmission`, `roughness:0`, `ior:1.4`, `clearcoat:1`)
- **적용 후보**: C03 Sphere, C08 Pointer Halo, C07 Particle (옵션)

### M2. 거품 (Foam Bubble)
- **느낌**: 떠오르는 거품, 손가락으로 만지면 터지는 표면 장력
- **특성**: 매우 옅은 색, opacity 0.3-0.5, 약한 굴절, 짧은 수명
- **Three.js**: `MeshBasicMaterial` transparent + 작은 SphereGeometry, additive
- **적용 후보**: C07 Particle 일부, 손 주변 ambient

### M3. 정령 빛 (Spirit Glow)
- **느낌**: 디즈니 마법 장면의 빛 입자, Moana 영혼 효과
- **특성**: 코어(흰/펄) + 헤일로(LAGOON/SHALLOW) + 미세 색상 변이, additive blending
- **Three.js**: `MeshBasicMaterial` + bloom 효과
- **적용 후보**: C08 Pointer, C09 Trail, C11 Fish 주변 후광

### M4. 물고기 정령 (Fish Spirit)
- **느낌**: 반투명 젤리 같은 + 내부에 발광 + 비늘 흔적
- **특성**: 베이스 LAGOON, 내부 emissive 약하게, fresnel 가장자리 SHALLOW 빛
- **Three.js**: `MeshPhysicalMaterial` transmission 0.5, emissive `LAGOON` × 0.3, iridescence 0.4
- **적용**: C11 Fish

### M5. 카우스틱 빛 (Caustic Light)
- **느낌**: 수면을 통과한 햇빛이 바닥/벽에 만드는 일렁임
- **특성**: 흰-pearl 톤, 천천히 흐르는 패턴, additive
- **Three.js**: shader 또는 procedural texture
- **적용 후보**: 환경 배경 (옵션, Phase 2 이후)

### M6. 손 비쥬얼 (Hand Presence)
- **느낌**: 손이 빛으로 둘러싸여 있는, "내 손인데 마법 같은"
- **특성**: 관절 = 작은 진주(PEARL), 본 = 빛 흐름(SHALLOW), 가장자리 발광
- **Three.js**: 작은 emissive sphere + glow line + 옵션 bloom
- **적용**: C05 HandSkeleton

---

## 4. 빛 원칙

### Lighting Recipe
- **Ambient**: 현재 `2.5` → 유지하거나 약간 낮춤 (`2.0`), 색을 `FOAM`으로 살짝 시프트
- **Directional**: 위에서 살짝 앞으로 — 디즈니 프린세스 무대 라이팅
- **추가 권장**: 후면 림 라이트 (`LAGOON` 약하게) — 캐릭터/물고기 실루엣 강조
- **Bloom**: post-processing bloom (threshold 0.85, strength 0.6) — 모든 emissive를 부풀려서 "마법" 느낌

### Glow 위계
모든 자체 발광 오브젝트는 위계가 있어야 함:
1. **Hero glow** (가장 밝음): Fish 주변, 활성 Pointer Dot — `LAGOON`/`SHALLOW`
2. **Sparkle glow** (반짝임): Particle 비행 중, Trail 최근점 — `GOLD_SHIMMER`/`PEARL`
3. **Ambient glow** (낮음): Hand joints, 거품 — `SHALLOW` 약하게

### Fresnel / Rim Light (중요)
모든 주요 오브젝트(Fish, Sphere, Hand)의 가장자리는 `SHALLOW` 톤의 림라이트로 빛남.
→ "물에 젖은 표면" 느낌의 핵심.

---

## 5. 모션 원칙

### 5-1. 시간 곡선
- 절대 linear 금지. 모든 전환은 ease-in-out (cubic).
- 즉각 멈춤 금지. 작은 잔여 진동(damped) 항상 남김.

### 5-2. 베이스라인: 호흡(Breathing)
모든 visible 오브젝트는 미세한 호흡을 가짐:
```
y_offset = sin(t × ω) × amplitude
ω 범위: 1.5 ~ 3.0 rad/s   (호흡 주기 2~4초)
amplitude: 객체 크기의 5~10%
```
이미 sphere/fish의 bob에 있는 패턴 — **모든 컴포넌트로 확장**.

### 5-3. 반짝임(Sparkle) — 짧은 비트
호흡(긴 흐름) 위에 sparkle(짧은 burst)이 얹힘:
- 펄스: 100~250ms 짧은 emissive intensity 상승 후 감쇠
- 트리거: 핀치, 거울 통과, 손목 패널 터치
- **느린 base + 빠른 accent** 의 디즈니 리듬

### 5-4. 흐름 연결
- 핀치 → 파티클 방출 → 물고기가 파티클로 향함 (예정)
- 모션이 멈추지 않고 다음 모션으로 흐르도록

### 5-5. 디즈니 동물 행동 — Fish 캐릭터
- 사용자 쳐다보기: 회전 yaw가 가끔 사용자 쪽 향함 (현재 속도 기반 회전에 약한 lookAt 블렌딩)
- 호기심 비트: 무작위로 멈춰서 살짝 기울이기(roll) — 3~5초마다 ±0.15rad 작은 빔
- SING 상태: 선회 속도 미세 변주, 위아래 bobbing 깊이 증가
- **현재 spring physics 유지** + 위 행동들이 target 위에 오버레이

---

## 6. 거울 처리 원칙 (가장 중요)

> "거울은 현실 물리 거울. 가상 오브제를 비추는 모습."

### 원칙
**거울 측 인스턴스는 실제 측과 동일하게 보여야 한다.**
색상/재질/투명도 차이는 "물리 거울"이 아니라 "다른 차원"으로 읽히게 만듦.

### 현재 코드의 처리와 비교 (2026-05-18 정리 후)

| 컴포넌트 | 이전 | 현재 |
|---|---|---|
| ~~C01 Cube~~ | 실제 `#ff1a1a` / 거울 `#ff7777` | 삭제됨 |
| C04 VFX | 동일 | 동일 (유지) |
| ~~C05 Hand~~ | 실제 크림 / 거울 파란색 | 삭제됨 |
| C07 Particle | 동일 | 동일 (유지) |
| C08 Pointer | 동일 | 동일 (유지) |
| C09 Trail | 동일 | 동일 (유지) |
| C10 Wrist | 동일 | 동일 (유지) |
| C11 Fish | 실제 opacity 1.0 / 거울 0.72 | **둘 다 1.0** (반영 완료) |

### 단, 물리 거울의 미세한 표현은 허용 (옵션)
실제 유리 거울도 완벽한 반사는 아님:
- 전체 밝기 5-10% 손실 (mirror material opacity 0.92~0.95)
- 매우 약한 그린/시안 틴트 (silver coating)
- 단, 이건 **전역 후처리**로 처리 — 컴포넌트별 색상 차이가 아니라 거울 측 전체에 균일하게

→ **권장**: 일단 v1은 완전 동일하게 가고, v2에서 글로벌 거울 후처리(scene 분리) 검토.

---

## 7. 인터랙션 피드백 원칙

모든 사용자 입력은 **즉각 + 잔향(echo)** 두 박자로 응답:

| 입력 | 즉각 | 잔향 |
|---|---|---|
| Pinch | bell + 파티클 방출 + 짧은 sparkle pulse | 파티클이 떠다니는 잔상 |
| Point | dot 즉시 켜짐 + halo 펄스 | trail로 경로 잔상 |
| Wrist touch | alert + 색상 변화 (현재 분홍 → 권장 `SPIRIT_GREEN`) | 패널 가장자리 0.5초 글로우 |
| Voice (CALL/SING) | 물고기 즉시 방향 전환 | linger 2.5초 → 자율 모드 복귀 |
| 거울 통과 | 리플 + 플래시 | 0.5초 후광 잔향 |

**핵심**: 잔향이 없는 인터랙션은 "디지털"하게 읽힘. 잔향이 있으면 "마법"으로 읽힘.

---

## 8. Instagram Reel 출력 고려사항

3인칭 외부 카메라에서 거울에 비친 모습이 핵심 콘텐츠.
→ 거울 측 시각의 가독성/매력이 비쥬얼 문법의 1차 검증 기준.

### 영상 가독성을 위한 결정
- **High contrast emissive**: 작은 화면에서도 빛이 명확히 읽힘
- **Saturated accent**: 일반 사진과 구별되는 채도 (`SPIRIT_GREEN`이 그 역할)
- **Bloom 권장**: 빛 번짐이 카메라로 캡처될 때 더 강조됨
- **Hero moment 설계**: 15초 안에 (a) 손에서 파티클 (b) 물고기와 인터랙션 (c) 거울 셀카 포즈 가 모두 들어가야 공유 욕구 발생

### 안 좋은 신호
- 거울 측이 흐릿/투명해서 안 보이는 것 — 현재 fish mirror opacity 0.72가 그 위험. 1.0로 권장.
- 색이 너무 일렁여서 어떤 색인지 안 읽히는 것 — 채도 일관성 필요

---

## 9. 컴포넌트별 적용 우선순위

> **변경 사항 (2026-05-18)**: C01 큐브, C05 손 관절 시각화 삭제 완료.
> 사용자 손은 Quest 3 패스스루(실사)로만 보이며, 인터랙션 레이어(파티클·포인터·트레일·손목패널)만 마법으로 덧칠된다.

`COMPONENT_SPEC.md`의 남은 컴포넌트에 이 문법을 적용하는 순서:

| 순서 | 컴포넌트 | 적용할 재료 | 비고 |
|---|---|---|---|
| 1 (파일럿) | **C11 Fish** | M4 Fish Spirit | 히어로, 비전 검증의 핵심 |
| 2 | **C04 MirrorCrossingEffect** | M2 Foam + M3 Spirit Glow | C03·C11이 의존, 거울 통과 언어 확정 |
| 3 | **C07 Particle** | M3 Spirit Glow (gold→cyan/white shift) | 핀치 잔향, shader 색상 교체 |
| 4 | **C08 Pointer + C09 Trail** | M3 Spirit Glow | 같이 작업 (검지 단일 흐름) |
| 5 | **C03 Sphere** | M1 Glass Orb | 데모 오브젝트, 색상 토큰 교체 |
| 6 | **C10 Wrist Panel** | M1 Glass Orb (얇은 판) | 색상 토큰 교체 |
| 7 | **C02 Mirror Guide** | 그대로 유지 (테스트 중에만 사용, 영상에는 안 비침) | 비쥬얼 작업 제외 |

C06 Pinch, C12 Voice, C13 Audio는 시각 없음 — 그대로.
C08은 적용 전 detect 로직 분리 리팩토링 검토 (감사 시 표시한 부채).
~~C01 Cube~~, ~~C05 HandSkeleton~~: 삭제 완료.

---

## 10. 다음 단계 — C11 Fish 파일럿

다음 작업: **C11 Fish에 M4 Fish Spirit 재료 적용**.

목표:
- 기존 GLB clown_fish 모델 유지 (geometry/skeleton/animations 그대로)
- 머터리얼만 교체:
  - 베이스 LAGOON × 약한 emissive (LAGOON × 0.3)
  - transmission 0.5 (반투명 젤리감)
  - iridescence 0.4 (비늘 무지개 반사)
  - clearcoat 0.5 (수면 광택)
  - Fresnel 가장자리 SHALLOW 빛 (rim light)
- Real / Mirror 동일 외관 (opacity 1.0 확정 — 코드 반영 완료)
- 호흡 추가: emissive intensity sin 변조 (현재 bob/sway 모션 위에 광량 호흡)
- 거울 통과 시 SHALLOW 후광 잔향 1초 (M3 Spirit Glow halo)

검증 기준:
- 거울 뒤에서 다가올 때 "빛나는 정령"으로 읽힘
- 거울 통과 순간 magical (디즈니 reveal moment)
- 거울에 비친 물고기와 실제 물고기가 같은 비쥬얼 (물리 거울 검증)
- 음성 SING 상태일 때 선회 동작이 노래에 맞춰 춤추는 듯
