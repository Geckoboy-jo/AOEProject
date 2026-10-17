console.log("starting the app!");

const artWrapper = new Wrapper();

const closePopup = () => {
    document.querySelector("#onstart-popup").style.display = "none";
    document.querySelector("#outer-popup").style.display = "none";
};

const openPopup = () => {
    document.querySelector("#onstart-popup").style.display = "block";
    document.querySelector("#outer-popup").style.display = "block";
};

const CANVAS_BG = "#ffffff";

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
    const saveBtn = document.getElementById("save");
    const saveStatus = document.getElementById("save-status");
    const backBtn = document.getElementById("back");
    const brushBtn = document.getElementById("tool-brush");
    const eraserBtn = document.getElementById("tool-eraser");
    const dropperBtn = document.getElementById("dropper");
    const dropperStatus = document.getElementById("dropper-status");
    let paint = false;
    let color = "#000000";
    let size = 6;
    let tool = "brush";
    let currentAction;

    canvas.setAttribute("id", "canvas");
    canvasDiv.appendChild(canvas);
    const context = canvas.getContext("2d");

    // size the canvas to fill its frame (and re-fit when the window changes)
    function fitCanvas() {
        const { width, height } = canvasDiv.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(width));
        canvas.height = Math.max(1, Math.floor(height));
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
            setTool("brush"); // picking a color switches back to the brush
        }
    );

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
        [[brushBtn, "brush"], [eraserBtn, "eraser"], [dropperBtn, "dropper"]].forEach(([btn, name]) => {
            btn.classList.toggle("active", tool === name);
            btn.setAttribute("aria-pressed", tool === name);
        });
        if (tool === "dropper") dropperStatus.textContent = "Click the canvas to sample a color.";
        else if (dropperStatus.textContent.startsWith("Click")) dropperStatus.textContent = "";
    }
    brushBtn.addEventListener("click", () => setTool("brush"));
    eraserBtn.addEventListener("click", () => setTool("eraser"));
    // dropper toggles: click again to go back to the brush
    dropperBtn.addEventListener("click", () => setTool(tool === "dropper" ? "brush" : "dropper"));

    // dropper: read the pixel under the pointer and load it into the color wheel
    function sampleColor(point) {
        const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
        const pixel = context.getImageData(x, y, 1, 1).data;
        colorWheel.setRgbColor(pixel[0], pixel[1], pixel[2]); // also switches back to the brush
        dropperStatus.textContent = "Color sampled.";
        setTimeout(() => {
            if (dropperStatus.textContent === "Color sampled.") dropperStatus.textContent = "";
        }, 2000);
    }

    document.querySelectorAll("#brush-sizes button").forEach((btn) => {
        btn.addEventListener("click", () => {
            size = Number(btn.dataset.size);
            document.querySelectorAll("#brush-sizes button").forEach((b) => b.classList.toggle("active", b === btn));
        });
    });

    document.getElementById("settings-btn").addEventListener("click", openPopup);

    // ---- drawing ----
    function redraw() {
        context.fillStyle = CANVAS_BG;
        context.fillRect(0, 0, canvas.width, canvas.height);

        artWrapper.actions.forEach((action) => {
            const points = action.points;
            const width = action.size || 5;

            context.strokeStyle = action.color;
            context.fillStyle = action.color;
            context.lineJoin = "round";
            context.lineCap = "round";
            context.lineWidth = width;
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                context.lineTo(points[i].x, points[i].y);
            }

            if (points.length === 1) {
                context.arc(points[0].x, points[0].y, width / 2, 0, 2 * Math.PI);
                context.fill();
            } else {
                context.stroke();
            }
        });
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
        canvas.setPointerCapture(e.pointerId);
        paint = true;
        currentAction = {
            color: tool === "eraser" ? CANVAS_BG : color,
            size: tool === "eraser" ? Math.max(size * 2, 16) : size,
            points: [],
        };
        artWrapper.addAction(currentAction);
        currentAction.points.push(pointFromEvent(e));
        redraw();
    });

    canvas.addEventListener("pointermove", (e) => {
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

    saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
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
            saveBtn.disabled = false;
            setTimeout(() => (saveStatus.textContent = ""), 2500);
        }
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitCanvas, 100);
    });
    fitCanvas();
};

createCanvas();
