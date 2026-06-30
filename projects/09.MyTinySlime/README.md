# Slimei — XR Tamagotchi

A tiny slime that lives on your desk. Teach it with natural language, and it remembers and reacts.
**Gemini** instant NLU · Quest 3 WebXR passthrough/hand tracking/3D HUD · Three.js.

Single-file hackathon demo build. No build step required: deploy this folder directly to Cloudflare Pages.

```
index.html              # Full app: Three.js CDN, shader, animation, UI, voice, demo script
functions/api/intent.js # Cloudflare Pages Function: natural language -> intent proxy
functions/api/voice.js  # Cloudflare Pages Function: browser audio -> text STT fallback
```

---

## 1. Local Preview

```bash
python3 -m http.server 8099
# Browser: http://localhost:8099/index.html
# Or launch immediately with preview mode:
# http://localhost:8099/index.html?preview
```

Desktop controls:
- **Space / Next line**: advance the demo script
- **1-5**: jump to a demo beat · **0**: sleep · **v / mic**: voice input when supported
- **Drag**: orbit camera · **wheel**: zoom

Local preview does not include `/api/intent`, so the app uses local keyword fallback to keep the demo alive.
Deploy to Cloudflare to see real Gemini latency.

---

## 2. Cloudflare Pages Deploy

Connect this folder as a Pages project or use Direct Upload. Build command: none. Output directory: root.
The `functions/` directory is automatically served by Pages, enabling `/api/intent` and `/api/voice`.

### Environment Variables

Set these in Pages > Settings > Environment variables. Store API keys as secrets.

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `GEMINI_API_KEY` | yes | - | Gemini API key. Never put this in client code. |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Gemini model used for intent parsing |
| `GEMINI_API_BASE` | no | `https://generativelanguage.googleapis.com/v1beta` | Gemini REST API base URL |
| `STT_MODEL` | no | `@cf/openai/whisper` | Workers AI speech-to-text model |

### Cloudflare Binding

Quest/XR uses Cloud STT first because browser Web Speech can silently fail in immersive mode.

Pages > Settings > Functions > Workers AI bindings:

| Variable name | Service |
|---|---|
| `AI` | Workers AI |

The client never receives API keys. The server functions read them only from Cloudflare environment variables.

---

## 3. Quest 3 Demo Flow

1. Open the deployed URL in Quest Browser and select **ENTER AR**.
2. Look at the desk until the purple reticle appears.
3. Pull the trigger to spawn Slimei. After spawn, trigger advances the demo script.
4. Status, captions, and latency appear inside XR as a small 3D HUD near the edge of view.
5. Check voice state in the HUD: `Mic : recording -> transcribing -> heard`.
6. Poke Slimei with your finger for `Boing!`; gently pet above its head for `^ ^`.
7. Demo script:
   1. "I'll call you Bean" -> `^ ^`, `Learned: name -> Bean`
   2. Look at the food spot and trigger: "This is your food spot" -> saves `foodLocation`
   3. "Bean, you look hungry" -> hops to the remembered food spot and eats
   4. "Good job, Bean!" -> happy bounce, affection increases
   5. "Come here, Bean" -> moves closer and shows `heart` eyes

The key shot is step 3: Slimei moves to a remembered location without pointing, proving memory + natural language + fast response.

### Voice Debug

- If `Mic : recording -> transcribing -> heard` appears and the spoken line shows as a caption, STT is working.
- If `Mic : STT error` appears, check the Cloudflare `AI` binding and `/api/voice` response.
- If voice is unreliable during filming, use trigger/Space. It still shows captions and runs through the same intent pipeline.

---

## Implementation Notes

- **Solid slime shader**: one mesh with thickness-style alpha; no heavy transmission or GLTF.
- **XR UI**: CanvasTexture-based 3D HUD, not dependent on DOM overlay.
- **Voice pipeline**: browser or Cloud STT -> text -> Gemini intent parser -> animation.
- **Hand tracking**: WebXR hand joints detect poke and pet gestures.
- **Key security**: no keys in `index.html`; server functions read secrets from Cloudflare only.
