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
        const backBtn = document.getElementById('back');
        const blackBtn = document.querySelector('div[data-color="black"]');
        const greenBtn = document.querySelector('div[data-color="green"]');
        const blueBtn = document.querySelector('div[data-color="blue"]');
        const purpleBtn = document.querySelector('div[data-color="purple"]');
        const redBtn = document.querySelector('div[data-color="red"]');
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

                // changes the color state of the canvas based on box clicked in welcome modal
                function selectColor(newColor) {
                  switch(newColor) {
                    case 'green':
                      color = "#baff33";
                      closePopup();
                      break;
                    case 'red':
                      color = "#ff2b2b";
                      closePopup();
                      break;
                    case 'purple':
                      color = "#b700ff";
                      closePopup();
                      break;
                    case 'blue':
                      color = "#006eff";
                      closePopup();
                      break;
                    case 'black':
                    default:
                      color = "#000000";
                      closePopup();
                      break;
                  }
                }

                // add click listener for all color options in welcome modal
                blackBtn.addEventListener('click', (event) => selectColor(event.target.dataset.color));
                blueBtn.addEventListener('click', (event) => selectColor(event.target.dataset.color));
                greenBtn.addEventListener('click', (event) => selectColor(event.target.dataset.color));
                purpleBtn.addEventListener('click', (event) => selectColor(event.target.dataset.color));
                redBtn.addEventListener('click', (event) => selectColor(event.target.dataset.color));

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
                      
                saveBtn.addEventListener('click',()=>{
                      var dataURL = canvas.toDataURL('image/jpeg', 1.0);
                      let savedImg = document.getElementById('savedImg');
                      savedImg.setAttribute('src',dataURL);                   
                });


                  canvas.addEventListener('mousedown',function(e){
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
            
                 canvas.addEventListener('mouseup',function(e){
                     paint = false;
                     currentAction = undefined;
                 });


}

createCanvas();