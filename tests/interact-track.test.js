import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACK_LAYOUT,drawInteractRoad} from '../assets/interact-track.js';
import {MOTO_TRACK_LAYOUT,drawMotoBoulevard} from '../assets/moto-interact-track.js';
import {createNightRenderer} from '../assets/neon-race2-renderer.js';
import {createMotoRenderer} from '../assets/moto-interact-renderer.js';

test('the road paints two equal adjacent lanes with the separator exactly halfway between the edges',()=>{
    const rectangles=[],paths=[];
    const ctx={
        createLinearGradient:()=>({addColorStop(){}}),setLineDash(){},beginPath(){},
        fillRect(x,y,width,height){rectangles.push({x,y,width,height});},
        moveTo(x,y){paths.push({x,y});},lineTo(x,y){paths.push({x,y});},stroke(){}
    };
    drawInteractRoad(ctx,1);
    const lanes=rectangles.filter(rect=>rect.x===0&&rect.width===1200&&rect.height>100&&rect.height<400);
    assert.equal(lanes.length,2);
    assert.equal(lanes[0].height,lanes[1].height);
    assert.equal(lanes[0].y+lanes[0].height,lanes[1].y);
    const roadBottom=lanes[1].y+lanes[1].height;
    const center=(lanes[0].y+roadBottom)/2;
    assert(paths.every(point=>point.y===center));
    assert.equal(lanes[0].y,TRACK_LAYOUT.top);
    assert.equal(roadBottom,TRACK_LAYOUT.bottom);
});

test('each game places both vehicles at matching offsets within its equal lanes',()=>{
    const originalImage=globalThis.Image;
    globalThis.Image=class {};
    try {
        const canvas={getContext:()=>({})},state={visualCarLeft:()=>8};
        for(const [createRenderer,layout] of [[createNightRenderer,TRACK_LAYOUT],[createMotoRenderer,MOTO_TRACK_LAYOUT]]){
            const renderer=createRenderer(canvas);
            const poses=[renderer.pose(state,0),renderer.pose(state,1)];
            const margins=poses.map((pose,index)=>layout.lanes[index].bottom-pose.foot);
            assert.equal(margins[0],margins[1]);
            assert(margins[0]>0);
            assert.equal(poses[1].foot-poses[0].foot,layout.laneHeight);
        }
    } finally {if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;}
});

test('approved Moto scenery preserves its skyline and maps the asphalt into equal lanes',()=>{
    const images=[],divider=[];
    const ctx={fillRect(){},save(){},restore(){},translate(){},scale(){},setLineDash(){},beginPath(){},stroke(){},
        drawImage(...args){images.push(args);},moveTo(x,y){divider.push(y);},lineTo(x,y){divider.push(y);}
    };
    const image={complete:true,naturalWidth:1536,naturalHeight:1024};
    drawMotoBoulevard(ctx,image,0);
    const bands=images.filter(args=>args[6]>=MOTO_TRACK_LAYOUT.top&&args[8]>100&&args[8]<400);
    assert.equal(bands.length,2);
    assert.equal(bands[0][8],bands[1][8]);
    assert.equal(bands[0][6]+bands[0][8],bands[1][6]);
    assert.equal(bands[1][6]+bands[1][8],MOTO_TRACK_LAYOUT.bottom);
    assert(divider.every(y=>y===MOTO_TRACK_LAYOUT.divider));
    assert.equal(images[0][8]+images[1][8],MOTO_TRACK_LAYOUT.top,'full skyline and railing are preserved above the road');
    assert.equal(images[0][3],image.naturalWidth);
});

test('Moto scenery loops left with faster nearby railing and no uncovered horizontal gaps',()=>{
    const image={complete:true,naturalWidth:1536,naturalHeight:1024};
    function frame(clock){
        const bands=[],stack=[];let x=0,y=0,scaleX=1;
        const ctx={fillRect(){},setLineDash(){},beginPath(){},stroke(){},moveTo(){},lineTo(){},
            save(){stack.push({x,y,scaleX});},restore(){({x,y,scaleX}=stack.pop());},
            translate(dx,dy){x+=dx;y+=dy;},scale(sx){scaleX*=sx;},
            drawImage(image,sx,sy,sw,sh,dx,dy,width,height){
                if(sy===0||sy===414)bands.push({sy,left:scaleX<0?x-width:x,right:scaleX<0?x:x+width,mirrored:scaleX<0});
            }
        };
        drawMotoBoulevard(ctx,image,clock);return bands;
    }
    const start=frame(0),next=frame(1);
    assert(Math.abs(start[0].left-next[0].left-38)<.000001);
    assert(Math.abs(start[1].left-next[1].left-220)<.000001);
    for(const clock of [0,1,5,7,20,60,120]){
        const bands=frame(clock);
        for(const sy of [0,414]){
            const tiles=bands.filter(band=>band.sy===sy);
            assert(tiles[0].left<=0);assert(tiles.at(-1).right>=1200);
            for(let index=1;index<tiles.length;index++){
                assert(Math.abs(tiles[index].left-tiles[index-1].right)<.000001);
                assert.notEqual(tiles[index].mirrored,tiles[index-1].mirrored);
            }
        }
    }
});
