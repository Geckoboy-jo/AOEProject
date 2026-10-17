// game.js — round flow: flash a random image for 3s, then you draw it, then reveal.
// Builds its own UI so it doesn't fight with index.html / style.css edits.

const Game = (() => {
  const SHOW_MS = 3000;

  // ---- build UI ----
  const bar = document.createElement("div");
  bar.id = "round-bar";
  bar.innerHTML = `
    <span id="round-status">Ready when you are 🎃</span>
    <button id="new-round" type="button">New round</button>
    <button id="reveal" type="button" disabled>Reveal</button>`;

  const flash = document.createElement("div");
  flash.id = "flash-overlay";
  flash.hidden = true;
  flash.innerHTML = `
    <div class="flash-card">
      <div id="flash-countdown"></div>
      <img id="flash-img" alt="" />
      <p class="credit" id="flash-credit"></p>
    </div>`;

  const reveal = document.createElement("div");
  reveal.id = "reveal-overlay";
  reveal.hidden = true;
  reveal.innerHTML = `
    <div class="reveal-card">
      <h2>Trick or treat? 👻</h2>
      <div class="reveal-pair">
        <figure><img id="reveal-original" alt="" /><figcaption id="reveal-prompt">The real thing</figcaption></figure>
        <figure><img id="reveal-drawing" alt="your drawing" /><figcaption>Your masterpiece</figcaption></figure>
      </div>
      <p class="credit" id="reveal-credit"></p>
      <div class="reveal-actions">
        <button id="reveal-close" type="button">Keep drawing</button>
        <button id="reveal-next" type="button">Next round</button>
      </div>
    </div>`;

  document.body.append(bar, flash, reveal);

  const $ = (id) => document.getElementById(id);
  const statusEl = $("round-status");
  const newBtn = $("new-round");
  const revealBtn = $("reveal");

  let current = null;
  let busy = false;

  function creditHTML(item) {
    if (!item.credit) return "";
    return `Photo by <a href="${item.credit.link}" target="_blank" rel="noopener">${item.credit.name}</a>
      on <a href="${item.credit.unsplash}" target="_blank" rel="noopener">Unsplash</a>`;
  }

  async function startRound() {
    if (busy) return;
    busy = true;
    reveal.hidden = true;
    newBtn.disabled = true;
    revealBtn.disabled = true;
    statusEl.textContent = "Summoning an image… 🔮";

    try {
      current = await ImageApi.next();
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Couldn't load an image. Try again?";
      newBtn.disabled = false;
      busy = false;
      return;
    }

    // wipe the canvas for the new round (reuses the app's CLEAR logic)
    const clearBtn = $("clear");
    if (clearBtn) clearBtn.click();

    $("flash-img").src = current.src;
    $("flash-img").alt = current.alt;
    $("flash-credit").innerHTML = creditHTML(current);
    flash.hidden = false;

    // countdown 3..2..1
    const countdown = $("flash-countdown");
    const end = Date.now() + SHOW_MS;
    const tick = () => {
      const left = Math.ceil((end - Date.now()) / 1000);
      countdown.textContent = left > 0 ? left : "";
    };
    tick();
    const timer = setInterval(tick, 100);

    setTimeout(() => {
      clearInterval(timer);
      flash.hidden = true;
      statusEl.textContent = "Now draw it from memory! ✏️";
      newBtn.disabled = false;
      revealBtn.disabled = false;
      busy = false;
    }, SHOW_MS);
  }

  function showReveal() {
    if (!current) return;
    const canvas = $("canvas");
    $("reveal-original").src = current.src;
    $("reveal-original").alt = current.alt;
    $("reveal-prompt").textContent = `The real thing (${current.prompt})`;
    $("reveal-drawing").src = canvas ? canvas.toDataURL("image/png") : "";
    $("reveal-credit").innerHTML = creditHTML(current);
    reveal.hidden = false;
  }

  newBtn.addEventListener("click", startRound);
  revealBtn.addEventListener("click", showReveal);
  $("reveal-next").addEventListener("click", startRound);
  $("reveal-close").addEventListener("click", () => (reveal.hidden = true));

  return { startRound, showReveal };
})();
