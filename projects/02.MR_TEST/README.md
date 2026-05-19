# MR Snake Quest Browser Prototype

외부 패키지나 CDN 없이 Quest Browser에서 열 수 있도록 만든 WebXR 정적 앱입니다. `index.html`, CSS, ES module JavaScript만 사용합니다.

## 실행

```bash
python3 -m http.server 8080
```

로컬 확인:

```text
http://localhost:8080/?mode=preset
```

Quest에서 같은 네트워크의 개발 머신으로 접속할 때는 머신 IP를 사용합니다.

```text
http://<dev-machine-ip>:8080/?mode=preset
```

주의: 실제 WebXR 세션은 HTTPS 또는 브라우저가 허용하는 보안 컨텍스트가 필요합니다. Quest 기기에서 LAN IP의 HTTP가 WebXR 보안 조건을 만족하지 않으면 HTTPS 터널, 로컬 인증서, 또는 배포 HTTPS 호스트가 필요합니다.

## 모드

- `?mode=preset`: 내장 얼굴 텍스처로 즉시 플레이 준비
- `?mode=custom&sse=/events`: SSE로 커스텀 텍스처를 수신한 뒤 플레이 준비
- `?sse=/events`: preset 모드에서도 서버 텍스처 큐를 받을 때 사용
- `?xr=ar`: immersive-ar만 시도
- `?xr=vr`: immersive-vr만 시도
- `?preview=1`: 개발 미리보기를 자동 시작

SSE 메시지는 아래 중 하나를 허용합니다.

```json
{ "id": "student-001", "texture": "data:image/png;base64,..." }
```

```text
data:image/png;base64,...
```

## 조작

- Quest 컨트롤러 Grip: FoodOrb 그랩
- 들고 있는 FoodOrb를 HeadSphere에 가까이 가져가면 먹기
- Game Over 후 Trigger: 다시하기
- Game Over 후 Grip: 다음 학생
- 개발 미리보기: `WASD`/방향키 이동, `Q/E` 회전, `Space` Grip, `Enter` Trigger
- 개발 미리보기에서 구체를 잡으면 입 위치로 자동 스냅되어 먹기/꼬리 추가 흐름을 바로 확인할 수 있습니다.
- 점수 0~3에서는 이모지 공이 허리 높이에서 플레이어 옆을 맴돌고, 점수 4~5부터 뒤따라오는 꼬리 경로로 전환됩니다.

## 구현 범위

- Beat 상태 머신: `BOOT`, `READY`, `PLAYING`, `GAME_OVER`, `WAITING`, `ERROR`
- Visual/Functional/Scene Composition 분리
- HeadSphere, BodySegment, FoodOrb, TailIndicator 성격의 꼬리 깜빡임, ScoreDisplay, GameOverOverlay
- SnakeController, CollisionDetector, OrbSpawner, EatDetector, ScoreManager
- `CONFIG` 기반 수치 관리
- `mode=preset|custom`, SSE 텍스처 큐, 플레이 중 수신 텍스처 큐잉
- WebXR `immersive-ar` 우선, `immersive-vr` 폴백
