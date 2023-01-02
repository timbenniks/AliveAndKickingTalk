<!-- 
https://codepen.io/timbenniks/pen/YzjWjZQ?editors=0010

const canvas = document.getElementById("canvas");
const c = canvas.getContext("2d");
const tx = window.innerWidth;
const ty = window.innerHeight;
const grav = 0.99;

canvas.width = tx;
canvas.height = ty;

const img = new Image();
img.src = 'https://res.cloudinary.com/dwfcofnrd/image/upload/w_40,q_auto/icon_smqavh.png';

function Ball() {
  this.color = "rgba(0, 0, 0, 100)"
  this.radius = 25;
  this.x = Math.random() * (tx - this.radius * 2) + this.radius;
  this.y = Math.random() * (ty - this.radius);
  this.dy = Math.random() * 2;
  this.dx = Math.round((Math.random() - 0.5) * 10);
  this.vel = Math.random() / 5;
  
  this.update = () => {
    c.beginPath();
    c.drawImage(img, this.x, this.y);
    c.fill();
  };
}

var bal = [];

function animate() {    
  requestAnimationFrame(animate);
  
  c.clearRect(0, 0, tx, ty);
  
  for (let i = 0; i < bal.length; i++) {
    bal[i].update();
    bal[i].y += bal[i].dy;
    bal[i].x += bal[i].dx;
    
    if (bal[i].y + bal[i].radius >= ty) {
      bal[i].dy = -bal[i].dy * grav;
    } 
    else {
      bal[i].dy += bal[i].vel;
    }    
    
    if(bal[i].x + bal[i].radius > tx || bal[i].x - bal[i].radius < 0) {
        bal[i].dx = -bal[i].dx;
    }
  }
}

animate();

setInterval(function() {
  bal.push(new Ball());
}, 2000);

setInterval(function() {
  bal.splice(0, 1);
}, 5000); -->
