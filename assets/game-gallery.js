(() => {
    'use strict';
    const gallery=document.querySelector('.game-gallery'),dialog=document.getElementById('game-gallery-dialog');
    if(!gallery||!dialog)return;
    const buttons=[...gallery.querySelectorAll('[data-gallery-image]')];if(!buttons.length)return;
    const featured=gallery.querySelector('[data-gallery-featured]'),expand=gallery.querySelector('[data-gallery-open]');
    const current=gallery.querySelector('[data-gallery-current]'),position=gallery.querySelector('[data-gallery-position]');
    const image=dialog.querySelector('[data-gallery-full]'),title=dialog.querySelector('[data-gallery-title]'),counter=dialog.querySelector('[data-gallery-counter]');
    const inlineVideo=gallery.querySelector('[data-gallery-video]'),fullVideo=dialog.querySelector('[data-gallery-full-video]');
    const videos=[inlineVideo,fullVideo].filter(Boolean),original=dialog.querySelector('[data-gallery-original]'),status=gallery.querySelector('[data-gallery-status]');
    let index=0,opener,previousOverflow;
    const pauseVideos=()=>videos.forEach(video=>video.pause());
    function setVideo(video,selected,active){
        if(!video)return;video.pause();video.hidden=!selected.dataset.galleryClip;if(video.hidden)return;
        video.poster=selected.dataset.galleryImage;video.setAttribute('aria-label',selected.dataset.galleryLabel);
        if(video.getAttribute('src')!==selected.dataset.galleryClip){video.src=selected.dataset.galleryClip;video.load();}
        if(active&&!document.hidden)video.play().catch(()=>{/* Native playback controls remain usable. */});
    }
    function show(next,userInitiated=false){
        index=(next+buttons.length)%buttons.length;const selected=buttons[index],clip=Boolean(selected.dataset.galleryClip&&inlineVideo&&fullVideo);
        gallery.dataset.mediaShape=selected.dataset.galleryShape||'portrait';
        pauseVideos();if(status){status.hidden=true;status.textContent='';}
        image.src=selected.dataset.galleryImage;image.alt=selected.querySelector('img').alt;image.hidden=clip;
        title.textContent=selected.dataset.galleryLabel;counter.textContent=(index+1)+' / '+buttons.length;
        if(featured){featured.src=selected.dataset.galleryImage;featured.alt=image.alt;}
        if(expand){expand.hidden=clip;expand.setAttribute('aria-label','Mărește '+selected.dataset.galleryLabel);}
        if(current)current.textContent=selected.dataset.galleryMode;if(position)position.textContent=counter.textContent;
        if(original)original.href=selected.dataset.galleryClip||selected.dataset.galleryImage;
        setVideo(inlineVideo,selected,userInitiated&&!dialog.open);setVideo(fullVideo,selected,userInitiated&&dialog.open);
        buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    }
    function closeGallery(){pauseVideos();dialog.close();}
    function open(){
        if(typeof dialog.showModal!=='function'){window.location.href=buttons[index].dataset.galleryImage;return;}
        opener=expand;previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';pauseVideos();dialog.showModal();
    }
    function select(next){show(next,true);buttons[index].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
    buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));expand?.addEventListener('click',open);
    gallery.querySelector('.game-gallery-grid')?.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();select(index+(event.key==='ArrowLeft'?-1:1));buttons[index].focus({preventScroll:true});
    });
    show(0);
    dialog.querySelector('[data-gallery-close]').addEventListener('click',closeGallery);
    dialog.querySelector('[data-gallery-previous]').addEventListener('click',()=>select(index-1));
    dialog.querySelector('[data-gallery-next]').addEventListener('click',()=>select(index+1));
    dialog.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();closeGallery();return;}
        if(event.target.tagName==='VIDEO')return;
        if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();select(index+(event.key==='ArrowLeft'?-1:1));}
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog)closeGallery();});
    dialog.addEventListener('close',()=>{fullVideo?.pause();document.documentElement.style.overflow=previousOverflow;opener?.focus({preventScroll:true});});
    let pointerStart;
    image.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
    image.addEventListener('pointerup',event=>{
        if(!pointerStart)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;
        if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)select(index+(dx<0?1:-1));pointerStart=undefined;
    });
    image.addEventListener('pointercancel',()=>{pointerStart=undefined;});
    videos.forEach(video=>video.addEventListener('error',()=>{
        if(status){status.textContent='Clipul nu s-a încărcat. Poți vedea imaginile din galerie.';status.hidden=false;}
    }));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseVideos();});
    window.addEventListener('pagehide',pauseVideos);
})();
