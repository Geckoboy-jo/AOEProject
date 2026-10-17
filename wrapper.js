class Wrapper
{
    constructor()
    {
        this.artStack = new Stack();
    }

    addCanvas(canvas)
    {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError("canvas must be an HTMLCanvasElement");
        }

        this.artStack.push(canvas);
        return canvas;
    }

    back()
    {
        return this.artStack.pop();
    }

    get currentCanvas()
    {
        return this.artStack.top;
    }
}