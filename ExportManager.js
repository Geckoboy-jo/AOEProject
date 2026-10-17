class ExportManager {
    static async saveCanvasAsPng(canvas, filename = "drawing.png") {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError("canvas must be an HTMLCanvasElement");
        }

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((image) => {
                if (image) {
                    resolve(image);
                } else {
                    reject(new Error("Unable to create the PNG image"));
                }
            }, "image/png");
        });

        if ("showSaveFilePicker" in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: "PNG image",
                        accept: { "image/png": [".png"] }
                    }]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return { saved: true, choseLocation: true };
            } catch (error) {
                if (error.name === "AbortError") {
                    return { saved: false, choseLocation: true };
                }

                throw error;
            }
        }

        const url = URL.createObjectURL(blob);
        const download = document.createElement("a");
        download.href = url;
        download.download = filename;
        document.body.appendChild(download);
        download.click();
        download.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        return { saved: true, choseLocation: false };
    }
}