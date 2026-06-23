# Malrang — 손맛 연구소 핸드오프

> 마지막 업데이트: 2026-06-23. 단일 파일 `index.html` (Three.js + WebXR, Quest 3 패스스루 + 맨손).
> 배포: Cloudflare Pages (`build.sh`). 디버그 오버레이: URL에 `?debug`.

## 컨셉
같은 형태의 블롭을 **재질만 바꿔(Water Balloon / Marshmallow / Memory Foam / Putty)** 시각·역학만으로 다른 촉감을 유도하는 실험. Hero moment = "어? 진짜 다르게 느껴진다." Quest 패스스루 + 맨손 확정(능동 고유수용감각이 착시 최대치).

## 현재 동작 상태 (검증됨)
- 블롭이 눈높이 정면에 뜸. **보이는 것 확인됨.**
- 손끝(검지)으로 **잡고 당기면 늘어남**, 빠르게 털거나 세게 당기면 **떨어져 날아감**.
- 손끝으로 **누르면 패임(dent)**, 저-cohesion 재질은 자국이 남음.
- **핀치(엄지+검지, 블롭에서 떨어진 허공에서)** 로 4종 재질 순환.

## 아키텍처 — 단일 음함수(메타볼) 백엔드
- 자유 전하 N개(`T.blob.charges=30`) → 마칭큐브 등위면(`MarchingCubes`, res 32). **필드→마칭큐브라 본질적으로 매끈**(고정 메시 아님).
- 매 프레임 `updateBlob()`: readFingers → 핀치 전환 → grab 획득/해제 → cohesion+repel+**finger-push** 힘 적분 → 필드 큐브 재배치 → 마칭큐브 갱신.
- **모델 결정 이력**: 한때 변위 메시(고정 토폴로지 아이코스피어) 백엔드를 시도했으나 점토엔 부적합(누르면 각짐, 안 늘어남) → **폐기**. 조사 결론(물레=회전체 lathe / Adobe Medium=복셀 SDF→마칭큐브 / 연구=MPM·PBD): 자유형 점토는 볼륨/입자 음함수 가족이고 메타볼이 이미 그 가족. 전 재질을 메타볼로 통일, 파라미터만 다름. **예비안 B = 복셀 SDF(Medium 방식)**, 디테일 막히면 승격.

## 핵심 파라미터 (`T.sim` / `MATERIALS`)
- `cohesion` = **형상 기억** (높음=탄성 복원 / ≈0=소성, 자국 남음)
- `damping` = 생기(출렁/스냅백)
- `push` / `pushR` = **손끝 누름(dent)** 강성·사거리
- `repelR`/`repel`/`bondDist` = 부피 유지·덩어리 결합
- `T.grab`: `capture`/`kGrab`(잡기), `releaseSpeed`(털어 놓기)/`breakDist`(당겨 끊기)/`regrabDelay`
- 재질별 식별 `color`는 **임시 테스터용 틴트** — C에서 재질별 외형으로 대체 예정

## 진행 단계
- **B (거의 완료)**: 누르면 매끈하게 패이고 + 점토처럼 늘어나는지 한 백엔드에서 동시에 — 기기 검증 중.
- **C (다음)**: 6종 역학 시그니처 표 정의 + **효과음** 매핑 + 파라미터 튜닝. (원래 6종 후보: Jelly/Mochi/Marshmallow/Water Balloon/Memory Foam/Putty — 던져본 것, 역학으로 재정의 필요)

## 열린 튜닝 항목 (기기 피드백 대기)
- 입자 30개가 넓게 퍼지면 → `isolation`·`ballSubtract`·`repelR`로 뭉침/표면 강도 조절
- 누름이 약하거나 덩어리째 밀리면 → `push`/`pushR` 또는 입자 수
- 72fps 유지 확인 (sim O(N²) ≈ 900쌍)
- 재질 4종 대비가 충분히 벌어지는지

## 함정 메모
- `effect.visible`을 켜는 곳이 빠지면 블롭이 만들어져도 안 보임(생성 시 false). 현재는 `applyMaterial`에서 켬.
- 손 근처 파티클은 패스스루 오클루전 없음 → 떨어지는 연출 금지(위로/퍼지게).
- 셰이더 `uFingers`는 월드 좌표.

## 작업 방식
- 변경마다 **실험 기록용으로 커밋·푸시** (사용자 워크플로우). 한 번에 한 변수씩.
- 저장소 루트는 `05.MR_LABS/PROJECTS` (모노레포). 이 프로젝트만 스테이징: `git add projects/05.Malrang/index.html`.
- 문법 체크: 모듈 스크립트 추출 후 `node --check`.
- 관련 메모리: `memory/project_malrang_handfeel_lab.md`
