class Stack {
    constructor() {
        this.canvases = [];
        this.top = undefined;
    }

    push(canvas) {
        this.canvases.push(canvas);
        this.top = canvas;
    }

    pop() {
        this.canvases.pop();
        this.top = this.canvases[this.canvases.length - 1];
    }
}
