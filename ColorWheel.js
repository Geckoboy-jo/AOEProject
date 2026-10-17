class ColorWheel {
    constructor(wheel, sliders, preview, onChange) {
        this.wheel = wheel;
        this.context = wheel.getContext("2d");
        this.sliders = sliders;
        this.preview = preview;
        this.onChange = onChange;
        this.hue = sliders.hue.value;
        this.saturation = sliders.saturation.value;
        this.brightness = sliders.brightness.value;

        this.drawWheel();
        this.sliders.onChange = (color) => {
            this.hue = color.hue;
            this.saturation = color.saturation;
            this.brightness = color.brightness;
            this.update();
        };
        this.bindEvents();
        this.update();
    }

    bindEvents() {
        this.wheel.addEventListener("pointerdown", (event) => {
            const bounds = this.wheel.getBoundingClientRect();
            const scaleX = this.wheel.width / bounds.width;
            const scaleY = this.wheel.height / bounds.height;
            const x = (event.clientX - bounds.left) * scaleX;
            const y = (event.clientY - bounds.top) * scaleY;
            const centerX = this.wheel.width / 2;
            const centerY = this.wheel.height / 2;
            const radius = Math.min(centerX, centerY) - 2;
            const distance = Math.hypot(x - centerX, y - centerY);

            if (distance > radius) {
                return;
            }

            this.hue = (Math.atan2(y - centerY, x - centerX) * 180 / Math.PI + 360) % 360;
            this.saturation = Math.min(100, distance / radius * 100);
            this.update();
        });
    }

    drawWheel() {
        const image = this.context.createImageData(this.wheel.width, this.wheel.height);
        const centerX = this.wheel.width / 2;
        const centerY = this.wheel.height / 2;
        const radius = Math.min(centerX, centerY) - 2;

        for (let y = 0; y < this.wheel.height; y++) {
            for (let x = 0; x < this.wheel.width; x++) {
                const distance = Math.hypot(x - centerX, y - centerY);

                if (distance > radius) {
                    continue;
                }

                const hue = (Math.atan2(y - centerY, x - centerX) * 180 / Math.PI + 360) % 360;
                const saturation = distance / radius * 100;
                const rgb = ColorWheel.hsvToRgb(hue, saturation, 100);
                const index = (y * this.wheel.width + x) * 4;
                image.data[index] = rgb.red;
                image.data[index + 1] = rgb.green;
                image.data[index + 2] = rgb.blue;
                image.data[index + 3] = 255;
            }
        }

        this.context.putImageData(image, 0, 0);
    }

    update() {
        const rgb = ColorWheel.hsvToRgb(this.hue, this.saturation, this.brightness);
        this.sliders.setValues(this.hue, this.saturation, this.brightness);
        this.sliders.setSaturationColor(
            ColorWheel.rgbToHex(ColorWheel.hsvToRgb(this.hue, 100, 100))
        );
        this.drawSelection();
        this.preview.style.backgroundColor = this.value;
        this.preview.style.color = (rgb.red * 0.299 + rgb.green * 0.587 + rgb.blue * 0.114) > 160
            ? "#000"
            : "#fff";
        this.preview.textContent = this.value;
        this.onChange(this.value);
    }

    drawSelection() {
        const centerX = this.wheel.width / 2;
        const centerY = this.wheel.height / 2;
        const radius = Math.min(centerX, centerY) - 2;
        const angle = this.hue * Math.PI / 180;
        const distance = radius * this.saturation / 100;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        this.drawWheel();
        this.context.beginPath();
        this.context.arc(x, y, 7, 0, 2 * Math.PI);
        this.context.lineWidth = 3;
        this.context.strokeStyle = "#000";
        this.context.stroke();
        this.context.beginPath();
        this.context.arc(x, y, 5, 0, 2 * Math.PI);
        this.context.strokeStyle = "#fff";
        this.context.stroke();
    }

    get value() {
        return ColorWheel.rgbToHex(
            ColorWheel.hsvToRgb(this.hue, this.saturation, this.brightness)
        );
    }

    static rgbToHex(rgb) {
        return "#" + [rgb.red, rgb.green, rgb.blue]
            .map((channel) => channel.toString(16).padStart(2, "0"))
            .join("");
    }

    static hsvToRgb(hue, saturation, brightness) {
        const chroma = brightness / 100 * (saturation / 100);
        const hueSection = hue / 60;
        const secondary = chroma * (1 - Math.abs(hueSection % 2 - 1));
        const match = brightness / 100 - chroma;
        let red = 0;
        let green = 0;
        let blue = 0;

        if (hueSection < 1) {
            red = chroma;
            green = secondary;
        } else if (hueSection < 2) {
            red = secondary;
            green = chroma;
        } else if (hueSection < 3) {
            green = chroma;
            blue = secondary;
        } else if (hueSection < 4) {
            green = secondary;
            blue = chroma;
        } else if (hueSection < 5) {
            red = secondary;
            blue = chroma;
        } else {
            red = chroma;
            blue = secondary;
        }

        return {
            red: Math.round((red + match) * 255),
            green: Math.round((green + match) * 255),
            blue: Math.round((blue + match) * 255)
        };
    }
}