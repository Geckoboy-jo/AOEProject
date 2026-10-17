// imageApi.js — pulls random "trick or treat" images for each round.
//
// Uses the Unsplash API when an access key is set in config.js.
// Falls back to built-in emoji images when there's no key, no network,
// or we hit the rate limit, so the demo never breaks.
//
// Usage:  const img = await ImageApi.next();
//         img = { src, alt, prompt, credit: { name, link } | null, source }

const ImageApi = (() => {
  // Edit these freely: each refill picks one at random.
  const QUERIES = [
    // treats (spooky)
    "halloween cartoon",
    "halloween illustration",
    "jack o lantern",
    "ghost illustration",
    "witch hat",
    "black cat halloween",
    "bat illustration",
    "skeleton cartoon",
    "haunted house",
    "candy corn",
    "spider web",
    // tricks (cheeky)
    "dog in costume",
    "cat in costume",
    "rubber duck",
    "funny monster",
    "pizza slice",
    "cactus",
    "frog",
  ];

  const BATCH_SIZE = 10;   // images per API call (Unsplash max is 30)
  const REFILL_AT = 3;     // fetch more when this many are left
  const UTM = "utm_source=aoe_hackathon_drawing_game&utm_medium=referral";

  // Offline / no-key fallback: emoji drawn into SVG data URLs.
  const FALLBACK = [
    ["🎃", "pumpkin"], ["👻", "ghost"], ["🦇", "bat"], ["🕷️", "spider"],
    ["💀", "skull"], ["🧙", "witch"], ["🍬", "candy"], ["🧛", "vampire"],
    ["🕸️", "spider web"], ["🧟", "zombie"], ["🐈‍⬛", "black cat"],
    ["🦉", "owl"], ["🍭", "lollipop"], ["🌕", "full moon"], ["🪦", "gravestone"],
    ["🐸", "frog"], ["🦆", "duck"], ["🌮", "taco"], ["🌵", "cactus"],
  ];

  let queue = [];
  let refilling = null;
  let unsplashDisabled = false;

  const accessKey = () =>
    (window.APP_CONFIG && window.APP_CONFIG.UNSPLASH_ACCESS_KEY) || "";

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function emojiImage([emoji, name]) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">` +
      `<rect width="100%" height="100%" fill="#fff"/>` +
      `<text x="50%" y="54%" font-size="260" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
    return {
      src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      alt: name,
      prompt: name,
      credit: null,
      source: "fallback",
    };
  }

  async function fetchUnsplashBatch() {
    const query = pick(QUERIES);
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
      credit: {
        name: p.user.name,
        link: `${p.user.links.html}?${UTM}`,
        unsplash: `https://unsplash.com/?${UTM}`,
      },
      source: "unsplash",
    }));
  }

  function preload(item) {
    const img = new Image();
    img.src = item.src;
    item.ready = img.decode().catch(() => {}); // resolves once it can display instantly
    return item;
  }

  function refill() {
    if (refilling) return refilling;
    refilling = (async () => {
      let items;
      if (accessKey() && !unsplashDisabled) {
        try {
          items = await fetchUnsplashBatch();
        } catch (err) {
          console.warn("[ImageApi] falling back to emoji:", err.message);
        }
      }
      if (!items || items.length === 0) {
        items = [...FALLBACK].sort(() => Math.random() - 0.5).slice(0, BATCH_SIZE).map(emojiImage);
      }
      queue.push(...items.map(preload));
    })().finally(() => (refilling = null));
    return refilling;
  }

  async function next() {
    if (queue.length === 0) await refill();
    const item = queue.shift();
    if (queue.length <= REFILL_AT) refill(); // top up in the background
    await item.ready; // don't start the 3s timer until it's actually on screen
    return item;
  }

  // Warm the queue on page load so the first round is instant.
  refill();

  return { next, refill };
})();
