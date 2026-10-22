import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneViewport} from '../GAME/NOVA-VEX/src/viewport.js';
import {WIDTH} from '../GAME/NOVA-VEX/src/config.js';
import {Renderer} from '../GAME/NOVA-VEX/src/render.js';

test('portrait preserves the original course framing on desktop and mobile', () => {
    for (const [width,height] of [[540,960],[390,693],[360,640]]) {
        const view = sceneViewport(width,height);
        assert.equal(view.viewWidth,WIDTH);
        assert.equal(view.offsetX,0);
        assert(Math.abs(view.pixelsPerUnit * WIDTH - width) < 1e-6);
    }
});
test('horizontal framing retains jump visibility and scales sprites equally on both axes', () => {
    for (const [width,height] of [[960,540],[1920,1080],[640,360],[844,390]]) {
        const view = sceneViewport(width,height);
        // Ordinary ledges are about 120 units apart and Nova is 88 units tall.
        assert(view.height / 120 >= 5, 'At least five ordinary ledge gaps fit vertically');
        assert(88 / view.height < .15, 'Nova does not occupy a third of the screen');
        assert(Math.abs(view.viewWidth * view.pixelsPerUnit - width) < 1e-6);
        assert(Math.abs(view.height * view.pixelsPerUnit - height) < 1e-6);
        assert(Math.abs((WIDTH / 2 + view.offsetX) * view.pixelsPerUnit - width / 2) < 1e-6);
    }
});

test('horizontal course edges never reveal a second full Nova from portrait wrapping', () => {
    for (const x of [0,20,240,460,479]) {
        const calls = [], clips = [];
        const renderer = {
            offsetX:sceneViewport(960,540).offsetX, height:640,
            ctx:{save(){},beginPath(){},rect(...args){clips.push(args);},clip(){},restore(){}},
            character(sim,px,py){calls.push([px,py]);}
        };
        Renderer.prototype.playerSprites.call(renderer,{},x,300);
        assert.deepEqual(calls,[[x,300]],'A single Nova is drawn at either course edge');
        assert.deepEqual(clips,[[0,0,480,640]],'Her sprite stays inside the course');
        renderer.offsetX=0; calls.length=0;
        Renderer.prototype.playerSprites.call(renderer,{},x,300);
        assert.equal(calls.length,x<40||x>440?2:1,'Portrait retains its original wrap transition');
    }
});
