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
  reset: {sprite:'reboot',name:'Reboot',en:'Reboot',color:'#8fbeff',description:'Un panou holografic repornește traseul.'},
  winAdd: {sprite:'crown',name:'Coroană bonus',en:'Bonus Crown',color:'#ffe780',description:'Primești o coroană holografică în clasamentul rundei.'},
  winRemove: {sprite:'vex',name:'Atacul lui Vex',en:'Vex Attack',color:'#ff9fe4',description:'Vex vine pe placă, te trage scurt de păr, îți dă drumul și pleacă. Pierzi o coroană.'}
});

export const NEON_LABELS = {
  win:{ro:'coroană',en:'crown'},wins:{ro:'coroane',en:'crowns'},
  test:{ro:'Cadouri NEON',en:'Neon Gifts'},
  earth:{ro:'Neon District',en:'Neon District'},grass:{ro:'Rooftop Run',en:'Rooftop Run'},
  clouds:{ro:'Skyline',en:'Skyline'},space:{ro:'Sky Circuit',en:'Sky Circuit'},cosmos:{ro:'Neon Heights',en:'Neon Heights'},
  lava:{ro:'Undergrid',en:'Undergrid'},crystal:{ro:'Power Core',en:'Power Core'},abyss:{ro:'Deep Grid',en:'Deep Grid'}
};
