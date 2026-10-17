// queries.js: search terms by category, used by the image cache builders
// (scripts/build-pixabay-cache.js) and the live-API fallback in imageApi.js.
// Re-run the cache builder after changing them.
//
//   treat = spooky Halloween things
//   trick = still Halloween, but odd and goofy (a twist on the spooky stuff)
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
    "dog halloween costume",
    "cat witch hat",
    "dancing skeleton",
    "skeleton dog",
    "funny pumpkin",
    "cute ghost",
    "cute vampire",
    "zombie cartoon",
    "frankenstein cartoon",
    "halloween monster cute",
    "candy monster",
    "cute bat",
    "halloween frog",
    "pumpkin cat",
    "cute spider",
    "ghost sheet",
    "skeleton cartoon",
    "witch cartoon",
    "halloween costume animal",
    "pumpkin face funny",
    "halloween owl",
    "cartoon mummy",
    "halloween cupcake",
  ],
};

if (typeof module !== "undefined") module.exports = IMAGE_QUERIES;
