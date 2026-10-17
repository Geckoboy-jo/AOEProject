// game.js: the screen flow.
//
//   start  -> pick Treat or Trick
//   preview -> memorize the image (look-time countdown in the header)
//   draw   -> draw it before the timer runs out (or hit Done)
//   results -> yours vs. original, save / share / play again
//
// body[data-screen] says which screen is showing; css/style.css does the rest.
// Hooks for other UI: Game.start("treat" | "trick"), Game.finish(), Game.toStart(),
// Game.mode, Game.screen.

const Game = (() => {
  // Per-mode rules. Trick vs. Treat only changes the kind of image for now;
  // timings are kept per mode so gimmicks can be added later. The start
  // screen reads these too.
  const MODES = {
    treat: { name: "Treat", blurb: "Spooky images", viewSeconds: 6, drawSeconds: 60 },
    trick: { name: "Trick", blurb: "Cheeky images", viewSeconds: 6, drawSeconds: 60 },
  };

  const $ = (id) => document.getElementById(id);
  const timerEl = $("round-timer");
  const lengthSelect = $("round-length");

  // header controls during the draw screen
  const bar = document.createElement("div");
  bar.id = "round-bar";
  bar.innerHTML = `
    <span id="round-status"></span>
    <button id="round-done" type="button">Done</button>`;
  ($("draw-footer") || document.body).append(bar);
  const statusEl = $("round-status");

  let screen = "start";
  let mode = "treat";
  let current = null; // the image for this round
  let timer = null;
  let busy = false;

  // streak = consecutive rounds scoring at least STREAK_MIN
  const STREAK_MIN = 50;
  let streak = 0;
  try {
    streak = Number(localStorage.getItem("ghoulle-streak")) || 0;
  } catch (err) {}
  function renderStreak() {
    $("streak-count").textContent = streak;
    try {
      localStorage.setItem("ghoulle-streak", streak);
    } catch (err) {}
  }
  renderStreak();

  // ---------- helpers ----------
  function fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function drawSeconds() {
    const v = lengthSelect && lengthSelect.value;
    return v && v !== "auto" ? Number(v) : MODES[mode].drawSeconds;
  }

  function setScreen(next) {
    screen = next;
    document.body.dataset.screen = next;
    syncHeader(); // the logo changes size per screen
    // the canvas was laid out while hidden; nudge it to re-fit
    if (next === "draw") window.dispatchEvent(new Event("resize"));
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
    timerEl.classList.remove("urgent");
  }

  // counts down `seconds` in the header, then calls onDone
  function countdown(seconds, onDone, urgentAt = 10) {
    stopTimer();
    const end = Date.now() + seconds * 1000;
    const tick = () => {
      const left = (end - Date.now()) / 1000;
      timerEl.textContent = fmt(left);
      timerEl.classList.toggle("urgent", left <= urgentAt && left > 0);
      if (left <= 0) {
        stopTimer();
        onDone();
      }
    };
    tick();
    timer = setInterval(tick, 200);
  }

  function creditHTML(item) {
    if (!item || !item.credit) return "";
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const c = item.credit;
    const site = c.site || "Unsplash";
    return `Image by <a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.name)}</a>
      on <a href="${esc(c.siteLink || c.unsplash || "#")}" target="_blank" rel="noopener">${esc(site)}</a>`;
  }

  // ---------- 1) start ----------
  document.querySelectorAll("[data-mode-desc]").forEach((el) => {
    const m = MODES[el.dataset.modeDesc];
    el.textContent = `${m.blurb} · ${m.viewSeconds}s look · ${fmt(m.drawSeconds)} to draw`;
  });
  document.querySelectorAll(".mode-btn").forEach((btn) =>
    btn.addEventListener("click", () => start(btn.dataset.mode))
  );

  function toStart() {
    stopTimer();
    busy = false;
    timerEl.textContent = "";
    setScreen("start");
  }

  // ---------- 2) preview ----------
  async function start(pickedMode = mode) {
    if (busy) return;
    busy = true;
    mode = MODES[pickedMode] ? pickedMode : "treat";
    document.querySelectorAll(".mode-btn").forEach((b) => (b.disabled = true));

    try {
      current = await ImageApi.next(mode);
    } catch (err) {
      console.error(err);
      busy = false;
      document.querySelectorAll(".mode-btn").forEach((b) => (b.disabled = false));
      return;
    }
    document.querySelectorAll(".mode-btn").forEach((b) => (b.disabled = false));

    // fresh canvas for the new round (reuses the app's Clear logic)
    const clearBtn = $("clear");
    if (clearBtn) clearBtn.click();

    $("preview-img").src = current.src;
    $("preview-img").alt = current.alt;
    $("preview-draw-time").textContent = fmt(drawSeconds());
    $("preview-credit").innerHTML = creditHTML(current);
    setScreen("preview");

    countdown(MODES[mode].viewSeconds, startDrawing, 0);
  }

  // ---------- 3) draw ----------
  function startDrawing() {
    busy = false;
    setScreen("draw");
    statusEl.textContent = "Draw it from memory";
    countdown(drawSeconds(), () => finish(true));
  }

  // ---------- 4) results ----------
  function finish(timedOut = false) {
    if (!current || screen !== "draw") return;
    stopTimer();
    timerEl.textContent = "";
    const canvas = $("canvas");
    $("results-title").textContent = timedOut ? "Time's up!" : "Pencils down!";
    $("results-drawing").src = canvas ? canvas.toDataURL("image/png") : "";
    $("results-original").src = current.src;
    $("results-original").alt = current.alt;
    $("results-credit").innerHTML = creditHTML(current);
    $("results-status").textContent = "";
    showScore(canvas, current);
    setScreen("results");
  }

  function scoreMessage(s) {
    if (s >= 90) return "Incredible memory!";
    if (s >= 75) return "Really close!";
    if (s >= 55) return "Nice work, you got the gist.";
    if (s >= 35) return "A solid spooky attempt.";
    return "Bold interpretation!";
  }

  async function showScore(canvas, item) {
    const box = $("results-score");
    box.hidden = true;
    if (!canvas || typeof Scoring === "undefined") return;
    const result = await Scoring.compare(canvas, item.src);
    if (current !== item || screen !== "results" || !result) return;
    $("results-score-num").textContent = result.score;
    $("results-score-msg").textContent = scoreMessage(result.score);
    streak = result.score >= STREAK_MIN ? streak + 1 : 0;
    renderStreak();
    box.hidden = false;
  }

  $("round-done").addEventListener("click", () => finish(false));

  async function drawingBlob() {
    return new Promise((resolve) => $("canvas").toBlob(resolve, "image/png"));
  }

  $("results-save").addEventListener("click", async () => {
    const status = $("results-status");
    try {
      const result = await ExportManager.saveCanvasAsPng($("canvas"), "ghoulle-drawing.png");
      status.textContent = result.saved ? "Saved." : "Save cancelled.";
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't save the image.";
    }
  });

  // Share: native share sheet with the image if the browser supports it,
  // otherwise copy the image to the clipboard, otherwise save it.
  $("results-share").addEventListener("click", async () => {
    const status = $("results-status");
    const blob = await drawingBlob();
    const file = new File([blob], "ghoulle-drawing.png", { type: "image/png" });
    const text = `I drew this from memory in Ghoulle. It was supposed to be: ${current ? current.prompt : "something spooky"}.`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: "Ghoulle" });
        status.textContent = "";
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // closed the share sheet
        console.warn("share failed, trying clipboard", err);
      }
    }
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        status.textContent = "Drawing copied to the clipboard.";
        return;
      } catch (err) {
        console.warn("clipboard failed, saving instead", err);
      }
    }
    try {
      const result = await ExportManager.saveCanvasAsPng($("canvas"), "ghoulle-drawing.png");
      status.textContent = result.saved ? "Sharing isn't available here, so it was saved instead." : "Save cancelled.";
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't share or save the image.";
    }
  });

  $("results-again").addEventListener("click", toStart);

  // ---------- settings dialog ----------
  const settings = $("settings-dialog");
  if (settings) {
    settings.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => settings.close()));
    $("settings-quit").addEventListener("click", () => {
      settings.close();
      toStart();
    });
    settings.addEventListener("click", (e) => {
      if (e.target !== settings) return;
      const r = settings.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) settings.close();
    });
  }

  // the header's height depends on the logo; screens size themselves from it
  function syncHeader() {
    const header = document.getElementById("top-bar");
    if (header) document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
  }
  window.addEventListener("resize", syncHeader);
  window.addEventListener("load", syncHeader);
  syncHeader();

  setScreen("start");

  return {
    start,
    finish,
    toStart,
    modes: MODES,
    get mode() {
      return mode;
    },
    get screen() {
      return screen;
    },
  };
})();
