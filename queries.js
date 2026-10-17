// queries.js: Unsplash search terms by category, shared by the page
// (imageApi.js) and the cache builder (scripts/build-image-cache.js).
// Edit freely; re-run the cache builder after changing them.
//
//   treat = spooky Halloween images
//   trick = cheeky, random curveballs
const IMAGE_QUERIES = {
  treat: [
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
  ],
  trick: [
    "dog in costume",
    "cat in costume",
    "rubber duck",
    "funny monster",
    "pizza slice",
    "cactus",
    "frog",
  ],
};

if (typeof module !== "undefined") module.exports = IMAGE_QUERIES;
