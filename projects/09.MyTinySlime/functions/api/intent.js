/**
 * Cloudflare Pages Function — /api/intent
 * One short utterance -> {intent, name?, food?} JSON.
 *
 * Required environment variable:
 *   GEMINI_API_KEY
 *
 * Optional environment variables:
 *   GEMINI_MODEL       default: gemini-2.5-flash
 *   GEMINI_API_BASE    default: https://generativelanguage.googleapis.com/v1beta
 */

const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const ALLOWED_INTENTS = new Set([
  'setName',
  'setFood',
  'setFoodLocation',
  'feed',
  'praise',
  'sleep',
  'come',
  'pet',
  'idle',
]);

const SYSTEM = `You are the intent parser for "Slimei", an XR tamagotchi slime trained by natural language.
Read ONE short utterance from the owner and return the slime's intent. The owner may speak English or Korean,
and often speaks non-imperatively, e.g. "you look hungry" means feed.

Return strict minified JSON only, no prose:
{"intent":"<setName|setFood|setFoodLocation|feed|praise|sleep|come|pet|idle>","name":"<name if naming>","food":"<food if given>"}

Rules:
- Naming ("I'll call you Bean", "Your name is Bean", "너 이름은 콩이야") -> intent=setName, name=given name only.
- Teaching a food spot ("This is your food spot", "여기가 네 밥자리야") -> intent=setFoodLocation.
- Teaching favorite food ("You like pudding", "넌 푸딩을 좋아해") -> intent=setFood, food=the food.
- Any hunger/eat cue ("you look hungry", "eat", "feed", "배고파 보인다") -> intent=feed.
- Praise ("good job", "nice", "잘했어") -> intent=praise.
- Sleep cue ("go to sleep", "good night", "잘 자") -> intent=sleep.
- Calling closer ("come here", "이리 와") -> intent=come.
- Petting/affection ("pet", "stroke", "쓰다듬") -> intent=pet.
- Anything unclear -> intent=idle.`;

export async function onRequest({ request, env }) {
  const t0 = Date.now();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    return json({ intent: 'idle', error: `method ${request.method} not supported`, latencyMs: 0 }, 200);
  }

  let text = '';
  try { ({ text } = await request.json()); } catch (_) {}
  text = (text || '').slice(0, 240);

  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (!key) {
    return json({ intent: 'idle', error: 'missing GEMINI_API_KEY', latencyMs: 0 }, 200);
  }

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const base = (env.GEMINI_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 120,
          responseMimeType: 'application/json',
        },
      }),
    });

    const raw = await upstream.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}
    const content = extractText(data) || raw;
    const parsed = normalizeIntent(safeParse(content));
    parsed.latencyMs = Date.now() - t0;
    if (!upstream.ok) {
      parsed.intent = parsed.intent || 'idle';
      parsed.error = `gemini ${upstream.status}`;
      parsed.detail = raw.slice(0, 400);
    }
    return json(parsed, 200);
  } catch (err) {
    return json({ intent: 'idle', error: String(err), latencyMs: Date.now() - t0 }, 200);
  }
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map(p => p?.text || '').join('').trim();
  return String(data?.text || data?.output_text || '').trim();
}

function normalizeIntent(obj) {
  const out = obj && typeof obj === 'object' ? obj : {};
  if (!ALLOWED_INTENTS.has(out.intent)) out.intent = 'idle';
  if (out.name != null) out.name = String(out.name).slice(0, 24);
  if (out.food != null) out.food = String(out.food).slice(0, 40);
  return out;
}

function safeParse(s) {
  if (!s) return {};
  try { return JSON.parse(s); } catch (_) {}
  const m = String(s).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return {};
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
