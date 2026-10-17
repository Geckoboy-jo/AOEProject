// queries.js: Unsplash search terms by category, shared by the page
// (imageApi.js) and the cache builder (scripts/build-image-cache.js).
// Re-run the cache builder after changing them.
//
//   treat = spooky Halloween images
//   trick = cheeky, funny curveballs
//
// Keep terms specific. Generic ones ("frog", "pizza slice", "candy corn")
// return plain stock photos; Halloween/costume/3D terms return the good stuff.
const IMAGE_QUERIES = {
  treat: [
    "jack o lantern",
    "carved pumpkin",
    "halloween 3d",
    "halloween cartoon",
    "halloween decorations",
    "ghost costume",
    "skeleton decoration",
    "halloween costume",
    "haunted house",
    "black cat halloween",
    "witch costume",
    "zombie costume",
  ],
  trick: [
    "dog halloween costume",
    "cat halloween costume",
    "dog ghost costume",
    "dog wearing sunglasses",
    "pug costume",
    "funny monster",
    "3d monster character",
    "rubber duck",
    "cat wearing hat",
    "goofy dog",
    "funny face costume",
    "googly eyes",
  ],
};

if (typeof module !== "undefined") module.exports = IMAGE_QUERIES;
