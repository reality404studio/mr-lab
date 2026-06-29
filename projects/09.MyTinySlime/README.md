# Slimei — XR Tamagotchi

책상 위에 사는 작은 슬라임. 말로 가르치면 기억하고 행동한다.
**Gemma 4 + Cerebras**(즉답 NLU) · Quest 3 WebXR 패스스루/손 추적/3D HUD · Three.js.

60초 해커톤 데모 촬영용 단일 빌드. 빌드 스텝 없음 — Cloudflare Pages에 그대로 올리면 끝.

```
index.html              # 앱 전체 (Three.js CDN, 셰이더, 애니메이션, UI, 음성/스크립트)
functions/api/intent.js # Cloudflare Pages Function — 자연어→intent 프록시(키는 서버에만)
functions/api/voice.js  # Cloudflare Pages Function — 브라우저 오디오→텍스트(STT) 폴백
```

---

## 1. 로컬 미리보기 (데스크톱)

```bash
python3 -m http.server 8099
# 브라우저: http://localhost:8099/index.html
#   "데스크톱으로 시작" 클릭, 또는 바로 ?preview 로 자동 시작:
#   http://localhost:8099/index.html?preview
```

조작(데스크톱):
- **Space / ▶ 다음 대사** : 데모 스크립트 한 줄씩 진행 (이름→밥자리→배고픔→칭찬→이리와)
- **1~5** : 특정 비트로 점프 · **0** : 잠 · **v / 🎤** : 음성(STT 지원 브라우저)
- **드래그** : 시점 회전 · **휠** : 줌

> 로컬에서는 `/api/intent`가 없으므로 **로컬 키워드 폴백**으로 동작한다(데모는 안 죽음).
> 진짜 Gemma/Cerebras 지연 숫자를 보려면 아래 Cloudflare 배포가 필요하다.

---

## 2. Cloudflare Pages 배포

이 폴더를 Pages 프로젝트로 연결(또는 Direct Upload). 빌드 명령 없음, 출력 디렉터리 = 루트.
`functions/`는 Pages가 자동으로 서버리스 함수로 인식한다 → `/api/intent` 활성화.

### 환경변수 (Pages > Settings > Environment variables, **Secret**로)

| 변수 | 필수 | 기본값 | 설명 |
|------|:--:|------|------|
| `GEMMA_API_KEY` | ✅ | — | 발급받은 키. **콘솔 UI에서만 입력**(코드/CLI에 넣지 말 것) |
| `GEMMA_API_URL` |    | `https://api.cerebras.ai/v1/chat/completions` | OpenAI 호환 chat/completions 엔드포인트 |
| `GEMMA_MODEL`   |    | `gemma-4-31b` | Cerebras 발급 모델 (필요시 변경) |
| `STT_MODEL`     |    | `@cf/openai/whisper` | Workers AI STT 모델 |

### Cloudflare 바인딩

Quest/immersive 모드에서 브라우저 Web Speech API가 막히면 `/api/voice`가 Workers AI Whisper로 음성을 텍스트화한 뒤, 기존 `/api/intent`의 Gemma/Cerebras 이해 파이프라인으로 넘긴다.

Pages > Settings > Functions > Workers AI bindings:

| 변수명 | 서비스 |
|------|------|
| `AI` | Workers AI |

> ⚠️ 키는 절대 `index.html`이나 git에 넣지 않는다. 서버 함수가 환경변수로만 읽는다.
> 세션 중 키를 파일에 적었다면 노출 가능성이 있으니 **사용 후 키 회전**을 권장.

OpenAI 호환 게이트웨이면 어디든 `GEMMA_API_URL`/`GEMMA_MODEL`만 바꿔 그대로 동작한다.

---

## 3. Quest 3 촬영 플로우

1. Quest 브라우저에서 배포 URL 열기 → **ENTER AR** (패스스루 진입).
2. 책상을 바라보면 **레티클(보라 링)** 이 표면에 뜬다.
3. **트리거** → 그 자리에 슬라임 스폰. (이후 트리거 = 다음 대사 진행)
4. 상태/자막/속도 UI는 XR 안에서 시야 가장자리의 작은 3D HUD로 보인다.
5. 음성 상태는 HUD의 `Mic : ...` 줄에서 확인한다. Quest/XR에서는 Cloud STT를 우선 사용한다.
6. 손가락으로 슬라임을 찌르면 `뚀잉!`, 머리 위를 부드럽게 쓰다듬으면 `^ ^` 반응.
7. 데모 스크립트(트리거로 한 컷씩, 자막+진짜 LLM 호출):
   1. "너 이름은 콩이야" → `^ ^` 통통, `Learned: name ▸ 콩`
   2. **밥자리 지점을 바라본 채** 트리거 → "여기가 네 밥자리야" → 좌표 저장 `foodLocation ✓`
   3. "콩아, 너 좀 배고파 보인다" → **저장한 밥자리로 스스로 hop → eat**, 애정 +5 ⭐
   4. "잘했어 콩!" → happy 통통, 하트 차오름
   5. "이리 와 자식아" → 손 쪽으로 다가와 `♥ ♥`

> ⭐ **3번(가리키지 않았는데 기억으로 찾아감)** 이 영상의 핵심. 시간 모자라면 다른 비트를 깎아도 이 컷은 살린다.

### 촬영 안전판
- STT가 불안하면 **음성 대신 트리거/Space로 스크립트 진행** — 자막이 뜨고 동일 파이프라인(진짜 LLM)으로 반응한다. 속도 배지(⚡ ms)와 NLU는 실제값이라 "연출"이 아니다.
- 음성으로 찍고 싶으면 🎤/`v`로 발화(Web Speech 지원 시).
- 음성 디버그: `Mic : recording → transcribing → heard` 뒤 말한 문장이 자막으로 뜨면 STT 성공. `STT error`가 뜨면 Cloudflare `AI` binding 또는 `/api/voice` 응답을 확인한다.

---

## 함정 회피 메모 (구현 반영됨)
- **슬라임 계란후라이 방지**: 단일 메시 + 알파를 `dot(N,V)` 두께로 구동, `depthWrite:false`, `FrontSide`, 코어구체/노른자 스페큘러 없음. (`slimshaer.md` 기준)
- **셰이더 라이팅**: XR에서도 three가 `cameraPosition` 유니폼을 채워줘 시점-두께 알파가 양안에서 정상.
- **XR UI**: Quest DOM overlay가 안 보이는 경우를 피하려고 상태/자막/토스트를 Three.js CanvasTexture 3D HUD로도 렌더링한다. 위치는 카메라 기준 시야 가장자리라 책상 위 슬라임과 손 상호작용을 가리지 않는다.
- **transmission(굴절) 미사용**: Quest 단독 GPU 부담 + 균일 두께면 다시 계란후라이 → 두께-알파 방식 채택.
- **키 보안**: 클라이언트 노출 0, 서버 함수 환경변수만.
