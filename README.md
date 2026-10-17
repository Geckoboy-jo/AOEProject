# Web Based Drawing App

This is a web based drawing application that uses **`HTML`**, **`CSS`** and **`JavaScript`** to allow you to draw anything you like on the web. Choose drawing colors with the HSV color wheel or its brightness, hue, and saturation sliders. Save the current canvas as a PNG and choose its file location in browsers that support the File System Access API.

[Click here](https://sudipt1999.github.io/drawing-app/) to start drawing.

![Drawing App Screenshot](assets/ui/drawing-app-screenshot.png)

## Contributing

If you would like to make this project amazing feel free to contribute. There are so many features that could be added to this project to make it better.

* Add erase functionality
* Add fill funtionality
* Add different colors
* And much more...

This was a college project, so I only have the funtionality required for the project, but I would love to see this project get better.

## Trick-or-Treat Pictionary (hackathon fork)

Pick **Treat** (spooky) or **Trick** (cheeky): an image shows for 6 seconds, then you draw it from memory before the timer runs out and compare yours to the original.

**Images (Pixabay illustrations + clipart):**
1. Get a free API key at https://pixabay.com/api/docs (sign in, the key is on that page).
2. `cp js/config.example.js js/config.js` and set `PIXABAY_API_KEY` (or pass it as an env var).
3. `node scripts/build-pixabay-cache.js` downloads images into `assets/pixabay/` and writes `assets/pixabay/cache.js`.
4. Search terms live in `js/queries.js`, split into `treat` (spooky) and `trick` (cheeky).
5. To drop a bad image: delete its entry in `cache.js` and add its id to `assets/pixabay/blocklist.json`.

With no image cache, the game falls back to the live Unsplash API (if `UNSPLASH_ACCESS_KEY` is set) or built-in emoji images.