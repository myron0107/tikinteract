// Canvas presentation using game artwork; no playable iframe or LIVE connection.
(()=>{
  const root=document.querySelector('[data-home-nova]');if(!root)return;
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),button=root.querySelector('[data-nova-pause]');if(!ctx)return;
  const base='GAME/NOVA-VEX/art/',reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let art,loading,visible=false,paused=false,clock=0,last=0,request=0,scene=-1,frames=0;
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const image=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=base+src;});
  const json=async name=>{const response=await fetch(base+name);if(!response.ok)throw Error(name);return response.json();};
  async function load(){
    if(loading)return loading;
    loading=Promise.all([image('district.webp'),image('atlas.webp'),image('rival.webp'),image('board.webp'),image('interactions.webp'),image('physical-gifts.webp'),json('metadata.json'),json('rig.json'),json('interactions-metadata.json'),json('physical-gifts-metadata.json'),image('reactions.webp'),json('reactions-metadata.json'),import('../GAME/NOVA-VEX/src/wins.js')]).then(([background,atlas,rival,board,pairs,props,meta,rig,interactions,gifts,reactions,reactionData,shows])=>{
      art={background,atlas,rival,board,pairs,props,reactions,meta:{...meta.sprites,...reactionData.sprites},rig,pair:interactions.sprites,gifts:gifts.sprites,showFrame:shows.showFrame,show:new shows.WinShow({shipBounds:rig.board,props:{board,rival},rivalPoses:rig.poses})};root.dataset.ready='true';draw();start();
    }).catch(()=>{root.dataset.ready='false';button.disabled=true;});return loading;
  }
  function sprite(im,s,x,feet,h,angle=0){ctx.save();ctx.translate(x,feet-h/2);ctx.rotate(angle);ctx.drawImage(im,s.x,s.y,s.w,s.h,-h*s.w/s.h/2,-h/2,h*s.w/s.h,h);ctx.restore();}
  function board(x,y,width=170){const s=art.rig.board;ctx.drawImage(art.board,s.x,s.y,s.w,s.h,x-width/2,y-width*s.h/s.w/2,width,width*s.h/s.w);}
  function pair(name,x,y){const s=art.pair[name],scale=140/(s.h*(s.vexFeet.v-s.vexHead));ctx.drawImage(art.pairs,s.x,s.y,s.w,s.h,x-s.vexFeet.u*s.w*scale,y-s.vexFeet.v*s.h*scale,s.w*scale,s.h*scale);}
  function draw(){
    if(!art)return;
    const cycle=clock%19,step=cycle<14?Math.floor(cycle/3.5):4,p=step===4?(cycle-14)/5:cycle%3.5/3.5,t=clock;
    if(scene!==step){scene=step;canvas.dataset.scene=String(step);}
    canvas.dataset.phase='';
    const width=600,height=720,im=art.background,scale=width/im.width,bgHeight=im.height*scale;
    const shift=(Math.sin(t*.14)*.5+.5)*(bgHeight-height);ctx.drawImage(im,0,-shift,width,bgHeight);
    ctx.fillStyle='#07132a33';ctx.fillRect(0,0,width,height);
    const travel=step===2?-p*270:step===1?p*400:p*120;
    for(let i=0;i<7;i++){const x=[110,360,220,480,120,380,250][i],y=((i*153+travel)%1000+1000)%1000-130;sprite(art.atlas,art.meta[i%3?'grass':'spring'],x,y,56);}
    let x=250,y=510-Math.sin(p*Math.PI*2)*22;
    if(step===0){y=510-Math.abs(Math.sin(p*Math.PI*2))*95;sprite(art.atlas,art.meta[p<.25||p>.75?'rise':'fall'],x,y,140,p<.5?-.05:.05);}
    if(step===1){
      y=510-p*90;const s=art.gifts.jetpack,w=64,h=w*s.h/s.w,px=x+15,py=y-74;
      ctx.drawImage(art.props,s.x,s.y,s.w,s.h,px-w/2,py-h/2,w,h);
      for(const u of [.255,.765]){const nx=px+(u-.5)*w,ny=py+(.945-.5)*h,len=40+Math.sin(t*35)*6;const g=ctx.createLinearGradient(0,ny,0,ny+len);g.addColorStop(0,'#fffbd0');g.addColorStop(.3,'#ffc45a');g.addColorStop(1,'#ff5c3600');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(nx-4,ny);ctx.quadraticCurveTo(nx-8,ny+len*.45,nx,ny+len);ctx.quadraticCurveTo(nx+8,ny+len*.45,nx+4,ny);ctx.fill();}
      sprite(art.atlas,art.meta.rise,x,y,140,Math.sin(t*4)*.04);
    }
    if(step===2){
      const vx=720-ease(p/.24)*385,feet=520+Math.sin(t*5)*3;
      board(p<.24?vx:292,feet+7,p<.24?155:225);
      if(p<.24){sprite(art.rival,art.rig.poses.idle,vx,feet,140);sprite(art.atlas,art.meta.idle,x,feet,140);}
      else pair(p<.48?'rideCatch':'rideHold',335,feet);
    }
    if(step===3){
      const vx=335+ease(p/.55)*460,feet=520-p*60;board(vx,feet+7,160);sprite(art.rival,art.rig.poses.idle,vx,feet,140);
      x=250-Math.sin(p*Math.PI)*58;y=520-Math.sin(p*Math.PI)*95;
      sprite(art.atlas,art.meta[p>.85?'idle':'fall'],x,y,140,-Math.sin(p*Math.PI)*.35);
    }
    if(step===4){
      // Reuse the game's choreography so the hand, hair and reaction stay aligned.
      const job={kind:'theft',clock:0,duration:5},sim={clock:p*5,settings:{effectsIntensity:.85}},hero={x:210,y:310},f=art.showFrame(job,sim.clock);
      canvas.dataset.phase=f.phase;
      ctx.save();ctx.translate(-96,0);ctx.scale(1.65,1.65);
      sprite(art.atlas,art.meta.grass,hero.x,hero.y+27,40);
      const source=art.meta[f.pose];
      sprite(source.sheet==='reaction'?art.reactions:art.atlas,source,hero.x+f.offsetX,hero.y+f.recoil,88*(1-f.squash),f.tilt);
      art.show.theft(ctx,sim,job,hero,hero,f);
      ctx.restore();
    }
    canvas.dataset.frame=String(++frames);
  }
  function tick(now){request=0;if(!visible||paused||document.hidden||reduced.matches)return;clock+=Math.min(.05,(now-(last||now))/1000);last=now;draw();request=requestAnimationFrame(tick);}
  function start(){if(art&&visible&&!paused&&!document.hidden&&!reduced.matches&&!request){last=0;request=requestAnimationFrame(tick);}}
  function stop(){cancelAnimationFrame(request);request=0;last=0;}
  button.onclick=()=>{paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Redă':'Pauză';button.setAttribute('aria-label',(paused?'Redă':'Pauză')+' animație NOVA & VEX');if(paused)stop();else start();};
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){load();start();}else stop();},{rootMargin:'120px'}).observe(root);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});reduced.addEventListener('change',()=>{if(reduced.matches)stop();else start();});
})();
