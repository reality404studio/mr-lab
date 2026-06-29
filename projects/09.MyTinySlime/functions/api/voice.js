/**
 * Cloudflare Pages Function — /api/voice
 * Browser-recorded audio -> { text } using Cloudflare Workers AI Whisper.
 *
 * Required Cloudflare binding:
 *   AI  Workers AI binding
 *
 * Optional environment variable:
 *   STT_MODEL  default: @cf/openai/whisper
 */

const DEFAULT_STT_MODEL = '@cf/openai/whisper';
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export async function onRequest({ request, env }) {
  const t0 = Date.now();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    return json({ text: '', error: `method ${request.method} not supported`, latencyMs: 0 }, 200);
  }

  if (!env.AI || typeof env.AI.run !== 'function') {
    return json({ text: '', error: 'missing Workers AI binding named AI', latencyMs: 0 }, 200);
  }

  try {
    const audio = new Uint8Array(await request.arrayBuffer());
    if (!audio.byteLength) {
      return json({ text: '', error: 'empty audio', latencyMs: Date.now() - t0 }, 200);
    }
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      return json({ text: '', error: 'audio too large', latencyMs: Date.now() - t0 }, 200);
    }

    const result = await env.AI.run(env.STT_MODEL || DEFAULT_STT_MODEL, {
      audio: Array.from(audio),
    });

    return json({ text: extractText(result), latencyMs: Date.now() - t0 }, 200);
  } catch (err) {
    return json({ text: '', error: String(err), latencyMs: Date.now() - t0 }, 200);
  }
}

function extractText(result) {
  return String(
    result?.text ||
    result?.transcription ||
    result?.result?.text ||
    ''
  ).trim();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
