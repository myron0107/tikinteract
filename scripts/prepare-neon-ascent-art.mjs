// Convert generated assets without painting/recoloring pixels. Alpha bounds are
// measured per atlas cell so animations use the actual new sprite silhouettes.
import {readFile,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const dir='GAME/NOVA-VEX/art';
const browser=await openSkyShiftBrowser('neon-ascent-art-chrome');
try {
    await browser.page('Page.navigate',{url:process.env.SKYSHIFT_URL||'http://localhost:3001/'});
    await browser.waitFor("location.hostname==='localhost' && document.readyState==='complete'");
    let previous=[];
    try{previous=JSON.parse(await readFile(dir+'/generated-manifest.json','utf8'));}catch{}
    const requested=process.argv.slice(2);
    const manifest=[...previous];
    for(const name of requested.length?requested:['atlas','rival','board','district','skyline','undergrid','rooftops','sky-circuit','neon-heights','power-core','deep-grid','actions','blast-neon']) {
        const source=name+'-v1.png';
        const result=await browser.evaluate('('+ (async function(name,source){
            const image=new Image();image.src='/GAME/NOVA-VEX/art/source/'+source;await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
            const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
            let transparent=0;for(let p=3;p<data.length;p+=4)if(data[p]<=4)transparent++;
            if(['atlas','rival','board','actions','physical-gifts','reactions','vex-actions','interactions','blast-neon'].includes(name)&&transparent<w*h*.2)throw new Error(name+' needs true alpha transparency: '+transparent/(w*h));
            function bounds(left,top,right,bottom){
                left=Math.floor(left*w);right=Math.ceil(right*w);top=Math.floor(top*h);bottom=Math.ceil(bottom*h);
                let minX=right,minY=bottom,maxX=left,maxY=top;
                for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*w+x)*4+3]>24){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
                if(maxX<=minX||maxY<=minY)throw new Error('Empty sprite in '+name);
                return{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
            }
            let metadata;
            if(name==='atlas'){
                const cols=[0,.26,.51,.764,1];
                const cells=[
                    ['idle',0,0,.31],['rise',1,0,.31],['fall',2,0,.31],['land',3,0,.31],
                    ['grass',0,.31,.51],['spring',1,.31,.55],['ice',2,.31,.539],['finish',3,.30,.55],
                    ['magnet',0,.51,.757],['cloud',1,.55,.757],['rocket',2,.539,.76],['vortex',3,.55,.774],
                    ['tornado',0,.757,1],['portal',1,.757,1],['trophy',2,.76,1],['clouds',3,.774,1]
                ];
                metadata={width:w,height:h,sprites:Object.fromEntries(cells.map(([name,col,top,bottom])=>[name,bounds(cols[col],top,cols[col+1],bottom)]))};
            }
            if(name==='rival')metadata={width:w,height:h,poses:Object.fromEntries(['idle','shove','grab'].map((pose,i)=>[pose,bounds(i/3,0,(i+1)/3,1)]))};
            if(name==='reactions')metadata={width:w,height:h,sprites:Object.fromEntries(['reactStart','reactPull','reactRecover'].map((pose,i)=>[pose,{...bounds(i/3,0,(i+1)/3,1),sheet:'reaction'}]))};
            if(name==='vex-actions'){
                const hands=[{u:.15,v:.55},{u:.89,v:.385},{u:.22,v:.51},{u:.5,v:.6}];
                metadata={width:w,height:h,poses:Object.fromEntries(['vexThrow','vexPush','vexPull','vexDive'].map((pose,i)=>[pose,{...bounds(i/4,0,(i+1)/4,1),sheet:'vexAction',mirror:pose==='vexPush',hand:hands[i]}]))};
            }
            if(name==='interactions'){
                const marks=[{vex:[471,540],nova:[286,540],head:214},{vex:[1052,540],nova:[848,540],head:218},{vex:[484,1100],nova:[274,1100],head:766},{vex:[1020,1102],nova:[843,1102],head:775}];
                metadata={width:w,height:h,sprites:Object.fromEntries(['pushTouch','pushExtend','rideCatch','rideHold'].map((pose,i)=>{
                    const b=bounds(i%2/2,Math.floor(i/2)/2,(i%2+1)/2,(Math.floor(i/2)+1)/2),m=marks[i];
                    const point=([x,y])=>({u:(x/1254*w-b.x)/b.w,v:(y/1254*h-b.y)/b.h});
                    return[pose,{...b,sheet:'interaction',vexFeet:point(m.vex),novaFeet:point(m.nova),vexHead:(m.head/1254*h-b.y)/b.h}];
                }))};
            }
            if(name==='board')metadata=bounds(0,0,1,1);
            if(name==='actions'||name==='physical-gifts'){
                const names=name==='physical-gifts'?['springPad','banana','grapple','jetpack','gate','glove','weight','press','reboot','crown','vex','checkpoint']:['energy','glitch','drone','boardGift','laser','blackout','gravity','emp','reboot','crown','vex','checkpoint'];
                metadata={width:w,height:h,sprites:Object.fromEntries(names.map((key,i)=>[key,bounds(i%4/4,Math.floor(i/4)/3,(i%4+1)/4,(Math.floor(i/4)+1)/3)]))};
            }
            const optimized=document.createElement('canvas');optimized.width=['atlas','rival','board','actions','physical-gifts','reactions','vex-actions','interactions'].includes(name)?w:name==='blast-neon'?640:720;optimized.height=Math.round(h/w*optimized.width);
            optimized.getContext('2d').drawImage(image,0,0,optimized.width,optimized.height);
            return{name,source,size:[w,h],transparentRatio:transparent/(w*h),metadata,data:optimized.toDataURL('image/webp',.92).split(',')[1]};
        }).toString()+')('+JSON.stringify(name)+','+JSON.stringify(source)+')');
        const {data,...metadata}=result;
        await writeFile(dir+'/'+name+'.webp',Buffer.from(data,'base64'));
        const existing=manifest.findIndex(entry=>entry.name===name);if(existing>=0)manifest[existing]=metadata;else manifest.push(metadata);
        console.log(name,JSON.stringify({size:result.size,transparentRatio:result.transparentRatio}));
    }
    await writeFile(dir+'/metadata.json',JSON.stringify(manifest.find(item=>item.name==='atlas').metadata,null,2)+'\n');
    const rival=manifest.find(item=>item.name==='rival').metadata;
    const idle=rival.poses.idle;
    const portrait={x:idle.x+Math.round(idle.w*.145),y:idle.y,w:Math.round(idle.w*.8),h:Math.round(idle.h*.4)};
    await writeFile(dir+'/rig.json',JSON.stringify({...rival,portrait,board:manifest.find(item=>item.name==='board').metadata},null,2)+'\n');
    if(manifest.some(item=>item.name==='actions'))await writeFile(dir+'/actions-metadata.json',JSON.stringify(manifest.find(item=>item.name==='actions').metadata,null,2)+'\n');
    if(manifest.some(item=>item.name==='physical-gifts'))await writeFile(dir+'/physical-gifts-metadata.json',JSON.stringify(manifest.find(item=>item.name==='physical-gifts').metadata,null,2)+'\n');
    if(manifest.some(item=>item.name==='reactions'))await writeFile(dir+'/reactions-metadata.json',JSON.stringify(manifest.find(item=>item.name==='reactions').metadata,null,2)+'\n');
    if(manifest.some(item=>item.name==='vex-actions'))await writeFile(dir+'/vex-actions-metadata.json',JSON.stringify(manifest.find(item=>item.name==='vex-actions').metadata,null,2)+'\n');
    if(manifest.some(item=>item.name==='interactions'))await writeFile(dir+'/interactions-metadata.json',JSON.stringify(manifest.find(item=>item.name==='interactions').metadata,null,2)+'\n');
    await writeFile(dir+'/generated-manifest.json',JSON.stringify(manifest,null,2)+'\n');
} finally {await browser.close();}
