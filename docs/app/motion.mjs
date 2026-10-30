// Canvas + Web Animations only; no video, GIF, external dependency or network request.
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=document.createElement('canvas');canvas.className='motion-canvas';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
const ctx=canvas.getContext('2d');let w=0,h=0,last=0,raf=0,phase=0;
function resize(){w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);paint(0)}
function paint(ms){ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff8f3';ctx.fillRect(0,0,w,h);
 const t=reduce.matches?0:ms/1000;
 const shapes=[[-.04,.2,.34,'#ffbe9a'],[.98,.72,.36,'#ffbed0'],[.75,-.08,.32,'#ffe3a0']];
 for(let i=0;i<shapes.length;i++){const [x,y,r,color]=shapes[i],radius=Math.min(w,h)*r,cx=w*x+Math.sin(t*.18+i)*22,cy=h*y+Math.cos(t*.14+i)*24;
 const g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.6);g.addColorStop(0,color+'99');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,radius*1.6,0,Math.PI*2);ctx.fill();}
 ctx.save();ctx.strokeStyle='#e5ad971f';ctx.lineWidth=1;
 for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(w*.9,h*.83,110+j*21,170+j*23,-.5+Math.sin(t*.12)*.08,0,Math.PI*2);ctx.stroke()}
 ctx.restore();
}
function frame(ms){if(ms-last>40){paint(ms+phase);last=ms}if(!reduce.matches&&!document.hidden)raf=requestAnimationFrame(frame)}
function restart(){cancelAnimationFrame(raf);if(!document.hidden)raf=requestAnimationFrame(frame)}
addEventListener('resize',resize);document.addEventListener('visibilitychange',restart);reduce.addEventListener('change',restart);resize();restart();
// Rendering replaces DOM nodes even when the user stays on the same screen.
// Identify navigation by its stable screen key, never by node identity.
let current=null;
function animateScreen(){const screen=document.querySelector('.setup-inner')||document.querySelector('.content');if(!screen)return;const key=screen.dataset.motionScreen;if(!key||key===current)return;current=key;
 if(reduce.matches)return;
 phase+=650;
 const targets=screen.matches('.setup-inner')?[...screen.querySelectorAll('.brand-kicker,.brand-orbit,.logo-title,.intro-caption,.setup-choice,.setup-steps,.setup-body h1,.setup-body>label,.setup-body>.time-field,.participation-choice')]:[...screen.children];
 targets.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(18px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:580,delay:Math.min(i*65,390),easing:'cubic-bezier(.18,.8,.25,1)',fill:'backwards'}));
}
new MutationObserver(animateScreen).observe(document.querySelector('#app'),{childList:true,subtree:true});animateScreen();
// A short opening ident, without delaying input after it disappears.
if(!reduce.matches){const splash=document.createElement('div');splash.className='motion-splash';splash.setAttribute('aria-hidden','true');splash.innerHTML='<div class="brand-orbit"></div><strong>サークルづくり</strong><small>BESTIA WORKS APPS</small>';document.body.append(splash);splash.animate([{opacity:1},{opacity:1,offset:.68},{opacity:0,transform:'translateY(-12px)'}],{duration:1250,easing:'ease-out'}).finished.then(()=>splash.remove())}
