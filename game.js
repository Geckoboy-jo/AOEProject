// game.js — round flow: flash a random image for 3s, draw it before the
// timer runs out, then reveal it next to your drawing.

const Game = (() => {
  const SHOW_MS = 3000;
  const DEFAULT_ROUND_SECONDS = 300;

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
      <h2 id="reveal-title">Trick or treat? 👻</h2>
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

  // controls go in the header slot if the page has one, otherwise float
  (document.getElementById("round-slot") || document.body).append(bar);
  document.body.append(flash, reveal);

  const $ = (id) => document.getElementById(id);
  const statusEl = $("round-status");
  const newBtn = $("new-round");
  const revealBtn = $("reveal");
  const timerEl = $("round-timer"); // optional, lives in the header
  const lengthSelect = $("round-length"); // optional, lives in settings

  let current = null;
  let busy = false;
  let drawTimer = null;
  let deadline = 0;

  const roundSeconds = () =>
    Number(lengthSelect && lengthSelect.value) || DEFAULT_ROUND_SECONDS;

  function fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function showTime(sec) {
    if (!timerEl) return;
    timerEl.textContent = fmt(sec);
    timerEl.classList.toggle("urgent", sec <= 10 && sec > 0);
  }

  function stopDrawTimer() {
    clearInterval(drawTimer);
    drawTimer = null;
    if (timerEl) timerEl.classList.remove("urgent");
  }

  function startDrawTimer() {
    stopDrawTimer();
    deadline = Date.now() + roundSeconds() * 1000;
    const tick = () => {
      const left = (deadline - Date.now()) / 1000;
      showTime(left);
      if (left <= 0) {
        stopDrawTimer();
        statusEl.textContent = "Time's up! 💀";
        showReveal(true);
      }
    };
    tick();
    drawTimer = setInterval(tick, 250);
  }

  if (lengthSelect) {
    lengthSelect.addEventListener("change", () => {
      if (!drawTimer) showTime(roundSeconds());
    });
  }
  showTime(roundSeconds());

  function creditHTML(item) {
    if (!item.credit) return "";
    return `Photo by <a href="${item.credit.link}" target="_blank" rel="noopener">${item.credit.name}</a>
      on <a href="${item.credit.unsplash}" target="_blank" rel="noopener">Unsplash</a>`;
  }

  async function startRound() {
    if (busy) return;
    busy = true;
    stopDrawTimer();
    showTime(roundSeconds());
    reveal.hidden = true;
    newBtn.disabled = true;
    revealBtn.disabled = true;
    statusEl.textContent = "Summoning… 🔮";

    try {
      current = await ImageApi.next();
    } catch (err) {
      console.error(err);
      statusEl.textContent = "No image. Try again?";
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
      statusEl.textContent = "Draw it! ✏️";
      newBtn.disabled = false;
      revealBtn.disabled = false;
      busy = false;
      startDrawTimer();
    }, SHOW_MS);
  }

  function showReveal(timedOut = false) {
    if (!current) return;
    stopDrawTimer();
    const canvas = $("canvas");
    $("reveal-title").textContent = timedOut ? "Time's up! Trick or treat? 👻" : "Trick or treat? 👻";
    $("reveal-original").src = current.src;
    $("reveal-original").alt = current.alt;
    $("reveal-prompt").textContent = `The real thing (${current.prompt})`;
    $("reveal-drawing").src = canvas ? canvas.toDataURL("image/png") : "";
    $("reveal-credit").innerHTML = creditHTML(current);
    reveal.hidden = false;
  }

  newBtn.addEventListener("click", startRound);
  revealBtn.addEventListener("click", () => showReveal(false));
  $("reveal-next").addEventListener("click", startRound);
  $("reveal-close").addEventListener("click", () => (reveal.hidden = true));

  return { startRound, showReveal };
})();
