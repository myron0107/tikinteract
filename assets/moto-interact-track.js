import {createTrackLayout} from './interact-track.js?v=2';

// Street edge and divider follow the approved boulevard illustration.
export const MOTO_TRACK_LAYOUT=createTrackLayout(438,900);

// Alternate mirrored copies so the approved illustration loops without jumping.
function movingBand(ctx,image,sourceY,sourceHeight,y,height,offset,scale) {
    const width=image.naturalWidth*scale;
    const first=Math.floor(offset/width),start=-(offset-first*width);
    for(let index=0;start+index*width<1200;index++){
        const x=start+index*width,mirrored=(first+index)%2!==0;
        ctx.save();ctx.translate(mirrored?x+width:x,y);ctx.scale(mirrored?-1:1,1);
        ctx.drawImage(image,0,sourceY,image.naturalWidth,sourceHeight,0,0,width,height);
        ctx.restore();
    }
}

export function drawMotoBoulevard(ctx,image,clock) {
    const track=MOTO_TRACK_LAYOUT;
    ctx.fillStyle='#b6d9ee';ctx.fillRect(0,0,track.width,track.height);
    if(image.complete&&image.naturalWidth){
        // Crop only the side margins to fit 4:3 without distorting buildings.
        const sourceWidth=Math.min(image.naturalWidth,image.naturalHeight*track.width/track.height);
        const left=(image.naturalWidth-sourceWidth)/2,unit=image.naturalHeight/1024;
        const scale=track.width/sourceWidth,skylineHeight=track.top*414/500;
        // Distant city moves slowly; the nearby railing passes much faster.
        movingBand(ctx,image,0,414*unit,0,skylineHeight,left*scale+clock*38,scale);
        movingBand(ctx,image,414*unit,86*unit,skylineHeight,track.top-skylineHeight,left*scale+clock*220,scale);
        // Fit the image's asphalt to equal lanes while keeping its original texture.
        ctx.drawImage(image,left,500*unit,sourceWidth,224*unit,0,track.top,track.width,track.laneHeight);
        ctx.drawImage(image,left,724*unit,sourceWidth,300*unit,0,track.divider,track.width,track.laneHeight);
        // Replace just the baked dashed stripe with a moving stripe in the same style.
        ctx.drawImage(image,left,740*unit,sourceWidth,16*unit,0,track.divider-8,track.width,16);
    }else{
        ctx.fillStyle='#606c7b';ctx.fillRect(0,track.top,track.width,track.bottom-track.top);
    }
    ctx.save();ctx.strokeStyle='#ece8dfd9';ctx.lineWidth=7;
    ctx.setLineDash([84,48]);ctx.lineDashOffset=clock*290;
    ctx.beginPath();ctx.moveTo(0,track.divider);ctx.lineTo(track.width,track.divider);ctx.stroke();ctx.restore();
}
