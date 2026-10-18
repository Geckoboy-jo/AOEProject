// Ghoulgle API: a Cloudflare Worker that the GitHub Pages game calls.
//
//   POST /judge   { drawing, original, prompt? }  -> { score, roast, model }
//                 Betelgeuse (Gemma 4 via the Gemini API) judges a drawing
//                 against the original. Both images are data: URLs (PNG/JPEG/WebP).
//   GET  /scores?image=<key>                      -> { streaks, image }
//   POST /scores  { name, streak?, image?, accuracy? } -> { streaks, image }
//                 Shared top-10 boards, same shape as data/scoreboards.json.
//
// Secrets: GEMINI_API_KEY (wrangler secret put). Config: wrangler.toml [vars].

const MAX_BODY = 3_000_000; // bytes; the frontend shrinks images to ~512px first
const MAX_ROWS = 10;
const NAME_MAX = 20;
const IMAGE_KEY_MAX = 200;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    }
    // Browsers from other sites get no CORS headers, so they can't read responses.
    // Also refuse the request outright so they can't spend our Gemini quota.
    if (!cors) return json({ error: "origin not allowed" }, 403);

    const url = new URL(request.url);
    try {
      if (url.pathname === "/judge" && request.method === "POST") {
        return json(await judge(request, env), 200, cors);
      }
      if (url.pathname === "/scores" && request.method === "GET") {
        return json(await readBoards(env, url.searchParams.get("image")), 200, cors);
      }
      if (url.pathname === "/scores" && request.method === "POST") {
        await rateLimit(env.SCORE_LIMITER, request);
        return json(await submitScore(request, env), 200, cors);
      }
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({ ok: true, model: env.GEMMA_MODEL }, 200, cors);
      }
      return json({ error: "not found" }, 404, cors);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      return json({ error: err.expose ? err.message : "server error" }, status, cors);
    }
  },
};

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function readJson(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BODY) throw new HttpError(413, "request too large");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "request too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

// Optional Workers rate-limit binding (see wrangler.toml); skipped if absent.
async function rateLimit(limiter, request) {
  if (!limiter) return;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await limiter.limit({ key: ip });
  if (!success) throw new HttpError(429, "slow down");
}

// ---------------------------------------------------------------- /judge

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

function parseImage(dataUrl, label) {
  const m = typeof dataUrl === "string" && dataUrl.match(DATA_URL);
  if (!m) throw new HttpError(400, `${label} must be a PNG, JPEG or WebP data: URL`);
  return { inline_data: { mime_type: m[1], data: m[2] } };
}

// A different comedic angle each round so Betelgeuse doesn't fall into one template.
const ANGLES = [
  "a snooty art critic at a gallery opening",
  "a sports commentator calling a blooper replay",
  "a disappointed ghost parent at the school art show",
  "a dramatic horror movie trailer narrator",
  "a Victorian ghost who has haunted too many portrait galleries",
  "a haunted house real estate agent spinning every flaw as a feature",
  "a museum curator writing the label for a cursed artifact",
  "a nature documentary narrator observing a strange new creature",
  "a fortune teller reading omens in the pencil lines",
  "a cooking show judge tasting the drawing",
  "a detective reconstructing what went wrong at the scene",
  "a game show host revealing the answer to the audience",
  "a grumpy ghost writing a one-star review",
  "a wedding toast that goes slightly off the rails",
];

function judgePrompt(subject, angle, recent) {
  return [
    "You are Betelgeuse, the cheeky ghost judge of Ghoulgle, a Halloween drawing game.",
    "The player looked at the FIRST image for a few seconds, then drew the SECOND image from memory.",
    subject ? `The first image was found by searching for: "${subject}".` : "",
    "",
    "Step 1, saw: in under 15 words, say what the drawing actually shows (shapes, colors, what's missing).",
    "Step 2, score: how well the drawing captures the original from memory, 1 to 100.",
    "Reward getting the main subject, shapes, layout and colors right. Be generous to rough",
    "sketches that clearly got the idea; a blank or unrelated drawing scores under 10.",
    `Step 3, roast: one line in Betelgeuse's voice, delivered like ${angle}.`,
    "Build the joke on a specific detail from your 'saw' note, not on the subject in general.",
    "If the drawing is good, give a backhanded compliment instead of an insult.",
    "Playful and spooky, PG, no emoji, at most 25 words.",
    "Do not start with \"Your\", \"Did you\", \"Ah\", or \"Well\".",
    recent.length
      ? "You already said these this session. Use a different structure, opening and punchline:\n" +
        recent.map((r) => `- ${r}`).join("\n")
      : "",
    "",
    'Reply with ONLY JSON, no code fences: {"saw": "<text>", "score": <integer 1-100>, "roast": "<text>"}',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

async function judge(request, env) {
  await rateLimit(env.JUDGE_LIMITER, request);
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

  const body = await readJson(request);
  const original = parseImage(body.original, "original");
  const drawing = parseImage(body.drawing, "drawing");
  const subject = typeof body.prompt === "string" ? body.prompt.slice(0, 100) : "";
  // the player's last few roasts, so Betelgeuse doesn't repeat himself
  const recent = (Array.isArray(body.recent) ? body.recent : [])
    .filter((r) => typeof r === "string")
    .slice(-5)
    .map((r) => r.replace(/\s+/g, " ").slice(0, 200));
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

  const model = env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: judgePrompt(subject, angle, recent) }, original, drawing],
          },
        ],
        generationConfig: { temperature: 1.0, topP: 0.95, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Gemini ${res.status}: ${detail.slice(0, 500)}`);
    if (res.status === 429) throw new HttpError(503, "Betelgeuse is overbooked, try again shortly");
    throw new HttpError(502, "Betelgeuse could not be reached");
  }

  const data = await res.json();
  // skip any "thought" parts if the model thinks before answering
  const text = (data.candidates?.[0]?.content?.parts || [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");
  const verdict = parseVerdict(text);
  if (!verdict) {
    console.error("Unparseable verdict:", text.slice(0, 500));
    throw new HttpError(502, "Betelgeuse mumbled something incoherent");
  }
  return { ...verdict, model };
}

// Pull {"score", "roast"} out of the reply, tolerating code fences or extra prose.
export function parseVerdict(text) {
  const match = text && text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const score = Math.round(Number(obj.score));
  const roast = typeof obj.roast === "string" ? obj.roast.trim().slice(0, 300) : "";
  if (!Number.isFinite(score) || !roast) return null;
  return { score: Math.min(100, Math.max(1, score)), roast };
}

// ---------------------------------------------------------------- /scores

function cleanName(name) {
  if (typeof name !== "string") return "";
  return name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, NAME_MAX);
}

function cleanImageKey(key) {
  if (typeof key !== "string" || !key || key.length > IMAGE_KEY_MAX) return "";
  return key;
}

const sortTop = (list, field) =>
  list
    .filter((e) => e && typeof e.name === "string" && Number.isFinite(e[field]))
    .sort((a, b) => b[field] - a[field])
    .slice(0, MAX_ROWS);

// one row per name, keeping that player's best
function insert(list, entry, field) {
  const i = list.findIndex((e) => e.name === entry.name);
  if (i >= 0) {
    if (list[i][field] >= entry[field]) return list;
    list.splice(i, 1);
  }
  list.push(entry);
  return sortTop(list, field);
}

async function getList(env, key) {
  if (!env.SCORES) throw new Error("SCORES KV binding is missing");
  return (await env.SCORES.get(key, "json")) || [];
}

async function readBoards(env, imageParam) {
  const image = cleanImageKey(imageParam);
  const [streaks, imageRows] = await Promise.all([
    getList(env, "streaks"),
    image ? getList(env, `img:${image}`) : Promise.resolve([]),
  ]);
  return { streaks, image: imageRows };
}

// KV is last-write-wins, so two players finishing in the same instant can
// clobber each other's row. Fine for a hackathon leaderboard.
async function submitScore(request, env) {
  const body = await readJson(request);
  const name = cleanName(body.name);
  if (!name) throw new HttpError(400, "name is required");

  const image = cleanImageKey(body.image);
  const streak = Math.floor(Number(body.streak));
  const accuracy = Math.round(Number(body.accuracy));

  if (Number.isFinite(streak) && streak >= 1 && streak <= 1000) {
    const list = insert(await getList(env, "streaks"), { name, streak }, "streak");
    await env.SCORES.put("streaks", JSON.stringify(list));
  }
  if (image && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100) {
    const key = `img:${image}`;
    const list = insert(await getList(env, key), { name, accuracy }, "accuracy");
    await env.SCORES.put(key, JSON.stringify(list));
  }
  return readBoards(env, image);
}
