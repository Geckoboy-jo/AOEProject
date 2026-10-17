# Web Based Drawing App

This is a web based drawing application that uses **`HTML`**, **`CSS`** and **`JavaScript`** to allow you to draw anything you like on the web!

[Click here](https://sudipt1999.github.io/drawing-app/) to start drawing.

![Drawing App Screenshot](drawing-app-screenshot.png)

## Contributing

If you would like to make this project amazing feel free to contribute. There are so many features that could be added to this project to make it better.

* Add erase functionality
* Add fill funtionality
* Add different colors
* And much more...

This was a college project, so I only have the funtionality required for the project, but I would love to see this project get better.

## Trick-or-Treat Pictionary (hackathon fork)

Click **New round**: a random image flashes for 3 seconds, then you draw it from memory. Hit **Reveal** to compare.

**Images (Unsplash):**
1. Create an app at https://unsplash.com/developers and copy its **Access Key**.
2. `cp config.example.js config.js` and paste the key in. `config.js` is gitignored.
3. Search terms live in the `QUERIES` list at the top of `imageApi.js`.

With no key (or if Unsplash rate-limits us: demo apps get 50 requests/hour), it falls back to built-in emoji images so the game still works. Each API call fetches 10 images, so 50 requests is about 500 rounds.
