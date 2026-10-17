// Scoreboard.js: top-ten streak board plus one top-ten accuracy board per image.
// Data shape matches data/scoreboards.json:
//   { streaks: [{ name, streak }], images: { [imageKey]: [{ name, accuracy }] } }
// A static page can't write files, so the board lives in localStorage; the
// JSON file is the seed that is loaded the first time (when served over http).
// When the backend is set up (js/backend.js), the boards are shared across
// players via the Worker; localStorage stays as the offline fallback.
const Scoreboard = (() => {
  const KEY = "ghoulgle-scoreboards";
  const SEED_URL = "data/scoreboards.json";
  const MAX = 10;
  let data = { streaks: [], images: {} };

  const clean = (list, field) =>
    (Array.isArray(list) ? list : [])
      .filter((e) => e && typeof e.name === "string" && Number.isFinite(e[field]))
      .sort((a, b) => b[field] - a[field])
      .slice(0, MAX);

  function normalize(raw) {
    const out = { streaks: clean(raw && raw.streaks, "streak"), images: {} };
    const images = (raw && raw.images) || {};
    Object.keys(images).forEach((k) => (out.images[k] = clean(images[k], "accuracy")));
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {}
  }

  const ready = (async () => {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY));
    } catch (err) {}
    if (stored) {
      data = normalize(stored);
      return;
    }
    try {
      const res = await fetch(SEED_URL);
      if (res.ok) data = normalize(await res.json());
    } catch (err) {}
  })().then(() => pull());

  // ---- shared boards (Cloudflare Worker) ----
  const shared = () => typeof Backend !== "undefined" && Backend.enabled;

  function applyRemote(res, key) {
    if (!res) return;
    if (Array.isArray(res.streaks)) data.streaks = clean(res.streaks, "streak");
    if (key && Array.isArray(res.image)) data.images[key] = clean(res.image, "accuracy");
    save();
  }

  // refresh from the server; resolves either way so callers can just re-render
  async function pull(key) {
    if (!shared()) return;
    try {
      applyRemote(await Backend.getScores(key), key);
    } catch (err) {
      console.warn("[Scoreboard] couldn't load shared boards:", err.message);
    }
  }

  // send this round's result; the server keeps each name's best
  async function push(name, streak, key, accuracy) {
    if (!shared() || !name) return;
    try {
      applyRemote(await Backend.submitScore({ name, streak, image: key, accuracy }), key);
    } catch (err) {
      console.warn("[Scoreboard] couldn't save to shared boards:", err.message);
    }
  }

  // data: URIs have no stable URL, so fall back to the prompt
  function imageKey(item) {
    if (!item) return "";
    return item.src && !item.src.startsWith("data:") ? item.src : item.prompt || "unknown";
  }

  // one row per player name, keeping their best
  function insert(list, entry, field) {
    const i = list.findIndex((e) => e.name === entry.name);
    if (i >= 0) {
      if (list[i][field] >= entry[field]) return list;
      list.splice(i, 1);
    }
    list.push(entry);
    return clean(list, field);
  }

  function addStreak(name, streak) {
    if (!name || streak < 1) return;
    data.streaks = insert(data.streaks, { name, streak }, "streak");
    save();
  }

  function addAccuracy(key, name, accuracy) {
    if (!name || !key) return;
    data.images[key] = insert(data.images[key] || [], { name, accuracy }, "accuracy");
    save();
  }

  const topStreaks = () => data.streaks.slice();
  const topAccuracies = (key) => (data.images[key] || []).slice();

  function render(el, title, rows, field, suffix = "") {
    const h = document.createElement("h3");
    h.textContent = title;
    el.replaceChildren(h);
    if (!rows.length) {
      const p = document.createElement("p");
      p.textContent = "No scores yet.";
      el.append(p);
      return;
    }
    const ol = document.createElement("ol");
    rows.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = `${r.name} — ${r[field]}${suffix}`;
      ol.append(li);
    });
    el.append(ol);
  }

  return { ready, imageKey, addStreak, addAccuracy, topStreaks, topAccuracies, render, pull, push };
})();
