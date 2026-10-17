console.log("starting the app!");

const artWrapper = new Wrapper();

// settings dialog (gear). Markup in index.html, wired up in game.js.
const closePopup = () => {
    const dialog = document.getElementById("settings-dialog");
    if (dialog && dialog.open) dialog.close();
};

const openPopup = () => {
    const dialog = document.getElementById("settings-dialog");
    if (dialog && !dialog.open) dialog.showModal();
};

const CANVAS_BG = "#ffffff";
const RENDER_SCALE = 2;

// spooky preset colors for the swatch grid
const SWATCHES = [
    "#000000", "#ffffff", "#7a7a7a", "#ff7a1a",
    "#ffb347", "#ffd23f", "#8dff6a", "#2e8b57",
    "#b26bff", "#5b2a86", "#e0262b", "#6b3e26",
];

//creating a canvas
const createCanvas = () => {
    const canvasDiv = document.querySelector("#canvasDiv");
    const canvas = document.createElement("canvas");
    const clearBtn = document.getElementById("clear");
    const saveStatus = document.getElementById("save-status");
    const backBtn = document.getElementById("back");
    const brushBtn = document.getElementById("tool-brush");
    const eraserBtn = document.getElementById("tool-eraser");
    const dropperBtn = document.getElementById("dropper");
    const dropperStatus = document.getElementById("dropper-status");
    let paint = false;
    let color = "#000000";
    let layer = "fg";
    const sizes = { bg: 3, fg: 6 }; // brush size remembered per layer
    let tool = "brush";
    let currentAction;
    const fillBtn = document.getElementById("tool-fill");
    const sizeSlider = document.getElementById("brush-size");
    const layerButtons = document.querySelectorAll("#layer-toggle button");
    const slotButtons = document.querySelectorAll("#saved-slots button");
    const slots = ["#000000", "#ffffff"];
    let activeSlot = 0;
    const layerCanvases = { bg: document.createElement("canvas"), fg: document.createElement("canvas") };

    canvas.setAttribute("id", "canvas");
    canvasDiv.appendChild(canvas);
    const context = canvas.getContext("2d");

    // size the canvas to fill its frame (and re-fit when the window changes)
    function fitCanvas() {
        const { width, height } = canvasDiv.getBoundingClientRect();
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.max(1, Math.round(width * RENDER_SCALE));
        canvas.height = Math.max(1, Math.round(height * RENDER_SCALE));
        redraw();
    }

    // ---- color: Owen's wheel + sliders, plus preset swatches ----
    const colorSliders = new ColorSliders(
        document.getElementById("hue"),
        document.getElementById("saturation"),
        document.getElementById("brightness")
    );

    const colorWheel = new ColorWheel(
        document.getElementById("color-wheel"),
        colorSliders,
        document.getElementById("selected-color"),
        (selectedColor) => {
            color = selectedColor;
            slots[activeSlot] = selectedColor;
            renderSlots();
            if (tool !== "fill") setTool("brush"); // picking a color switches back to the brush (fill stays)
        }
    );

    function renderSlots() {
        slotButtons.forEach((btn, i) => {
            btn.style.background = slots[i];
            btn.classList.toggle("active", i === activeSlot);
            btn.setAttribute("aria-checked", i === activeSlot);
        });
    }
    renderSlots();
    slotButtons.forEach((btn, i) => {
        btn.addEventListener("click", () => {
            activeSlot = i;
            renderSlots();
            const n = parseInt(slots[i].slice(1), 16);
            colorWheel.setRgbColor(n >> 16 & 255, n >> 8 & 255, n & 255);
        });
    });

    const swatchGrid = document.getElementById("swatches");
    SWATCHES.forEach((hex) => {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.className = "swatch";
        sw.style.background = hex;
        sw.title = hex;
        sw.addEventListener("click", () => {
            const n = parseInt(hex.slice(1), 16);
            colorWheel.setRgbColor(n >> 16 & 255, n >> 8 & 255, n & 255);
        });
        swatchGrid.appendChild(sw);
    });

    // ---- tools ----
    function setTool(next) {
        tool = next;
        [[brushBtn, "brush"], [eraserBtn, "eraser"], [dropperBtn, "dropper"], [fillBtn, "fill"]].forEach(([btn, name]) => {
            btn.classList.toggle("active", tool === name);
            btn.setAttribute("aria-pressed", tool === name);
        });
        if (tool === "dropper") dropperStatus.textContent = "Click the canvas to sample a color.";
        else {
            dropperStatus.textContent = "";
            dropperStatus.style.borderBottom = "";
        }
    }
    brushBtn.addEventListener("click", () => setTool("brush"));
    eraserBtn.addEventListener("click", () => setTool("eraser"));
    fillBtn.addEventListener("click", () => setTool("fill"));
    // dropper: uses the browser EyeDropper API (any pixel on screen); falls back to canvas-only sampling
    dropperBtn.addEventListener("click", async () => {
        if (!window.EyeDropper) {
            setTool(tool === "dropper" ? "brush" : "dropper");
            return;
        }
        try {
            const { sRGBHex } = await new EyeDropper().open();
            const n = parseInt(sRGBHex.slice(1), 16);
            colorWheel.setRgbColor(n >> 16 & 255, n >> 8 & 255, n & 255);
            dropperStatus.textContent = "Color sampled.";
            dropperStatus.style.borderBottom = "";
            setTimeout(() => {
                if (dropperStatus.textContent === "Color sampled.") dropperStatus.textContent = "";
            }, 2000);
        } catch (err) {
            // user pressed Escape; nothing to do
        }
    });

    // dropper: read the pixel under the pointer and load it into the color wheel
    function sampleColor(point) {
        const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
        const pixel = context.getImageData(x, y, 1, 1).data;
        colorWheel.setRgbColor(pixel[0], pixel[1], pixel[2]); // also switches back to the brush
        dropperStatus.textContent = "Color sampled.";
        dropperStatus.style.borderBottom = "";
        setTimeout(() => {
            if (dropperStatus.textContent === "Color sampled.") dropperStatus.textContent = "";
        }, 2000);
    }

    function renderSizeButtons() {
        sizeSlider.value = sizes[layer];
    }
    sizeSlider.addEventListener("input", () => {
        sizes[layer] = Number(sizeSlider.value);
    });

    function setLayer(next) {
        layer = next;
        layerButtons.forEach((b) => {
            b.classList.toggle("active", b.dataset.layer === layer);
            b.setAttribute("aria-checked", b.dataset.layer === layer);
        });
        renderSizeButtons();
    }
    layerButtons.forEach((btn) => btn.addEventListener("click", () => setLayer(btn.dataset.layer)));
    setLayer(layer);

    document.getElementById("settings-btn").addEventListener("click", openPopup);

    // ---- drawing ----
    // flood fill on one layer's pixels (compares RGBA with a small tolerance)
    function floodFill(ctx, startX, startY, hex) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const x0 = Math.max(0, Math.min(w - 1, Math.floor(startX)));
        const y0 = Math.max(0, Math.min(h - 1, Math.floor(startY)));
        const image = ctx.getImageData(0, 0, w, h);
        const d = image.data;
        const n = parseInt(hex.slice(1), 16);
        const fill = [n >> 16 & 255, n >> 8 & 255, n & 255, 255];
        const i0 = (y0 * w + x0) * 4;
        const target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
        const TOLERANCE = 32;
        if (target.every((v, k) => v === fill[k])) return;

        const matches = (i) =>
            Math.abs(d[i] - target[0]) <= TOLERANCE &&
            Math.abs(d[i + 1] - target[1]) <= TOLERANCE &&
            Math.abs(d[i + 2] - target[2]) <= TOLERANCE &&
            Math.abs(d[i + 3] - target[3]) <= TOLERANCE;
        const seen = new Uint8Array(w * h);
        const stack = [x0, y0];
        while (stack.length) {
            const y = stack.pop();
            let x = stack.pop();
            while (x >= 0 && !seen[y * w + x] && matches((y * w + x) * 4)) x--;
            x++;
            let up = false;
            let down = false;
            while (x < w && !seen[y * w + x] && matches((y * w + x) * 4)) {
                const p = y * w + x;
                seen[p] = 1;
                d[p * 4] = fill[0];
                d[p * 4 + 1] = fill[1];
                d[p * 4 + 2] = fill[2];
                d[p * 4 + 3] = 255;
                if (y > 0) {
                    const ok = !seen[p - w] && matches((p - w) * 4);
                    if (ok && !up) stack.push(x, y - 1);
                    up = ok;
                }
                if (y < h - 1) {
                    const ok = !seen[p + w] && matches((p + w) * 4);
                    if (ok && !down) stack.push(x, y + 1);
                    down = ok;
                }
                x++;
            }
        }
        ctx.putImageData(image, 0, 0);
    }

    function drawStroke(ctx, action) {
        const points = action.points;
        const width = (action.size || 5) * RENDER_SCALE;

        ctx.globalCompositeOperation = action.erase ? "destination-out" : "source-over";
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (points.length === 1) {
            ctx.arc(points[0].x, points[0].y, width / 2, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
    }

    // each layer is rendered on its own transparent canvas, then composited over white
    function redraw() {
        const layerContexts = {};
        for (const key of ["bg", "fg"]) {
            const lc = layerCanvases[key];
            if (lc.width !== canvas.width || lc.height !== canvas.height) {
                lc.width = canvas.width;
                lc.height = canvas.height;
            }
            layerContexts[key] = lc.getContext("2d", { willReadFrequently: true });
            layerContexts[key].clearRect(0, 0, lc.width, lc.height);
        }

        artWrapper.actions.forEach((action) => {
            const ctx = layerContexts[action.layer === "bg" ? "bg" : "fg"];
            if (action.type === "fill") floodFill(ctx, action.point.x, action.point.y, action.color);
            else drawStroke(ctx, action);
        });

        context.fillStyle = CANVAS_BG;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(layerCanvases.bg, 0, 0);
        context.drawImage(layerCanvases.fg, 0, 0);
    }

    function pointFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height),
        };
    }

    // pointer events = mouse + touch + stylus
    canvas.addEventListener("pointerdown", (e) => {
        if (tool === "dropper") {
            sampleColor(pointFromEvent(e));
            return;
        }
        if (tool === "fill") {
            artWrapper.addAction({ type: "fill", layer, color, point: pointFromEvent(e) });
            redraw();
            return;
        }
        canvas.setPointerCapture(e.pointerId);
        paint = true;
        const erase = tool === "eraser";
        const size = sizes[layer];
        currentAction = {
            layer,
            erase,
            color: erase ? CANVAS_BG : color,
            size: erase ? Math.max(size * 2, 16) : size,
            points: [],
        };
        artWrapper.addAction(currentAction);
        currentAction.points.push(pointFromEvent(e));
        redraw();
    });

    canvas.addEventListener("pointermove", (e) => {
        if (tool === "dropper") {
            const p = pointFromEvent(e);
            const px = context.getImageData(
                Math.max(0, Math.min(canvas.width - 1, Math.floor(p.x))),
                Math.max(0, Math.min(canvas.height - 1, Math.floor(p.y))), 1, 1).data;
            dropperStatus.textContent = "Under cursor: rgb(" + px[0] + ", " + px[1] + ", " + px[2] + ")";
            dropperStatus.style.borderBottom = "6px solid rgb(" + px[0] + "," + px[1] + "," + px[2] + ")";
            return;
        }
        if (!paint) return;
        currentAction.points.push(pointFromEvent(e));
        redraw();
    });

    const stopPainting = () => {
        paint = false;
        currentAction = undefined;
    };
    canvas.addEventListener("pointerup", stopPainting);
    canvas.addEventListener("pointercancel", stopPainting);

    // ---- buttons ----
    clearBtn.addEventListener("click", () => {
        artWrapper.clear();
        stopPainting();
        redraw();
    });

    backBtn.addEventListener("click", () => {
        artWrapper.back();
        redraw();
    });

    document.addEventListener("keydown", (e) => {
        const isUndoShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z";
        if ((e.key !== "Backspace" && !isUndoShortcut) || paint) return;
        const t = e.target;
        if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        e.preventDefault();
        backBtn.click();
    });

    let saving = false;
    // no save button anymore: Ctrl/Cmd+S exports the canvas
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            savePng();
        }
    });

    async function savePng() {
        if (saving) return;
        saving = true;
        saveStatus.textContent = "Saving…";

        try {
            const result = await ExportManager.saveCanvasAsPng(canvas);

            if (!result.saved) {
                saveStatus.textContent = "Cancelled";
            } else if (result.choseLocation) {
                saveStatus.textContent = "Saved!";
            } else {
                saveStatus.textContent = "Downloaded";
            }
        } catch (error) {
            console.error("Unable to save PNG", error);
            saveStatus.textContent = "Save failed";
        } finally {
            saving = false;
            setTimeout(() => (saveStatus.textContent = ""), 2500);
        }
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitCanvas, 100);
    });
    fitCanvas();
};

createCanvas();
