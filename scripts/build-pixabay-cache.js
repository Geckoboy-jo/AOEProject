#!/usr/bin/env node
// Builds the game's image set from folders: the folder an image sits in IS its
// category. To curate, just use Finder and re-run this script:
//
//   assets/pixabay/treat/      spooky images (Treat button)
//   assets/pixabay/trick/      cheeky images (Trick button)
//   assets/pixabay/credits.json  Pixabay credit + search term per image id
//   assets/pixabay/cache.js      GENERATED from the above, loaded by index.html
//
//   bad image?        delete the file
//   wrong category?   drag it into the other folder
//   want your own?    drop a .png/.jpg in a folder; the file name is the prompt
//                     ("rubber-duck.png" -> "rubber duck")
//
// Deleted images stay out: their id remains in credits.json, so --fetch won't
// download them again. To bring one back, `git restore` the file.
//
// Usage:   node scripts/build-pixabay-cache.js           rebuild cache.js from the folders (no key, no network)
//          node scripts/build-pixabay-cache.js --fetch   also download new images for js/queries.js
// Key:     --fetch needs PIXABAY_API_KEY in js/config.js or your env (free: pixabay.com/api/docs)
// Cost:    --fetch makes 2 requests per search term (illustration + vector), paced
//          under Pixabay's 100 requests/minute.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets", "pixabay");
const OUT = path.join(DIR, "cache.js");
const CREDITS = path.join(DIR, "credits.json");
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
const PER_TYPE = 12; // results per search term per image type
const TYPES = ["vector", "illustration"];
const PAUSE_MS = 700;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

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

const readCredits = () => (fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, "utf8")) : {});
function writeCredits(credits) {
  const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
  fs.writeFileSync(CREDITS, JSON.stringify(sorted, null, 1) + "\n");
}

// id -> { file, category } for every image currently in a category folder
function scanFolders(categories) {
  const found = new Map();
  for (const category of categories) {
    const dir = path.join(DIR, category);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(dir).sort()) {
      if (!IMAGE_EXT.test(name)) continue;
      const id = name.replace(IMAGE_EXT, "");
      if (found.has(id)) {
        console.warn(`  ${id} is in both ${found.get(id).category}/ and ${category}/; using ${found.get(id).category}/`);
        continue;
      }
      found.set(id, { file: rel(path.join(dir, name)), category });
    }
  }
  return found;
}

async function fetchNew(groups, credits) {
  const key = apiKey();
  if (!key) {
    console.error("No Pixabay key. Add PIXABAY_API_KEY to js/config.js (see js/config.example.js) or set it in your env.");
    process.exit(1);
  }
  const jobs = Object.entries(groups).flatMap(([category, terms]) =>
    terms.flatMap((query) => TYPES.map((type) => ({ category, query, type })))
  );
  console.log(`Searching ${jobs.length} term/type combos...`);
  let total = 0;
  for (const { category, query, type } of jobs) {
    const params = new URLSearchParams({
      key, q: query, image_type: type, safesearch: "true", order: "popular", per_page: String(PER_TYPE),
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
      if (credits[id]) continue; // already have it, or someone deleted it on purpose
      const ext = (path.extname(new URL(h.webformatURL).pathname) || ".jpg").toLowerCase();
      try {
        const img = await fetch(h.webformatURL); // Pixabay wants images stored, not hotlinked
        if (!img.ok) throw new Error(`HTTP ${img.status}`);
        fs.writeFileSync(path.join(DIR, category, id + ext), Buffer.from(await img.arrayBuffer()));
      } catch (err) {
        console.warn(`  ${id}: ${err.message}`);
        continue;
      }
      credits[id] = {
        alt: h.tags || query,
        prompt: query,
        credit: {
          name: h.user,
          link: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
          site: "Pixabay",
          siteLink: h.pageURL,
        },
      };
      added++;
    }
    total += added;
    console.log(`  [${category}] ${query} (${type}): +${added}`);
    await sleep(PAUSE_MS);
  }
  writeCredits(credits);
  console.log(`Downloaded ${total} new images.\n`);
}

async function main() {
  const groups = require(path.join(ROOT, "js", "queries.js"));
  const categories = Object.keys(groups);
  for (const c of categories) fs.mkdirSync(path.join(DIR, c), { recursive: true });
  const credits = readCredits();

  if (process.argv.includes("--fetch")) await fetchNew(groups, credits);

  const previous = new Map((loadBrowserScript(OUT, "IMAGE_CACHE")?.photos || []).map((p) => [p.id, p]));
  const found = scanFolders(categories);

  const photos = [...found].map(([id, { file, category }]) => {
    const meta = credits[id];
    const prompt = meta?.prompt || id.replace(/[-_]+/g, " ").trim(); // your own image: name it what to draw
    return { id, file, alt: meta?.alt || prompt, prompt, category, credit: meta?.credit || null };
  });

  const cache = { generatedAt: new Date().toISOString(), source: "pixabay", photos };
  fs.writeFileSync(
    OUT,
    "// GENERATED by scripts/build-pixabay-cache.js from the treat/ and trick/ folders. Don't edit by hand.\n" +
      "window.IMAGE_CACHE = " + JSON.stringify(cache, null, 1) + ";\n"
  );

  // what changed since the last build
  const removed = [...previous.keys()].filter((id) => !found.has(id));
  const moved = photos.filter((p) => previous.has(p.id) && previous.get(p.id).category !== p.category);
  const added = photos.filter((p) => !previous.has(p.id));
  const custom = photos.filter((p) => !credits[p.id]);
  const by = (c) => photos.filter((p) => p.category === c).length;
  console.log(`assets/pixabay/cache.js: ${photos.length} images (${categories.map((c) => `${by(c)} ${c}`).join(", ")})`);
  if (added.length) console.log(`  added:   ${added.length}`);
  if (removed.length) console.log(`  removed: ${removed.length}  (won't be re-downloaded)`);
  if (moved.length) console.log(`  moved:   ${moved.map((p) => `${p.id} -> ${p.category}`).join(", ")}`);
  if (custom.length) console.log(`  your own images (no credit): ${custom.map((p) => `${p.file} = "${p.prompt}"`).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
