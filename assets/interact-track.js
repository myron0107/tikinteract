// Both tracks derive equal lanes and matching tire insets from their road edges.
export function createTrackLayout(top,bottom) {
    const laneHeight=(bottom-top)/2;
    return Object.freeze({
        width:1200,height:900,top,bottom,laneHeight,divider:top+laneHeight,
        lanes:Object.freeze([0,1].map(index=>Object.freeze({
            top:top+index*laneHeight,bottom:top+(index+1)*laneHeight,
            foot:top+(index+1)*laneHeight-20
        })))
    });
}
export const TRACK_LAYOUT=createTrackLayout(392,888);

export function drawInteractRoad(ctx,clock) {
    const track=TRACK_LAYOUT;
    const fill=ctx.createLinearGradient(0,track.top,0,track.height);
    fill.addColorStop(0,'#25242d');fill.addColorStop(1,'#101015');
    ctx.fillStyle=fill;ctx.fillRect(0,track.top,track.width,track.height-track.top);
    for(const [index,lane] of track.lanes.entries()){
        ctx.fillStyle=index?'#0000000d':'#ffffff03';
        ctx.fillRect(0,lane.top,track.width,track.laneHeight);
    }
    ctx.strokeStyle='#e8e5ef40';ctx.lineWidth=3;ctx.setLineDash([56,64]);
    ctx.lineDashOffset=clock*290;ctx.beginPath();ctx.moveTo(0,track.divider);ctx.lineTo(track.width,track.divider);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#ffffff12';ctx.fillRect(0,track.bottom,track.width,2);
    for(const lane of track.lanes){ctx.fillStyle='#07070b28';ctx.fillRect(0,lane.foot+2,track.width,3);}
    for(let i=0;i<11;i++){
        const x=i*150-(clock*120)%150;
        ctx.fillStyle='#ffffff1f';ctx.fillRect(x,348,3,41);
        ctx.fillStyle='#ff5b6b70';ctx.fillRect(x-8,344,20,3);
    }
}
