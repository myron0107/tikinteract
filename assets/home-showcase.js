(() => {
    'use strict';
    const root = document.querySelector('[data-home-showcase]');
    if (!root) return;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const stage = root.querySelector('.home-showcase-stage');
    const toggle = root.querySelector('[data-showcase-toggle]');
    const name = root.querySelector('[data-showcase-name]');
    const status = root.querySelector('[data-showcase-state]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const games = [
        {name:'Neon Interact',files:['assets/neon-race2/cars/night-coupe-red.webp','assets/neon-race2/cars/night-coupe-blue.webp']}
    ];
    let clock = 0, last = 0, painted = 0;
    let visible = false, paused = false, frameId, scrollFrame;
    function load(game) {
        if (game.images) return;
        game.images = game.files.map(file => {
            const image = new Image();
            image.onload = () => draw();
            image.src = file;
            return image;
        });
    }
    function city() {
        const sky = ctx.createLinearGradient(0,0,0,400);
        sky.addColorStop(0,'#090911');sky.addColorStop(1,'#30131f');
        ctx.fillStyle=sky;ctx.fillRect(0,0,1200,720);
        for (let i=0;i<36;i++) {
            ctx.fillStyle=`rgba(240,236,255,${.12 + (i%4)*.08})`;
            ctx.beginPath();ctx.arc((i*193+41)%1200,35+(i*47)%210,i%3===0?1.5:1,0,Math.PI*2);ctx.fill();
        }
        const glow=ctx.createRadialGradient(950,210,4,950,210,220);
        glow.addColorStop(0,'#ff33442b');glow.addColorStop(1,'#ff334400');
        ctx.fillStyle=glow;ctx.fillRect(700,0,500,440);
        ctx.strokeStyle='#ff65734d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(974,171,47,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#ff65731a';ctx.beginPath();ctx.arc(974,171,60,0,Math.PI*2);ctx.stroke();
        for (let i=0;i<20;i++) {
            const x=i*90-(clock*15)%90-90, h=50+(i*43)%145;
            ctx.fillStyle=i%2?'#15121d':'#1b1520';ctx.fillRect(x,365-h,80,h);
            for (let col=0;col<4;col++) for(let row=0;row<Math.floor(h/23)-1;row++) {
                ctx.fillStyle=(row+col+i)%3?'#f1eaff10':'#ff4d5d42';
                ctx.fillRect(x+10+col*16,380-h+row*23,6,9);
            }
        }
        ctx.fillStyle='#09090d';ctx.fillRect(0,360,1200,32);
        ctx.fillStyle='#ff334470';ctx.fillRect(0,389,1200,2);
    }
    function road() {
        const fill=ctx.createLinearGradient(0,392,0,720);
        fill.addColorStop(0,'#25242d');fill.addColorStop(1,'#101015');
        ctx.fillStyle=fill;ctx.fillRect(0,392,1200,328);
        for(const y of [555]) {
            ctx.strokeStyle='#e8e5ef40';ctx.lineWidth=3;ctx.setLineDash([56,64]);
            ctx.lineDashOffset=clock*290;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle='#ffffff0b';ctx.fillRect(0,701,1200,2);
        for(let i=0;i<11;i++) {
            const x=i*150-(clock*120)%150;
            ctx.fillStyle='#ffffff1f';ctx.fillRect(x,348,3,41);
            ctx.fillStyle='#ff5b6b70';ctx.fillRect(x-8,344,20,3);
        }
    }
    function fallback(x,foot,width,color) {
        ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,foot-65,width,45,16);ctx.fill();
        ctx.fillStyle='#282832';ctx.beginPath();ctx.roundRect(x+width*.25,foot-95,width*.45,50,15);ctx.fill();
        ctx.fillStyle='#09090e';for(const wheel of [.2,.8]){ctx.beginPath();ctx.arc(x+width*wheel,foot-15,23,0,Math.PI*2);ctx.fill();}
    }
    function vehicle(image,index,x,foot,width) {
        const color=index?'#b8d4ff':'#ff3344';
        ctx.save();ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(x+width*.5,foot+2,width*.42,9,0,0,Math.PI*2);ctx.fill();
        if (!image?.complete || !image.naturalWidth) {fallback(x,foot,width,color);ctx.restore();return;}
        const height=width*image.naturalHeight/image.naturalWidth;
        const y=foot-height*.9+Math.sin(clock*14+index)*.7;
        ctx.drawImage(image,x,y,width,height);
        const centers=[[.2,.72,.059],[.79,.72,.059]];
        for(const [cx,cy,radius] of centers) {
            const r=radius*width;
            ctx.save();ctx.translate(x+cx*width,y+cy*height);
            ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();ctx.rotate(clock*18);
            ctx.drawImage(image,(cx*image.naturalWidth-r*image.naturalWidth/width),(cy*image.naturalHeight-r*image.naturalWidth/width),r*2*image.naturalWidth/width,r*2*image.naturalWidth/width,-r,-r,r*2,r*2);ctx.restore();
        }
        const beam=ctx.createLinearGradient(x+width*.9,0,x+width*1.5,0);
        beam.addColorStop(0,'#f1eeff25');beam.addColorStop(1,'#f1eeff00');
        ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(x+width*.9,foot-40);ctx.lineTo(x+width*1.5,foot-65);ctx.lineTo(x+width*1.5,foot-4);ctx.closePath();ctx.fill();
        ctx.restore();
    }
    function audience() {
        for(let i=0;i<5;i++) {
            const p=(clock*.21+i*.21)%1,x=1050-p*400,y=340-p*150;
            ctx.save();ctx.globalAlpha=Math.sin(p*Math.PI)*.5;ctx.translate(x,y);ctx.scale(1.2,1.2);
            ctx.fillStyle=i%2?'#f6f1f8':'#ff4455';ctx.beginPath();ctx.moveTo(0,5);ctx.bezierCurveTo(-20,-7,-8,-18,0,-9);ctx.bezierCurveTo(8,-18,20,-7,0,5);ctx.fill();ctx.restore();
        }
    }
    function draw() {
        ctx.setTransform(canvas.width/1200,0,0,canvas.height/720,0,0);
        city();road();audience();
        const images=games[0].images || [];
        vehicle(images[0],0,160+Math.sin(clock*.8)*70,515,420);
        vehicle(images[1],1,570+Math.sin(clock*.65+1)*75,667,430);
    }
    function running() {return visible && !document.hidden && !paused && !reduced.matches;}
    function tick(now) {
        frameId=undefined;
        if(!running())return;
        if(!last)last=now;
        if(now-painted>=1000/30) {
            clock+=Math.min((now-last)/1000,.1);last=now;painted=now;
            draw();
        }
        frameId=requestAnimationFrame(tick);
    }
    function synchronize() {
        if(running()) {if(frameId===undefined){last=0;frameId=requestAnimationFrame(tick);}}
        else {if(frameId!==undefined)cancelAnimationFrame(frameId);frameId=undefined;last=0;draw();}
        toggle.textContent=paused?'Reia':'Pauză';
        toggle.setAttribute('aria-pressed',String(paused));
        toggle.setAttribute('aria-label',paused?'Reia animația':'Pauză animație');
        status.textContent=reduced.matches?'PREVIZUALIZARE':running()?'ÎN MIȘCARE':'ÎN PAUZĂ';
    }
    function resize() {
        canvas.width=Math.max(360,Math.min(1600,Math.round(stage.clientWidth*Math.min(devicePixelRatio||1,2))));
        canvas.height=Math.round(canvas.width*.6);draw();
    }
    function visibility() {
        scrollFrame=undefined;
        const rect=canvas.getBoundingClientRect();
        const h=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));
        visible=rect.width>0 && rect.height>0 && h/rect.height>=.15;synchronize();
    }
    function queuedVisibility(){if(scrollFrame===undefined)scrollFrame=requestAnimationFrame(visibility);}
    toggle.addEventListener('click',()=>{paused=!paused;synchronize();});
    reduced.addEventListener('change',synchronize);
    document.addEventListener('visibilitychange',synchronize);
    window.addEventListener('scroll',queuedVisibility,{passive:true});
    window.addEventListener('resize',()=>{resize();queuedVisibility();},{passive:true});
    if('IntersectionObserver' in window)new IntersectionObserver(visibility,{threshold:[0,.15]}).observe(canvas);
    if('ResizeObserver' in window)new ResizeObserver(resize).observe(stage);
    document.fonts?.ready.then(draw);
    name.textContent=games[0].name;
    load(games[0]);resize();visibility();
})();
