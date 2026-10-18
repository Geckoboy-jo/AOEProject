// audio.js: background music + sound effects.
//
// The game is one page (screens just swap), so a single music element created
// here keeps playing across every screen without restarting.
// Browsers block audio until the first click/key, so the music starts then.
//
// Sfx.select(), Sfx.back(), Sfx.pass(), Sfx.fail(), Sfx.reveal(), Sfx.startClock(), Sfx.stopClock()

const Sfx = (() => {
  const DIR = "assets/sounds/";

  const music = new Audio(DIR + "music-background.mp3");
  music.loop = true;
  music.volume = 0.3;

  const sounds = {};
  for (const name of ["select", "back", "pass", "fail", "clock", "lightning", "dracula-laugh"]) {
    sounds[name] = new Audio(`${DIR}sound-${name}.wav`);
    sounds[name].preload = "auto";
  }

  let clockOn = false;

  function play(name) {
    const a = sounds[name];
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function startMusic() {
    if (!music.paused) return;
    music.play().then(removeUnlockers, () => {});
  }

  const unlockEvents = ["pointerdown", "keydown", "touchstart"];
  function removeUnlockers() {
    unlockEvents.forEach((ev) => document.removeEventListener(ev, startMusic, true));
  }
  unlockEvents.forEach((ev) => document.addEventListener(ev, startMusic, true));
  startMusic(); // works right away if the browser allows autoplay

  // Undo and Clear play "back"; every other button plays "select".
  // Script-driven clicks (e.g. the auto-clear when a round starts) stay silent.
  document.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    const target = e.target.closest("button, .swatch");
    if (!target || target.disabled) return;
    play(target.id === "back" || target.id === "clear" ? "back" : "select");
  });

  return {
    select: () => play("select"),
    back: () => play("back"),
    pass: () => play("pass"),
    fail: () => play("fail"),
    reveal: () => {
      play("lightning");
      play("dracula-laugh");
    },
    startClock: () => {
      if (clockOn) return;
      clockOn = true;
      play("clock");
    },
    stopClock: () => {
      clockOn = false;
      sounds.clock.pause();
      sounds.clock.currentTime = 0;
    },
  };
})();
