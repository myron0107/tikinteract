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
    loading=Promise.all([image('district.webp'),image('atlas.webp'),image('rival.webp'),image('board.webp'),image('interactions.webp'),image('physical-gifts.webp'),json('metadata.json'),json('rig.json'),json('interactions-metadata.json'),json('physical-gifts-metadata.json'),image('reactions.webp'),json('reactions-metadata.json'),import('../GAME/NOVA-VEX/src/wins.js'),image('vex-actions.webp'),json('vex-actions-metadata.json'),import('../GAME/NOVA-VEX/src/vex-negatives.js'),import('../GAME/NOVA-VEX/src/gift-motion.js')]).then(([background,atlas,rival,board,pairs,props,meta,rig,interactions,gifts,reactions,reactionData,shows,vexActions,vexData,negatives,motion])=>{
      art={background,atlas,rival,board,pairs,props,reactions,meta:{...meta.sprites,...reactionData.sprites},rig,pair:interactions.sprites,gifts:gifts.sprites,showFrame:shows.showFrame,motion};
      const adapter={shipBounds:rig.board,props:{board,rival,vexActions},rivalPoses:{...rig.poses,...vexData.poses},sprites:{...art.meta,...art.pair},sprite(name,x,y,w,h,rotation=0,alpha=1,context=ctx){const s=this.sprites[name];if(!s)return;context.save();context.translate(x,y);context.rotate(rotation);context.globalAlpha*=alpha;context.drawImage(s.sheet==='interaction'?pairs:s.sheet==='reaction'?reactions:atlas,s.x,s.y,s.w,s.h,-w/2,-h/2,w,h);context.restore();}};
      art.show=adapter.winShow=new shows.WinShow(adapter);art.negative=new negatives.VexNegatives(adapter);root.dataset.ready='true';draw();start();
    }).catch(()=>{root.dataset.ready='false';button.disabled=true;});return loading;
  }
  function sprite(im,s,x,feet,h,angle=0){ctx.save();ctx.translate(x,feet-h/2);ctx.rotate(angle);ctx.drawImage(im,s.x,s.y,s.w,s.h,-h*s.w/s.h/2,-h/2,h*s.w/s.h,h);ctx.restore();}
  function board(x,y,width=170){const s=art.rig.board;ctx.drawImage(art.board,s.x,s.y,s.w,s.h,x-width/2,y-width*s.h/s.w/2,width,width*s.h/s.w);}
  function pair(name,x,y){const s=art.pair[name],scale=140/(s.h*(s.vexFeet.v-s.vexHead));ctx.drawImage(art.pairs,s.x,s.y,s.w,s.h,x-s.vexFeet.u*s.w*scale,y-s.vexFeet.v*s.h*scale,s.w*scale,s.h*scale);}
  function draw(){
    if(!art)return;
    const cycle=clock%22.25,bounds=[0,3.5,6.7,11.5,17.25,22.25],step=bounds.findIndex((v,i)=>i<5&&cycle>=v&&cycle<bounds[i+1]),p=(cycle-bounds[step])/(bounds[step+1]-bounds[step]),t=clock;
    if(scene!==step){scene=step;canvas.dataset.scene=String(step);}
    canvas.dataset.phase='';
    const width=540,height=960,im=art.background,scale=width/im.width,bgHeight=im.height*scale;
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
    if(step===2||step===3){
      const kind=step===2?'meteor':'vortex',spec=art.motion.GIFT_TIMING[kind],active={kind,elapsed:p*spec.duration,duration:spec.duration,startX:220,startY:1000};
      const f=art.motion.giftFrame(active),drop=art.motion.giftTravelProgress(kind,f.progress)*(step===2?150:300),sim={active,clock:t,player:{x:220,y:1000-drop},settings:{effectsIntensity:.85}},hero={x:220,y:330},reaction=art.negative.hero(sim);
      canvas.dataset.phase=art.negative.frame(sim,hero.x,hero.y).phase;
      ctx.save();ctx.translate(-50,0);ctx.scale(1.5,1.5);art.negative.behind(ctx,sim,hero.x,hero.y);
      ctx.save();ctx.globalAlpha*=reaction.alpha;ctx.translate(hero.x+reaction.x,hero.y+reaction.y);ctx.scale(reaction.flip||1,1);const source=art.meta[reaction.pose]||art.meta.idle;sprite(source.sheet==='reaction'?art.reactions:art.atlas,source,0,0,90*reaction.sy,reaction.rotation);ctx.restore();
      art.negative.front(ctx,sim,hero.x,hero.y);ctx.restore();
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
    const meter=root.querySelector('[data-demo-meter]');if(meter)meter.textContent=new Intl.NumberFormat(window.TikInteractLanguage?.locale()||'ro-RO').format(Math.round([240+p*70,310+p*150,460-art.motion.giftTravelProgress('meteor',art.motion.giftFrame({kind:'meteor',duration:4.8,elapsed:p*4.8}).progress)*150,310-art.motion.giftTravelProgress('vortex',art.motion.giftFrame({kind:'vortex',duration:5.75,elapsed:p*5.75}).progress)*300,10][step]));
    const receipt=root.querySelector('[data-demo-receipt]');if(receipt){const en=window.TikInteractLanguage?.get()==='en';receipt.hidden=step===0;receipt.querySelector('strong').textContent=[null,'Jetpack +150 m',en?'Vex’s push −150 m':'Împingerea lui Vex −150 m',en?'Vex’s ride −300 m':'Cursa lui Vex −300 m',en?'Vex’s heist −1 crown':'Jaful lui Vex −1 coroană'][step]||'';}
  }
  function tick(now){request=0;if(!visible||paused||document.hidden||reduced.matches)return;clock+=Math.min(.05,(now-(last||now))/1000);last=now;draw();request=requestAnimationFrame(tick);}
  function start(){if(art&&visible&&!paused&&!document.hidden&&!reduced.matches&&!request){last=0;request=requestAnimationFrame(tick);}}
  function stop(){cancelAnimationFrame(request);request=0;last=0;}
  function pauseCopy(){const en=window.TikInteractLanguage?.get()==='en';button.innerHTML='<i class="fa-solid fa-'+(paused?'play':'pause')+'" aria-hidden="true"></i>';button.setAttribute('aria-label',(paused?(en?'Play':'Redă'):(en?'Pause':'Pauză'))+' NOVA & VEX');}
  button.onclick=()=>{paused=!paused;button.setAttribute('aria-pressed',String(paused));pauseCopy();if(paused)stop();else start();};window.addEventListener('tikinteract:language',()=>{pauseCopy();draw();});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){load();start();}else stop();},{rootMargin:'120px'}).observe(root.querySelector('.home-nova-demo')||root);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});reduced.addEventListener('change',()=>{if(reduced.matches)stop();else start();});
})();
