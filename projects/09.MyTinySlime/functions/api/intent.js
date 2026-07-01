/**
 * Cloudflare Pages Function — /api/intent
 * 자연어 한 줄 → {intent, name?, food?} JSON.
 * 키는 클라이언트에 절대 노출하지 않고 여기(서버)에서만 사용한다.
 *
 * 필요한 환경변수 (Cloudflare Pages > Settings > Environment variables, Secret):
 *   GEMMA_API_KEY      (필수)  발급받은 키
 *   GEMMA_API_URL      (선택)  OpenAI 호환 chat/completions 엔드포인트
 *                              기본값: https://api.cerebras.ai/v1/chat/completions
 *   GEMMA_MODEL        (선택)  모델 id. 기본값 gemma-4-31b (Cerebras)
 *
 * Cerebras 외 다른 게이트웨이를 써도 OpenAI 호환이면 URL/MODEL만 바꾸면 된다.
 */

const DEFAULT_URL   = 'https://api.cerebras.ai/v1/chat/completions';
const DEFAULT_MODEL = 'gemma-4-31b';   // Cerebras 발급 모델. 바꾸려면 env GEMMA_MODEL

const SYSTEM = `You are the intent parser for "Slimei", an XR tamagotchi slime trained by natural language (Korean or English).
Read ONE short utterance from the owner and return the slime's intent. The user often speaks NON-imperatively
(e.g. "너 좀 배고파 보인다" = looks hungry = feed; "이리 와 자식아" = come here = come).

Return STRICT minified JSON, no prose, with this shape:
{"intent":"<one of: setName,setFood,setFoodLocation,feed,go,praise,sleep,come,pet,idle>","name":"<name if naming>","food":"<food if given>"}

Rules:
- Naming ("너 이름은 콩이야","I'll call you Bean") -> intent=setName, name=the given name only.
- Pointing/teaching where food is ("여기가 네 밥자리야","this is your food spot") -> intent=setFoodLocation.
- Telling a favorite food ("넌 푸딩을 좋아해") -> intent=setFood, food=the food.
- Any sign of hunger / "eat" / "you look hungry" -> intent=feed.
- A short release cue after blocking ("go","okay","가자","가도 돼","먹어도 돼") -> intent=go.
- Praise ("잘했어","착하다","good job") -> intent=praise.
- Sleep ("이제 자자","잘 자") -> intent=sleep.
- Calling it closer ("이리 와","come here") -> intent=come.
- Petting / affection touch ("쓰다듬","예뻐") -> intent=pet.
- Anything unclear -> intent=idle.
Only output the JSON object.`;

export async function onRequestPost({ request, env }) {
  const t0 = Date.now();
  let text = '';
  try { ({ text } = await request.json()); } catch (_) {}
  text = (text || '').slice(0, 200);

  const key = env.GEMMA_API_KEY || env.CEREBRAS_API_KEY;
  if (!key) {
    return json({ intent: 'idle', error: 'missing GEMMA_API_KEY', latencyMs: 0 }, 200);
  }
  const url   = env.GEMMA_API_URL || env.CEREBRAS_URL || DEFAULT_URL;
  const model = env.GEMMA_MODEL   || env.CEREBRAS_MODEL || DEFAULT_MODEL;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 80,
        // response_format(json_object)은 일부 모델에서 400을 내 매번 폴백 위험 →
        // 프롬프트의 JSON 강제 + 아래 safeParse 로만 처리(가장 안전하게 라이브 보장).
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text }
        ]
      })
    });

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = safeParse(content);
    parsed.latencyMs = Date.now() - t0;
    if (!upstream.ok && !parsed.intent) parsed.intent = 'idle';
    return json(parsed, 200);
  } catch (err) {
    return json({ intent: 'idle', error: String(err), latencyMs: Date.now() - t0 }, 200);
  }
}

// 모델이 코드펜스/잡텍스트를 섞어도 첫 JSON 객체를 건져낸다
function safeParse(s) {
  if (!s) return {};
  try { return JSON.parse(s); } catch (_) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return {};
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
