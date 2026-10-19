// Authored anticipation -> physical contact -> travel -> release.
// Shared by physics and presentation so an object acts BEFORE the height changes.
export const GIFT_TIMING = Object.freeze({
  balloon: {contact:.42,exit:.35,duration:2.15},
  anvil: {contact:1.05,exit:.55,duration:3.4},
  magnet: {contact:.72,exit:.4,duration:3.0},
  cloud: {contact:.6,exit:.4,duration:3.2},
  rocket: {contact:.72,exit:.45,duration:3.3},
  wind: {contact:1.15,exit:.55,duration:3.6},
  vortex: {contact:2.0,exit:.65,duration:5.75},
  meteor: {contact:1.9,exit:.6,duration:4.8}
});
export const VEX_NEGATIVE_ACTIONS=Object.freeze(['anvil','wind','vortex','meteor']);
export const isVexNegative=kind=>VEX_NEGATIVE_ACTIONS.includes(kind);
export const VEX_BOARD_RELEASE=.68;
export const VEX_TOUCHDOWN=1;
const clamp=n=>Math.max(0,Math.min(1,n));
export const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
// Vex first carries Nova almost to the destination. The last stretch belongs
// to her accelerating fall after he throws her off the board.
export function giftTravelProgress(kind,p){
  p=clamp(p);
  if(kind==='vortex')return p<VEX_BOARD_RELEASE ? .88*ease(p/VEX_BOARD_RELEASE) : .88+.12*((p-VEX_BOARD_RELEASE)/(1-VEX_BOARD_RELEASE))**2;
  if(kind==='meteor')return ease(p)**1.5;
  return ease(p);
}
export function giftFrame(active){
  if(!active)return null;
  const spec=GIFT_TIMING[active.kind],time=active.elapsed;
  const contact=active.travelAt??spec.contact,end=active.travelEnd??active.duration-spec.exit;
  return {time,contact,end,enter:ease(time/contact),
    progress:clamp((time-contact)/Math.max(.1,end-contact)),
    exit:ease((time-end)/Math.max(.1,active.duration-end)),
    moving:time>=contact&&time<end,stage:time<contact?'arrive':time<end?'travel':'release'};
}
