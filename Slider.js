class Slider {
    constructor(input, onChange) {
        this.input = input;
        this.onChange = onChange;
        this.input.addEventListener("input", () => this.onChange(this.value));
    }

    get value() {
        return Number(this.input.value);
    }

    set value(value) {
        this.input.value = value;
    }

    setGradient(gradient) {
        this.input.style.background = gradient;
    }
}

class ColorSliders {
    constructor(hueInput, saturationInput, brightnessInput) {
        this.hue = new Slider(hueInput, () => this.notifyChange());
        this.saturation = new Slider(saturationInput, () => this.notifyChange());
        this.brightness = new Slider(brightnessInput, () => this.notifyChange());
        this.onChange = undefined;
    }

    setValues(hue, saturation, brightness) {
        this.hue.value = hue;
        this.saturation.value = saturation;
        this.brightness.value = brightness;
    }

    setSaturationColor(color) {
        this.saturation.setGradient("linear-gradient(to right, #fff, " + color + ")");
    }

    notifyChange() {
        if (this.onChange) {
            this.onChange({
                hue: this.hue.value,
                saturation: this.saturation.value,
                brightness: this.brightness.value
            });
        }
    }
}