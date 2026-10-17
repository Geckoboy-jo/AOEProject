// queries.js: Unsplash search terms, shared by the page (imageApi.js) and
// the cache builder (scripts/build-image-cache.js). Edit freely.
const IMAGE_QUERIES = [
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

if (typeof module !== "undefined") module.exports = IMAGE_QUERIES;
