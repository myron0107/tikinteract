// Convert generated assets without painting/recoloring pixels. Alpha bounds are
// measured per atlas cell so animations use the actual new sprite silhouettes.
import {readFile,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';

const dir='GAME/SKYSHIFT-INTERACT/art';
const browser=await openSkyShiftBrowser('skyshift-art-chrome');
try {
    await browser.page('Page.navigate',{url:process.env.SKYSHIFT_URL||'http://localhost:3001/'});
    await browser.waitFor("location.hostname==='localhost' && document.readyState==='complete'");
    const manifest=[];
    for(const name of ['atlas','alien','ship','city','clouds','space','depths']) {
        const source=name+'-'+(['alien','ship'].includes(name)?'v2':'v1')+'.png';
        const result=await browser.evaluate('('+ (async function(name,source){
            const image=new Image();image.src='/GAME/SKYSHIFT-INTERACT/art/source/'+source;await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
            const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
            let transparent=0;for(let p=3;p<data.length;p+=4)if(data[p]<=4)transparent++;
            if(['atlas','alien','ship'].includes(name)&&transparent<w*h*.2)throw new Error(name+' needs true alpha transparency: '+transparent/(w*h));
            function bounds(left,top,right,bottom){
                left=Math.floor(left*w);right=Math.ceil(right*w);top=Math.floor(top*h);bottom=Math.ceil(bottom*h);
                let minX=right,minY=bottom,maxX=left,maxY=top;
                for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*w+x)*4+3]>24){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
                if(maxX<=minX||maxY<=minY)throw new Error('Empty sprite in '+name);
                return{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
            }
            let metadata;
            if(name==='atlas'){
                const rows=[0,344/1254,649/1254,949/1254,1],cols=[0,.25,.505,.75,1];
                const names=['idle','rise','fall','land','grass','spring','ice','finish','magnet','cloud','rocket','vortex','tornado','portal','trophy','clouds'];
                metadata={width:w,height:h,sprites:Object.fromEntries(names.map((name,i)=>[name,bounds(cols[i%4],rows[Math.floor(i/4)],cols[i%4+1],rows[Math.floor(i/4)+1])]))};
            }
            if(name==='alien'){
                const cols=[0,560/1536,1065/1536,1],rows=[0,520/1024,1],names=['head','torso','fist','taunt','boot','grip'];
                metadata={width:w,height:h,parts:Object.fromEntries(names.map((name,i)=>[name,bounds(cols[i%3],rows[Math.floor(i/3)],cols[i%3+1],rows[Math.floor(i/3)+1])]))};
            }
            if(name==='ship')metadata=bounds(0,0,1,1);
            const optimized=document.createElement('canvas');optimized.width=['atlas','alien','ship'].includes(name)?w:720;optimized.height=Math.round(h/w*optimized.width);
            optimized.getContext('2d').drawImage(image,0,0,optimized.width,optimized.height);
            return{name,source,size:[w,h],transparentRatio:transparent/(w*h),metadata,data:optimized.toDataURL('image/webp',.92).split(',')[1]};
        }).toString()+')('+JSON.stringify(name)+','+JSON.stringify(source)+')');
        const {data,...metadata}=result;
        await writeFile(dir+'/'+name+'.webp',Buffer.from(data,'base64'));manifest.push(metadata);
        console.log(name,JSON.stringify({size:result.size,transparentRatio:result.transparentRatio}));
    }
    await writeFile(dir+'/metadata.json',JSON.stringify(manifest.find(item=>item.name==='atlas').metadata,null,2)+'\n');
    const alien=manifest.find(item=>item.name==='alien').metadata;
    await writeFile(dir+'/rig.json',JSON.stringify({...alien,ship:manifest.find(item=>item.name==='ship').metadata},null,2)+'\n');
    await writeFile(dir+'/generated-manifest.json',JSON.stringify(manifest,null,2)+'\n');
} finally {await browser.close();}
