// Copy this file to js/config.js and fill in what you have.
// js/config.js is gitignored so keys don't get committed.
//
// PIXABAY_API_KEY: only used by scripts/build-pixabay-cache.js; the page
//   doesn't need it. But index.html loads this file, so anything here is
//   visible in dev tools. To keep the key out of the browser entirely, set it
//   as an env var instead: PIXABAY_API_KEY=... node scripts/build-pixabay-cache.js
//   Free at pixabay.com/api/docs.
// UNSPLASH_ACCESS_KEY: optional live fallback when there's no image cache.
//   This one IS visible in the browser; fine for a local demo.
window.APP_CONFIG = {
  PIXABAY_API_KEY: "",
  UNSPLASH_ACCESS_KEY: "",
};
