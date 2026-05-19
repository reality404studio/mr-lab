# Godeok Storage WebXR Horror Demo

Three.js + SparkJS로 만든 30초 WebXR 공포 체험 프로토타입입니다.

## Files

- `index.html`: WebXR 진입 UI
- `src/main.js`: splat 로드, 30초 카메라 경로, 문/그림자/눈 이벤트
- `src/styles.css`: 화면 UI
- `godeokdong.ply`: Quest/브라우저에서 안정적으로 읽기 위한 ASCII 파일명 하드링크
- `고덕동.ply`: 원본 PLY

주의: `.ply` 파일은 128MB라 GitHub 일반 Git 한도를 넘습니다. 현재
`mr-lab` repo에서는 커밋하지 않고 로컬 전용으로 유지합니다. 공개 호스팅이
필요하면 Git LFS 또는 별도 정적 파일 호스팅에 올린 뒤 `src/main.js`의
`CONFIG.splatUrl`을 배포 URL로 바꾸세요.

## Local Preview

```bash
python3 -m http.server 8080
```

브라우저에서 엽니다.

```text
http://127.0.0.1:8080/
```

데스크톱에서는 `Desktop Preview`로 30초 타임라인을 확인할 수 있습니다.

## Quest Recording

Meta Quest Browser에서 WebXR immersive-vr은 HTTPS 보안 컨텍스트가 필요합니다.
PC의 `http://192.168.x.x:8080` 주소는 로드는 되더라도 VR 진입이 막힐 수 있습니다.

녹화용 권장 순서:

1. 이 폴더를 HTTPS 정적 호스팅에 올립니다. Netlify Drop, Cloudflare Pages, GitHub Pages 모두 가능합니다.
2. Quest Browser에서 배포 URL을 엽니다.
3. `ready` 상태까지 기다립니다. PLY가 128MB라 첫 로딩이 길 수 있습니다.
4. Quest 내장 녹화를 시작합니다.
5. `Enter VR`을 누릅니다. WebXR 세션 시작과 함께 30초 타임라인이 자동 재생됩니다.

## Debug / Route Tuning

좌표를 다시 잡을 때는 다음 URL을 사용합니다.

```text
http://127.0.0.1:8080/?debug=1
```

조작:

- `Space`: 일시정지/재생
- `R`: 재시작
- `M`: scout 모드
- `WASD`: scout 이동
- `Q/E`: scout 높이 조정
- `Arrow Left/Right`: 0.5초 단위 스크럽
- `Copy Pose`: 현재 좌표를 JSON으로 복사

주요 연출값은 `src/main.js`의 `CONFIG.route`, `CONFIG.events`, `CONFIG.door`, `CONFIG.eyes`에서 조정합니다.

## Notes

현재는 원본 Gaussian PLY를 바로 읽습니다. Quest 실기에서 로딩이나 프레임이 무겁다면 다음 단계는 PLY를 압축 포맷으로 변환하는 것입니다. PlayCanvas/SuperSplat 또는 SparkJS 변환 파이프라인을 연결하면 이 부분을 줄일 수 있습니다.
