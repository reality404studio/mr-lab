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

- 사용자가 FoodOrb 근처로 이동하면 먹이가 자동으로 얼굴 친구에게 전달됩니다.
- 얼굴 친구는 사용자 앞 허리 높이에 둥둥 떠 있고, 사용자를 바라보며 살짝 늦게 따라옵니다.
- 먹이가 가까우면 얼굴 친구가 먹이 쪽으로 살짝 기울고, 먹을 때 통통 튑니다.
- 몸통은 얼굴 친구의 이동 궤적을 따라 스네이크처럼 움직입니다.
- 몸통 5개까지는 꼬리 접촉 패널티가 없고, 6번째 몸통부터 꼬리에 닿으면 몸통 1~2개가 줄며 잠깐 느려집니다.
- 제한 시간은 `CONFIG.game.durationSeconds`에서 조정합니다. 기본값은 120초입니다.
- 시간이 끝나면 “내가 키운 얼굴 친구”의 길이를 보여줍니다.
- Time Up 후 Trigger: 다시하기
- Time Up 후 Grip: 다음 학생
- 개발 미리보기: `WASD`/방향키 이동, `Q/E` 회전, `Enter` Trigger

## 구현 범위

- Beat 상태 머신: `BOOT`, `READY`, `PLAYING`, `GAME_OVER`, `WAITING`, `ERROR`
- Visual/Functional/Scene Composition 분리
- HeadSphere, BodySegment, FoodOrb, TailIndicator 성격의 꼬리 깜빡임, ScoreDisplay, GameOverOverlay
- SnakeController, CollisionDetector, OrbSpawner, EatDetector, ScoreManager
- `CONFIG` 기반 수치 관리
- `mode=preset|custom`, SSE 텍스처 큐, 플레이 중 수신 텍스처 큐잉
- WebXR `immersive-ar` 우선, `immersive-vr` 폴백
