// queries.js: search terms by category, used by the image cache builders
// (scripts/build-pixabay-cache.js) and the live-API fallback in imageApi.js.
// Re-run the cache builder after changing them.
//
//   treat = spooky Halloween things
//   trick = cheeky, random curveballs
//
// Results are illustrations/vector art, so simple one-subject terms work best.
const IMAGE_QUERIES = {
  treat: [
    "jack o lantern",
    "ghost",
    "bat halloween",
    "witch",
    "black cat halloween",
    "skeleton",
    "haunted house",
    "spider web",
    "vampire",
    "mummy",
    "zombie",
    "cauldron",
    "candy corn",
    "gravestone",
  ],
  trick: [
    "funny dog",
    "cat cartoon",
    "rubber duck",
    "cute monster",
    "dinosaur cartoon",
    "alien cartoon",
    "pizza cartoon",
    "taco",
    "frog cartoon",
    "sloth",
    "octopus cartoon",
    "robot cartoon",
    "banana cartoon",
    "llama",
  ],
};

if (typeof module !== "undefined") module.exports = IMAGE_QUERIES;
