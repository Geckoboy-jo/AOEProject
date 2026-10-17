console.log("starting the app!");

const artWrapper = new Wrapper();

const closePopup = () => {
    var popup = document.querySelector("#onstart-popup");
    var outer = document.querySelector("#outer-popup");
    popup.style.display = "none";
    outer.style.display = "none";
}

//creating a canvas
const createCanvas = () =>{
        const canvasDiv = document.querySelector("#canvasDiv");
        const canvas = document.createElement('canvas');
        const clearBtn=document.getElementById('clear');
        const saveBtn = document.getElementById('save');
        const saveStatus = document.getElementById('save-status');
        const backBtn = document.getElementById('back');
        const dropperBtn = document.getElementById('dropper');
        const dropperStatus = document.getElementById('dropper-status');
        let canvasHeight = window.innerHeight-100;
        let canvasWidth  = window.innerWidth-100;
        var paint;
        var color = '#000000';
        var currentAction;

        clearBtn.addEventListener('click', function(e){
                artWrapper.clear();
                paint=false;
                currentAction = undefined;
                redraw();
        });

        canvas.setAttribute('id','canvas');
        canvas.setAttribute('width',canvasWidth);
        canvas.setAttribute('height',canvasHeight);
        canvas.setAttribute('class','border');
        canvas.setAttribute('background-color','#cb3594');
        canvasDiv.appendChild(canvas);

        if(typeof G_vmlCanvasManager != 'undefined') {
                canvas = G_vmlCanvasManager.initElement(canvas);
        }
        const context = canvas.getContext("2d");
        context.fillStyle="#fff";
        context.fillRect(0,0,context.canvas.width, context.canvas.height);

                const colorSliders = new ColorSliders(
                  document.getElementById('hue'),
                  document.getElementById('saturation'),
                  document.getElementById('brightness')
                );

                const colorWheel = new ColorWheel(
                  document.getElementById('color-wheel'),
                  colorSliders,
                  document.getElementById('selected-color'),
                  (selectedColor) => {
                    color = selectedColor;
                  }
                );

                function addPoint(x, y)
                {
                  currentAction.points.push({ x, y });
                }

                function redraw(){
                        context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas
                        context.fillStyle="#fff";
                        context.fillRect(0,0,context.canvas.width, context.canvas.height);
                                              
                        artWrapper.actions.forEach((action) => {
                          const points = action.points;

                          context.strokeStyle = action.color;
                          context.fillStyle = action.color;
                          context.lineJoin = "round";
                          context.lineCap = "round";
                          context.lineWidth = 5;
                          context.beginPath();
                          context.moveTo(points[0].x, points[0].y);

                          for (let i = 1; i < points.length; i++) {
                            context.lineTo(points[i].x, points[i].y);
                          }

                          if (points.length === 1) {
                            context.arc(points[0].x, points[0].y, 2.5, 0, 2 * Math.PI);
                            context.fill();
                          } else {
                            context.stroke();
                          }
                        });
                      }

                backBtn.addEventListener('click', () => {
                  artWrapper.back();
                  redraw();
                });
                      
                saveBtn.addEventListener('click', async () => {
                      saveBtn.disabled = true;
                      saveStatus.textContent = "Opening save dialog...";

                      try {
                        const result = await ExportManager.saveCanvasAsPng(canvas);

                        if (!result.saved) {
                          saveStatus.textContent = "Save cancelled.";
                        } else if (result.choseLocation) {
                          saveStatus.textContent = "PNG saved.";
                        } else {
                          saveStatus.textContent = "PNG download started. Configure your browser to choose its download folder.";
                        }
                      } catch (error) {
                        console.error("Unable to save PNG", error);
                        saveStatus.textContent = "Unable to save PNG. Check browser permissions and try again.";
                      } finally {
                        saveBtn.disabled = false;
                      }
                });


                  dropperBtn.addEventListener('click', () => {
                    const active = dropperBtn.getAttribute('aria-pressed') !== 'true';
                    dropperBtn.setAttribute('aria-pressed', active);
                    dropperStatus.textContent = active
                      ? 'Click the canvas to sample a color.'
                      : '';
                  });

                  canvas.addEventListener('mousedown',function(e){
                    if (dropperBtn.getAttribute('aria-pressed') === 'true') {
                      const bounds = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / bounds.width;
                      const scaleY = canvas.height / bounds.height;
                      const x = Math.max(0, Math.min(
                        canvas.width - 1,
                        Math.floor((e.clientX - bounds.left) * scaleX)
                      ));
                      const y = Math.max(0, Math.min(
                        canvas.height - 1,
                        Math.floor((e.clientY - bounds.top) * scaleY)
                      ));
                      const pixel = context.getImageData(x, y, 1, 1).data;

                      colorWheel.setRgbColor(pixel[0], pixel[1], pixel[2]);
                      paint = false;
                      currentAction = undefined;
                      dropperBtn.setAttribute('aria-pressed', 'false');
                      dropperStatus.textContent = 'Color sampled.';
                      return;
                    }

                    paint = true;
                    currentAction = { color, points: [] };
                    artWrapper.addAction(currentAction);
                    addPoint(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
                    redraw();
                  });
    
                  canvas.addEventListener('mousemove',function(e){
                    if(paint){
                      addPoint(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
                      redraw();
                    }
                  });
            
                 window.addEventListener('mouseup',function(e){
                     paint = false;
                     currentAction = undefined;
                 });


}

createCanvas();