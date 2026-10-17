// imageApi.js — pulls random "trick or treat" images for each round.
//
// Where images come from, in order:
//   1. assets/pixabay/cache.js (built by scripts/build-pixabay-cache.js):
//      illustrations/clipart stored locally, zero API calls
//   2. the live Unsplash API, if config.js has a key
//   3. built-in emoji images, so the demo never breaks
// Set APP_CONFIG.PREFER_LIVE_API = true in config.js to skip the cache.
// When hosted (anything but localhost / file://), the live API is off: cache only.
//
// Categories: "treat" (spooky), "trick" (cheeky), or "either".
//   const img = await ImageApi.next("trick");
//
// Usage:  const img = await ImageApi.next("treat");
//         img = { src, alt, prompt, category, credit: { name, link } | null, source }

const ImageApi = (() => {
  // Search terms live in queries.js (shared with the cache builder).
  const QUERIES =
    typeof IMAGE_QUERIES !== "undefined"
      ? IMAGE_QUERIES
      : { treat: ["halloween illustration"], trick: ["funny animal"] };
  const CATEGORIES = Object.keys(QUERIES);

  const BATCH_SIZE = 10;   // images per API call (Unsplash max is 30)
  const REFILL_AT = 3;     // fetch more when this many are left
  const UTM = "utm_source=aoe_hackathon_drawing_game&utm_medium=referral";

  // Offline / no-key fallback: emoji drawn into SVG data URLs.
  const FALLBACK = {
    treat: [
      ["🎃", "pumpkin"], ["👻", "ghost"], ["🦇", "bat"], ["🕷️", "spider"],
      ["💀", "skull"], ["🧙", "witch"], ["🍬", "candy"], ["🧛", "vampire"],
      ["🕸️", "spider web"], ["🧟", "zombie"], ["🐈‍⬛", "black cat"],
      ["🦉", "owl"], ["🍭", "lollipop"], ["🌕", "full moon"], ["🪦", "gravestone"],
    ],
    trick: [
      ["🐸", "frog"], ["🦆", "duck"], ["🌮", "taco"], ["🌵", "cactus"],
      ["🍕", "pizza"], ["🦖", "dinosaur"], ["🐙", "octopus"], ["🚽", "toilet"],
      ["🥒", "pickle"], ["🦩", "flamingo"], ["🧀", "cheese"], ["🐌", "snail"],
    ],
  };

  // one queue / refill / cache deck per category
  const queues = {};
  const refilling = {};
  const cacheDecks = {};
  let unsplashDisabled = false;

  // which category a cached photo belongs to (older caches have no category field)
  const queryCategory = {};
  CATEGORIES.forEach((c) => QUERIES[c].forEach((q) => (queryCategory[q] = c)));

  const allCachedPhotos = () =>
    (window.IMAGE_CACHE && Array.isArray(window.IMAGE_CACHE.photos) && window.IMAGE_CACHE.photos) || [];
  const cachedPhotos = (category) =>
    allCachedPhotos().filter((p) => (p.category || queryCategory[p.prompt]) === category);

  // Hosted builds (e.g. GitHub Pages) never call a live API or use a key.
  const isLocal = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);

  const preferLive = () => isLocal && !!(window.APP_CONFIG && window.APP_CONFIG.PREFER_LIVE_API);

  // Deal from a shuffled deck so you don't see repeats until the whole cache is used.
  function cachedBatch(category) {
    const photos = cachedPhotos(category);
    const out = [];
    while (out.length < Math.min(BATCH_SIZE, photos.length)) {
      let deck = cacheDecks[category];
      if (!deck || deck.length === 0) {
        deck = cacheDecks[category] = [...photos];
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
      }
      const p = deck.pop();
      out.push({
        src: p.file || p.src,
        remoteSrc: p.src,
        alt: p.alt,
        prompt: p.prompt,
        category,
        credit: p.credit // null for the team's own images
          ? {
              name: p.credit.name,
              link: p.credit.link,
              site: p.credit.site || "Unsplash",
              siteLink: p.credit.siteLink || `https://unsplash.com/?${UTM}`,
            }
          : null,
        source: "cache",
      });
    }
    return out;
  }

  const accessKey = () =>
    (isLocal && window.APP_CONFIG && window.APP_CONFIG.UNSPLASH_ACCESS_KEY) || "";

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const resolve = (category) =>
    CATEGORIES.includes(category) ? category : pick(CATEGORIES); // "either" -> random

  function emojiImage([emoji, name], category) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">` +
      `<rect width="100%" height="100%" fill="#fff"/>` +
      `<text x="50%" y="54%" font-size="260" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
    return {
      src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      alt: name,
      prompt: name,
      category,
      credit: null,
      source: "fallback",
    };
  }

  async function fetchUnsplashBatch(category) {
    const query = pick(QUERIES[category]);
    const params = new URLSearchParams({
      query,
      count: String(BATCH_SIZE),
      content_filter: "high", // keep it safe for a public demo
      orientation: "squarish",
    });
    const res = await fetch(`https://api.unsplash.com/photos/random?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey()}`,
        "Accept-Version": "v1",
      },
    });
    if (res.status === 401 || res.status === 403) {
      // Bad key or rate limited: stop hammering the API for this session.
      unsplashDisabled = true;
      throw new Error(`Unsplash refused the request (${res.status})`);
    }
    if (!res.ok) throw new Error(`Unsplash error ${res.status}`);

    const photos = await res.json();
    return photos.map((p) => ({
      src: p.urls.regular,
      alt: p.alt_description || query,
      prompt: query,
      category,
      credit: {
        name: p.user.name,
        link: `${p.user.links.html}?${UTM}`,
        site: "Unsplash",
        siteLink: `https://unsplash.com/?${UTM}`,
      },
      source: "unsplash",
    }));
  }

  function preload(item) {
    const load = (src) => {
      const img = new Image();
      img.src = src;
      return img.decode();
    };
    // resolves once it can display instantly; if a cached file is missing,
    // switch to the Unsplash URL instead
    item.ready = load(item.src).catch(() => {
      if (item.remoteSrc && item.remoteSrc !== item.src) {
        item.src = item.remoteSrc;
        return load(item.src).catch(() => {});
      }
    });
    return item;
  }

  function refill(category) {
    if (refilling[category]) return refilling[category];
    refilling[category] = (async () => {
      let items;
      const haveCache = cachedPhotos(category).length > 0;
      if (haveCache && !preferLive()) {
        items = cachedBatch(category);
      } else if (accessKey() && !unsplashDisabled) {
        try {
          items = await fetchUnsplashBatch(category);
        } catch (err) {
          console.warn("[ImageApi] live API failed:", err.message);
          if (haveCache) items = cachedBatch(category);
        }
      }
      if (!items || items.length === 0) {
        items = [...FALLBACK[category]]
          .sort(() => Math.random() - 0.5)
          .slice(0, BATCH_SIZE)
          .map((e) => emojiImage(e, category));
      }
      (queues[category] = queues[category] || []).push(...items.map(preload));
    })().finally(() => (refilling[category] = null));
    return refilling[category];
  }

  // ---- painting ambush (Trick only): famous, public-domain, undrawable ----
  // List comes from assets/paintings/cache.js (scripts/build-paintings.js).
  const paintings = () => (Array.isArray(window.PAINTINGS) ? window.PAINTINGS : []);
  let paintingDeck = [];

  function nextPainting() {
    const all = paintings();
    if (!all.length) return null;
    if (paintingDeck.length === 0) {
      paintingDeck = [...all];
      for (let i = paintingDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [paintingDeck[i], paintingDeck[j]] = [paintingDeck[j], paintingDeck[i]];
      }
    }
    const p = paintingDeck.pop();
    return preload({
      src: p.file,
      alt: `${p.title} by ${p.artist}`,
      prompt: p.title,
      category: "trick",
      painting: { title: p.title, artist: p.artist, year: p.year, article: p.article },
      credit: { name: p.artist, link: p.article, site: "Wikimedia Commons", siteLink: p.commons, publicDomain: true },
      source: "painting",
    });
  }

  // category: "treat", "trick", or "either" (default)
  // opts.paintingChance: odds (0-1) that a Trick round is a famous painting instead
  async function next(category = "either", opts = {}) {
    const c = resolve(category);
    if (c === "trick" && opts.paintingChance > 0 && Math.random() < opts.paintingChance) {
      const painting = nextPainting();
      if (painting) {
        await painting.ready;
        return painting;
      }
    }
    if (!queues[c] || queues[c].length === 0) await refill(c);
    const item = queues[c].shift();
    if (queues[c].length <= REFILL_AT) refill(c); // top up in the background
    await item.ready; // don't start the 3s timer until it's actually on screen
    return item;
  }

  // Warm every category on page load so the first round is instant.
  // (With no cache this costs one live API call per category.)
  CATEGORIES.forEach((c) => refill(c));

  const source = () =>
    allCachedPhotos().length && !preferLive() ? "cache" : accessKey() && !unsplashDisabled ? "live" : "emoji";
  console.info(
    `[ImageApi] image source: ${source()} (` +
      CATEGORIES.map((c) => `${cachedPhotos(c).length} ${c}`).join(", ") +
      ` cached, ${paintings().length} paintings)`
  );

  return { next, refill, source, categories: CATEGORIES };
})();
