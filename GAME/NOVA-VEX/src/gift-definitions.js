// Stable action IDs preserve quantity/replay handling; these are NEON ASCENT's
// own powers, artwork and presentation, independent of TikTok's gift catalog.
export const NEON_GIFTS = Object.freeze({
  balloon: {sprite:'springPad',name:'Trambulină',en:'Spring Pad',color:'#78f0dd',description:'Trambulina se comprimă sub picioare și te aruncă în sus.'},
  anvil: {sprite:'banana',name:'Farsa lui Vex',en:'Vex Banana Prank',color:'#ffe477',description:'Vex aruncă o banană sub picioarele Novei; ea alunecă și pierde înălțime.'},
  magnet: {sprite:'grapple',name:'Cârlig de salvare',en:'Grappling Hook',color:'#6feaff',description:'Cârligul se agață deasupra ta; cablul se întinde și te trage în sus.'},
  cloud: {sprite:'jetpack',name:'Jetpack',en:'Jetpack',color:'#ffbd72',description:'Rucsacul se prinde pe spate, aprinde două motoare și te ridică.'},
  rocket: {sprite:'gate',name:'Portal',en:'Portal Jump',color:'#c39aff',description:'Intri într-un portal, dispari și ieși prin al doilea, mai sus.'},
  wind: {sprite:'glove',name:'Boxul lui Vex',en:'Vex Spring Punch',color:'#ff7d8e',description:'Vex își întinde mănușa cu arc spre Nova și o împinge de pe traseu.'},
  vortex: {sprite:'vexCarry',name:'Cursa lui Vex',en:'Vex Board Ride',color:'#bca9f4',description:'Vex o ia pe Nova pe placa lui, o duce în jos și o aruncă spre platformă.'},
  meteor: {sprite:'vexShove',name:'Împingerea lui Vex',en:'Vex Push',color:'#ed95ff',description:'Vex vine lângă Nova și o împinge în gol; ea cade până pe platforma de jos.'},
  reset: {sprite:'reboot',name:'Repornire',en:'Reboot',color:'#8fbeff',description:'Un panou holografic repornește traseul.'},
  winAdd: {sprite:'crown',name:'Coroană bonus',en:'Bonus Crown',color:'#ffe780',description:'Primești o coroană holografică în clasamentul rundei.'},
  winRemove: {sprite:'vex',name:'Atacul lui Vex',en:'Vex Attack',color:'#ff9fe4',description:'Vex vine pe placă, te trage scurt de păr, îți dă drumul și pleacă. Pierzi o coroană.'}
});

export const NEON_LABELS = {
  win:{ro:'coroană',en:'crown'},wins:{ro:'coroane',en:'crowns'},
  test:{ro:'Cadouri NEON',en:'Neon Gifts'},
  earth:{ro:'Cartier neon',en:'Neon District'},grass:{ro:'Acoperișuri',en:'Rooftop Run'},
  clouds:{ro:'Panoramă',en:'Skyline'},space:{ro:'Circuit aerian',en:'Sky Circuit'},cosmos:{ro:'Înălțimi neon',en:'Neon Heights'},
  lava:{ro:'Subteran',en:'Undergrid'},crystal:{ro:'Nucleu energetic',en:'Power Core'},abyss:{ro:'Rețea adâncă',en:'Deep Grid'}
};
export const GIFT_DESCRIPTIONS_EN={
 balloon:'The spring pad compresses under your feet and launches you upward.',
 anvil:'Vex throws a banana under Nova’s feet. She slips and loses height.',
 magnet:'The hook attaches above you. Its cable tightens and pulls you upward.',
 cloud:'The jetpack attaches to your back, ignites its two engines and lifts you.',
 rocket:'Enter one portal, disappear and emerge from a second portal higher up.',
 wind:'Vex extends his spring glove toward Nova and pushes her off the course.',
 vortex:'Vex grabs Nova onto his board, takes her downward and throws her toward a platform.',
 meteor:'Vex arrives beside Nova and pushes her into freefall. She lands on a lower platform.',
 reset:'A holographic panel restarts the course.',
 winAdd:'You receive a holographic crown on the round leaderboard.',
 winRemove:'Vex arrives on his board, briefly pulls your hair, releases you and leaves. You lose one crown.'
};
