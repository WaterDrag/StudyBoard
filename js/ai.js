'use strict';
// ── Shared AI layer (Gemini primary + Groq free-tier fallback) ─────────────
// Both providers support calling straight from the browser (CORS-verified),
// so this needs no backend. Used by flashcards.js (distractor suggestions)
// and room.js (AI flashcards from notes) — kept in one place so a fix here
// (like the "always says rate limit" bug) can't silently drift out of sync
// between the two call sites.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
// gemini-1.5-flash is retired — kept it out on purpose. Newest/cheapest first,
// with older-generation fallbacks in case a key's account tier lacks the 2.5 line.
const GEMINI_MODELS   = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
const getGeminiKey    = () => localStorage.getItem('sb_gemini_key');

const GROQ_ENDPOINT   = 'https://api.groq.com/openai/v1/';
const GROQ_MODELS     = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
const getGroqKey      = () => localStorage.getItem('sb_groq_key');

// Hardcoded model names inevitably go stale as providers rename/retire them.
// Ask each provider's API what THIS key can actually use right now, and
// prefer that — falling back to a static list only if discovery itself fails.
let _aiModelCache = {}; // `${provider}:${key}` → model name array, cached for the session
async function listModelsFor(provider, key) {
  const cacheKey = `${provider}:${key}`;
  if (_aiModelCache[cacheKey]) return _aiModelCache[cacheKey];
  try {
    if (provider === 'gemini') {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`);
      if (!res.ok) return null;
      const data = await res.json();
      const names = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));
      // Prefer fast/cheap "flash" models (quota-friendly) over "pro"; skip
      // experimental/preview builds, which tend to be the least stable.
      const rank = n => (/preview|exp/i.test(n) ? 2 : /flash/i.test(n) ? 0 : /pro/i.test(n) ? 1 : 1.5);
      names.sort((a, b) => rank(a) - rank(b));
      if (names.length) { _aiModelCache[cacheKey] = names; return names; }
    } else if (provider === 'groq') {
      const res = await fetch(`${GROQ_ENDPOINT}models`, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) return null;
      const data = await res.json();
      const names = (data.data || [])
        .map(m => m.id)
        .filter(id => !/whisper|tts|guard|prompt-guard/i.test(id)); // audio/moderation models — not chat
      const rank = n => (/instant/i.test(n) ? 0 : /versatile/i.test(n) ? 1 : 1.5);
      names.sort((a, b) => rank(a) - rank(b));
      if (names.length) { _aiModelCache[cacheKey] = names; return names; }
    }
  } catch (e) { console.warn(`[AI] listModels(${provider}) failed, using static fallback`, e); }
  return null;
}

// Provider-specific request/response shapes, isolated so the retry/fallback
// loop below can stay provider-agnostic.
async function callAiProvider(provider, model, key, prompt, { temperature, maxOutputTokens }) {
  if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_ENDPOINT}${model}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens } }),
    });
    const text = res.ok ? (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '' : '';
    return { res, text };
  }
  // groq — OpenAI-compatible chat/completions shape
  const res = await fetch(`${GROQ_ENDPOINT}chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxOutputTokens }),
  });
  const text = res.ok ? (await res.json()).choices?.[0]?.message?.content || '' : '';
  return { res, text };
}

// Shared low-level AI caller. Builds a candidate list — Gemini's discovered
// models first (best quality for structured JSON extraction), then Groq's as
// a free-tier fallback if a key is set for it — and tries each in turn. ANY
// failure (429, 404 for a retired/unavailable model, a malformed response the
// optional `parse` callback rejects, ...) advances to the next candidate
// instead of being mislabeled as a rate limit; the real last error is what
// surfaces to the caller. An invalid key only disables THAT provider's
// remaining candidates — Groq still gets tried if Gemini's key is bad, etc.
async function aiGenerate(prompt, { temperature = 0.9, maxOutputTokens = 1600, parse } = {}) {
  const gKey = getGeminiKey(), qKey = getGroqKey();
  if (!gKey && !qKey) throw new Error('no-key');

  const statusEl = () => document.getElementById('aiStatusMsg');
  const countdown = async (seconds, label) => {
    for (let s = seconds; s > 0; s--) {
      const el = statusEl();
      if (el) el.textContent = `${label} ${s} s…`;
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  const candidates = [];
  if (gKey) { const m = (await listModelsFor('gemini', gKey)) || GEMINI_MODELS; m.forEach(model => candidates.push({ provider: 'gemini', model, key: gKey })); }
  if (qKey) { const m = (await listModelsFor('groq', qKey)) || GROQ_MODELS; m.forEach(model => candidates.push({ provider: 'groq', model, key: qKey })); }

  const disabledProviders = new Set();
  let lastErr = new Error('unknown');
  for (const c of candidates) {
    if (disabledProviders.has(c.provider)) continue;
    let attempts = 2;
    while (attempts-- > 0) {
      try {
        if (statusEl()) statusEl().textContent = `Zkouším ${c.provider === 'gemini' ? 'Gemini' : 'Groq'} (${c.model})…`;
        const { res, text } = await callAiProvider(c.provider, c.model, c.key, prompt, { temperature, maxOutputTokens });
        if (res.status === 401 || res.status === 403) { lastErr = new Error('invalid-key'); disabledProviders.add(c.provider); break; }
        if (res.status === 429) {
          lastErr = new Error('rate-limit');
          if (attempts > 0) { await countdown(15, `${c.model}: limit —`); continue; }
          break; // this model is exhausted — try the next candidate, don't give up entirely
        }
        if (res.status === 503 || res.status === 502 || res.status === 504) {
          // Transient server-side overload, not a real unavailability — worth a short retry.
          lastErr = new Error('HTTP ' + res.status);
          if (attempts > 0) { await countdown(6, `${c.model}: server přetížený —`); continue; }
          break;
        }
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status); break; } // e.g. a retired/unknown model → try the next one
        if (!text) { lastErr = new Error('empty-response'); break; }
        if (parse) {
          try { return parse(text); }
          catch (e) { lastErr = new Error('parse-failed'); break; } // model answered but not in the expected shape
        }
        return text;
      } catch (e) {
        console.warn('[AI]', c.provider, c.model, e);
        lastErr = e;
        break; // non-rate-limit failure — move on to the next candidate rather than retrying blindly
      }
    }
  }
  throw lastErr;
}

// Honest, specific messaging per failure — the whole point of this design is
// that these cases are never collapsed into a fake "rate limit".
function aiErrorMessage(e) {
  switch (e.message) {
    case 'no-key':       return '🔑 Nastav Gemini nebo Groq API klíč v <b>⚙️ Nastavení</b> na dashboardu.';
    case 'invalid-key':  return '🔑 Klíč je neplatný nebo bez oprávnění — zkontroluj ho v <b>⚙️ Nastavení</b>.';
    case 'rate-limit':   return '⏱ Limit AI překročen na obou nastavených klíčích — počkej chvíli a zkus znovu.';
    case 'empty-response': case 'parse-failed':
                          return '🤖 Model odpověděl neočekávaně — zkus to prosím znovu.';
    default:
      if (/^HTTP 4/.test(e.message)) return `⚠️ AI API chyba (${e.message}) — model může být nedostupný, zkus to znovu.`;
      return `Chyba: ${e.message}`;
  }
}
