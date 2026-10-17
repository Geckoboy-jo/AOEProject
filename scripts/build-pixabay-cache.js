#!/usr/bin/env node
// Builds the image set from Pixabay illustrations + vector art (cartoons and
// clipart, not photos), so the prompts are simple enough to draw from memory.
//
// Writes:  assets/pixabay/<id>.<ext>   the images
//          assets/pixabay/cache.js     image list + credits (loaded by index.html)
// Reads:   assets/pixabay/blocklist.json   ids to never add (rejects)
//          js/queries.js                  search terms per category (treat / trick)
//
// Usage:   node scripts/build-pixabay-cache.js           (adds to the existing set)
//          node scripts/build-pixabay-cache.js --fresh   (start over)
// Key:     PIXABAY_API_KEY in js/config.js or in your env (free: pixabay.com/api/docs)
// Cost:    2 requests per search term (illustration + vector); Pixabay allows
//          100 requests/minute, so the script paces itself.
//
// Curate:  delete an entry from cache.js and add its id to blocklist.json,
//          or change its "category" to move it between trick and treat.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets", "pixabay");
const OUT = path.join(DIR, "cache.js");
const PER_TYPE = 12; // results per search term per image type
const TYPES = ["vector", "illustration"];
const PAUSE_MS = 700; // stay well under 100 requests/minute

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadBrowserScript(file, globalName) {
  if (!fs.existsSync(file)) return undefined;
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(file, "utf8") +
      `;this.__out = (typeof ${globalName} !== "undefined") ? ${globalName} : undefined;`,
    sandbox
  );
  return sandbox.__out ?? sandbox.window[globalName];
}

function apiKey() {
  if (process.env.PIXABAY_API_KEY) return process.env.PIXABAY_API_KEY;
  const cfg = loadBrowserScript(path.join(ROOT, "js", "config.js"), "APP_CONFIG");
  return cfg && cfg.PIXABAY_API_KEY;
}

async function main() {
  const key = apiKey();
  if (!key) {
    console.error("No Pixabay key. Add PIXABAY_API_KEY to js/config.js (see js/config.example.js) or set it in your env.");
    process.exit(1);
  }
  fs.mkdirSync(DIR, { recursive: true });

  const groups = require(path.join(ROOT, "js", "queries.js"));
  const fresh = process.argv.includes("--fresh");
  const existing = fresh ? undefined : loadBrowserScript(OUT, "IMAGE_CACHE");
  const byId = new Map((existing?.photos || []).map((p) => [p.id, p]));
  const blockFile = path.join(DIR, "blocklist.json");
  const blocked = new Set(fs.existsSync(blockFile) ? JSON.parse(fs.readFileSync(blockFile, "utf8")) : []);
  const startCount = byId.size;

  const jobs = Object.entries(groups).flatMap(([category, terms]) =>
    terms.flatMap((query) => TYPES.map((type) => ({ category, query, type })))
  );
  console.log(`Searching ${jobs.length} term/type combos (${blocked.size} blocked ids)...`);

  for (const { category, query, type } of jobs) {
    const params = new URLSearchParams({
      key,
      q: query,
      image_type: type,
      safesearch: "true",
      order: "popular",
      per_page: String(PER_TYPE),
    });
    const res = await fetch(`https://pixabay.com/api/?${params}`);
    if (res.status === 429) {
      console.warn("Rate limited; waiting a minute...");
      await sleep(61000);
      continue;
    }
    if (!res.ok) {
      console.warn(`  [${category}] ${query} (${type}): HTTP ${res.status}`);
      if (res.status === 400 || res.status === 401) break; // bad key
      continue;
    }
    const { hits = [] } = await res.json();
    let added = 0;
    for (const h of hits) {
      const id = `px-${h.id}`;
      if (byId.has(id) || blocked.has(id)) continue;
      const ext = (path.extname(new URL(h.webformatURL).pathname) || ".jpg").toLowerCase();
      byId.set(id, {
        id,
        file: `assets/pixabay/${id}${ext}`,
        download: h.webformatURL, // temporary URL; the file is saved locally below
        alt: h.tags || query,
        prompt: query,
        category,
        credit: {
          name: h.user,
          link: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
          site: "Pixabay",
          siteLink: h.pageURL,
        },
      });
      added++;
    }
    console.log(`  [${category}] ${query} (${type}): +${added}`);
    await sleep(PAUSE_MS);
  }

  // download anything we don't have yet (Pixabay wants images stored, not hotlinked)
  const photos = [...byId.values()];
  const todo = photos.filter((p) => !fs.existsSync(path.join(ROOT, p.file)) && p.download);
  console.log(`\nDownloading ${todo.length} images...`);
  let ok = 0;
  const failed = new Set();
  for (const p of todo) {
    try {
      const res = await fetch(p.download);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(path.join(ROOT, p.file), Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (err) {
      failed.add(p.id);
      console.warn(`  ${p.id}: ${err.message}`);
    }
  }

  // keep only entries whose file exists; drop the temporary download URL
  const kept = photos
    .filter((p) => fs.existsSync(path.join(ROOT, p.file)))
    .map(({ download, ...rest }) => rest);
  const cache = { generatedAt: new Date().toISOString(), source: "pixabay", photos: kept };
  fs.writeFileSync(
    OUT,
    "// Generated by scripts/build-pixabay-cache.js. Image list + credits (no API key).\n" +
      "window.IMAGE_CACHE = " + JSON.stringify(cache, null, 1) + ";\n"
  );
  const by = (c) => kept.filter((p) => p.category === c).length;
  console.log(
    `\nassets/pixabay/cache.js: ${kept.length} images (${kept.length - startCount} new; ` +
      `${by("treat")} treat, ${by("trick")} trick)${failed.size ? `, ${failed.size} failed downloads` : ""}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
