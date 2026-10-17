// scoring.js: a generous 1-100 "how close was your memory" score.
//
// A hand drawing can never match a photo pixel for pixel, so both images are
// shrunk to a small grid and compared on three loose things:
//   - color layout  (are the same colors in the same places?)
//   - light/dark layout (is the overall composition similar?)
//   - palette (do you use the same kinds of colors?)
// The blend is then curved upward so a sincere attempt lands well above 50.
//
// Scoring.compare(drawingCanvas, originalSrc) -> Promise<{ score, parts } | null>
// (null when the original image can't be read, e.g. a remote image without CORS)

const Scoring = (() => {
  const GRID = 16;
  const HUE_BINS = 12;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // pixel data of `source` shrunk to GRID x GRID; `cover` crops instead of stretching
  function sample(source, srcW, srcH, aspect, cover) {
    const c = document.createElement("canvas");
    c.width = c.height = GRID;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, GRID, GRID);
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (cover) {
      // crop the photo to the drawing's aspect ratio, like the canvas would frame it
      if (srcW / srcH > aspect) {
        sw = srcH * aspect;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / aspect;
        sy = (srcH - sh) / 2;
      }
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, GRID, GRID);
    return ctx.getImageData(0, 0, GRID, GRID).data;
  }

  function lum(d, i) {
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  function colorLayout(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 4) {
      total += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]) / 441.7;
    }
    const sim = 1 - total / (a.length / 4);
    // unrelated images already score ~0.6 here, so stretch the useful range
    return clamp01((sim - 0.55) / 0.4);
  }

  function structure(a, b) {
    const n = a.length / 4;
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i += 4) {
      ma += lum(a, i);
      mb += lum(b, i);
    }
    ma /= n;
    mb /= n;
    let cov = 0, va = 0, vb = 0;
    for (let i = 0; i < a.length; i += 4) {
      const x = lum(a, i) - ma;
      const y = lum(b, i) - mb;
      cov += x * y;
      va += x * x;
      vb += y * y;
    }
    if (va === 0 || vb === 0) return 0;
    return clamp01(cov / Math.sqrt(va * vb));
  }

  function hueHistogram(d) {
    const hist = new Array(HUE_BINS).fill(0);
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b);
      const delta = max - Math.min(r, g, b);
      if (delta === 0 || max === 0) continue;
      let h;
      if (max === r) h = ((g - b) / delta + 6) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      hist[Math.min(HUE_BINS - 1, Math.floor((h / 6) * HUE_BINS))] += (delta / max) * max;
    }
    return hist;
  }

  function palette(a, b) {
    const ha = hueHistogram(a);
    const hb = hueHistogram(b);
    const sa = ha.reduce((s, v) => s + v, 0);
    const sb = hb.reduce((s, v) => s + v, 0);
    if (sa === 0 && sb === 0) return 1; // both essentially gray
    if (sa === 0 || sb === 0) return 0.3;
    let overlap = 0;
    for (let i = 0; i < HUE_BINS; i++) {
      // neighbouring hues count a little so "almost the right color" still helps
      const near = (hb[(i + HUE_BINS - 1) % HUE_BINS] + hb[(i + 1) % HUE_BINS]) / sb;
      overlap += Math.min(ha[i] / sa, hb[i] / sb + near * 0.3);
    }
    return clamp01(overlap);
  }

  // fraction of the drawing that isn't plain white paper
  function inkCoverage(canvas) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) ink++;
    }
    return ink / (64 * 64);
  }

  async function compare(drawingCanvas, originalSrc) {
    let img;
    try {
      img = await loadImage(originalSrc);
    } catch (err) {
      console.warn("Scoring: couldn't load the original", err);
      return null;
    }

    let a, b;
    try {
      const aspect = drawingCanvas.width / drawingCanvas.height;
      a = sample(drawingCanvas, drawingCanvas.width, drawingCanvas.height, aspect, false);
      b = sample(img, img.naturalWidth || img.width, img.naturalHeight || img.height, aspect, true);
    } catch (err) {
      console.warn("Scoring: image data not readable", err);
      return null;
    }

    const parts = {
      color: colorLayout(a, b),
      structure: structure(a, b),
      palette: palette(a, b),
    };
    const raw = parts.color * 0.4 + parts.structure * 0.35 + parts.palette * 0.25;

    // generous curve: raw 0.3 -> 51, 0.5 -> 75, 0.7 -> 91
    const curved = 1 - Math.pow(1 - raw, 2);

    // a nearly empty canvas can't earn a high score just because the photo is bright
    const effort = clamp01(inkCoverage(drawingCanvas) / 0.06);
    const score = Math.max(1, Math.min(100, Math.round(100 * curved * (0.15 + 0.85 * effort))));
    return { score, parts };
  }

  return { compare };
})();
