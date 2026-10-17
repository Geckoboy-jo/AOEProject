// howToPlay.js: the how-to-play dialog. Opens on first load (unless the
// player ticked "don't show"), reopens from the gear via openPopup().

(() => {
  const dialog = document.getElementById("how-to-play");
  if (!dialog) return;

  const STORAGE_KEY = "ghoulle.hideHowToPlay";
  const dontShow = document.getElementById("htp-dontshow");

  const read = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  };
  const write = (hide) => {
    try {
      hide ? localStorage.setItem(STORAGE_KEY, "1") : localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked: the dialog just shows every time */
    }
  };

  dontShow.checked = read();
  dontShow.addEventListener("change", () => write(dontShow.checked));

  // close buttons (×, "Just let me doodle")
  dialog.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => dialog.close())
  );

  // Treat / Trick start a round straight from the dialog
  dialog.querySelectorAll(".htp-start").forEach((btn) =>
    btn.addEventListener("click", () => {
      dialog.close();
      if (typeof Game !== "undefined") Game.startRound(btn.dataset.category);
    })
  );

  // click on the dimmed backdrop closes it
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dialog.close();
    }
  });

  if (!read()) dialog.showModal();
})();
