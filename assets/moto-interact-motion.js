// Degrees of front-wheel lift. Only active nitro lifts the bike; ordinary gifts do not.
export function wheelieTarget(speed,nitroSeconds) {
    return nitroSeconds>0?Math.max(0,Math.min(1,(speed-150)/50))*26:0;
}
export function approachWheelie(current,target,dt) {
    const seconds=Math.max(0,Math.min(.25,dt));
    return current+(target-current)*(1-Math.exp(-seconds/(target>current?.22:.28)));
}
// Rotation is anchored to the rear tire's contact with the asphalt, not the sprite center.
export function wheeliePoint(x,y,angle,pivotX,pivotY) {
    const radians=-angle*Math.PI/180,dx=x-pivotX,dy=y-pivotY;
    return {x:pivotX+dx*Math.cos(radians)-dy*Math.sin(radians),y:pivotY+dx*Math.sin(radians)+dy*Math.cos(radians)};
}
