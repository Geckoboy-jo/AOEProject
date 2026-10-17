// backend.js: talks to the Ghoulgle API (the Cloudflare Worker in worker/).
//
//   Backend.judge(canvas, item) -> { score, roast } from Betelgeuse (Gemma 4),
//                                  who sees both the drawing and the original
//   Backend.getScores(imageKey) / Backend.submitScore({...}) -> shared boards
//
// Paste the URL `npx wrangler deploy` printed into BACKEND_URL. Leave it ""
// to run fully offline: no judge, and scoreboards stay in localStorage.

const Backend = (() => {
  const BACKEND_URL = "https://ghoulgle-api.ghoulgle.workers.dev";

  const base = BACKEND_URL.replace(/\/+$/, "");
  // file:// pages have a "null" origin, which the Worker's CORS check refuses
  const enabled = !!base && location.protocol !== "file:";
  const JUDGE_SIZE = 512; // px, longest side; keeps Gemma requests small

  async function call(path, { body, timeoutMs = 8000 } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- images ----------
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`couldn't load ${src}`));
      img.src = src;
    });
  }

  // shrink to JUDGE_SIZE on a white background (the canvas may be transparent)
  function toJpeg(source, w, h) {
    const scale = Math.min(1, JUDGE_SIZE / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  }

  // True when (almost) nothing is drawn: under 1% of pixels differ from the
  // most common color. Saves an API call on blank canvases.
  function isBlank(canvas) {
    const N = 48;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, N, N);
    ctx.drawImage(canvas, 0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const [bg] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const br = (bg >> 8) * 16, bgG = ((bg >> 4) & 15) * 16, bb = (bg & 15) * 16;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bb) > 60) ink++;
    }
    return ink < N * N * 0.01;
  }

  const BLANK_ROASTS = [
    "An empty canvas. Even ghosts leave more of a trace than that.",
    "I've haunted emptier houses, but not many.",
    "Bold choice to draw it invisible. Points for commitment, none for anything else.",
    "Nothing? Did the image scare the pencil right out of your hand?",
  ];

  // ---------- API ----------
  async function judge(canvas, item) {
    if (isBlank(canvas)) {
      return { score: 1, roast: BLANK_ROASTS[Math.floor(Math.random() * BLANK_ROASTS.length)], offline: true };
    }
    // grab the drawing now, before the next round clears the canvas
    const drawing = toJpeg(canvas, canvas.width, canvas.height);
    const img = await loadImage(item.src);
    const original = toJpeg(img, img.naturalWidth || 512, img.naturalHeight || 512);
    return call("/judge", {
      body: { drawing, original, prompt: item.painting ? item.painting.title : item.prompt },
      timeoutMs: 25000,
    });
  }

  const getScores = (imageKey) =>
    call(imageKey ? `/scores?image=${encodeURIComponent(imageKey)}` : "/scores");
  const submitScore = (entry) => call("/scores", { body: entry });

  return { enabled, judge, getScores, submitScore };
})();
