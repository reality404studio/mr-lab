# Slimei MVP Specification (Hackathon 1-Hour Version)
> XR Tamagotchi that learns through natural language.
---
# Goal
책상 위에 사는 작은 슬라임.
사용자는 자연어로 슬라임를 가르치고,
슬라임은 기억하고 행동한다.
핵심은 "대화"가 아니라 "훈련"이다.
---
# Tech Stack
* Quest 3
* Three.js
* WebXR
* Web Speech API
* Gemma 4 (Cerebras API)
---
# Visual Style
## Theme
Retro Tamagotchi + Minimal XR
모든 UI는 ASCII 감성.
---
## Slime
Geometry
* SphereGeometry 하나
Material
* MeshPhysicalMaterial
* 반투명
* 연보라
Body Animation
* squash & stretch
* bounce
* idle breathing
No Rigging.
No GLTF.
No Blender.
Everything procedural.
---
# Face
Face는 텍스트만 사용.
Examples
Normal
o o
Happy
^ ^
Excited
* *
Sleepy
* *
Confused
@ @
Love
♥ ♥
Dead
x x
Face는 CanvasTexture 또는 Sprite로 렌더링.
---
# Parameters
## Affection
Range
0~100
Higher affection
* 가까이 있음
* 칭찬하면 기뻐함
---
## Hunger
Range
0~100
Higher hunger
* 먹이를 찾음
* 배고픈 표정
---
# UI
ASCII Only
Example
♥♥♥♡♡
■■■□□
Mood : Happy
Learned : 2
No fancy graphics.
No icons.
---
# Memory
Only four memories.
name
favoriteFood
foodLocation
homeLocation
---
# Animation
Idle
* 살짝 출렁
Bounce
* 위아래 점프
Hop
* 이동
Eat
* 먹으면서 작아졌다 커짐
Happy
* 세 번 통통
Sleep
* 납작
---
# Public API
slime.idle()
slime.lookAt(target)
slime.hopTo(target)
slime.eat()
slime.sleep()
slime.happy()
slime.setFace(face)
slime.setMood(mood)
slime.updateStats()
---
# Natural Language
LLM only returns intent.
Example
{
intent:"feed"
}
↓
slime.eat()
---
Example
{
intent:"praise"
}
↓
slime.happy()
affection += 5
---
Example
{
intent:"sleep"
}
↓
slime.sleep()
---
# Demo Flow (60 sec)
1.
Spawn slime
Idle
Face
o o
---
2.
User
"Your name is Bean."
↓
Save memory
↓
Happy
^ ^
---
3.
User places food.
"This is your food."
↓
Remember food position.
---
4.
User
"You look hungry."
↓
Hop
↓
Eat
↓
Affection +5
---
5.
User
"Good job!"
↓
Happy bounce
↓
♥♥♥♥♡
---
# Out of Scope
No voice output.
No lips.
No skeletal animation.
No multiplayer.
No inventory.
No complex AI.
No pathfinding.
No physics simulation.
---
# Definition of Done
✅ Slime appears on desk
✅ Idle animation
✅ Bounce movement
✅ Face changes
✅ Hunger bar
✅ Affection bar
✅ Natural language → Intent
✅ Intent → Animation
Done.
src/
 ├── Slime/
 │     Slime.ts
 │     SlimeFace.ts
 │     SlimeAnimation.ts
 │     SlimeState.ts
 │
 ├── AI/
 │     prompt.ts
 │     parseIntent.ts
 │
 ├── UI/
 │     StatusPanel.ts
 │
 └── main.ts, 
 
