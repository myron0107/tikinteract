// Matches the existing browser configuration. Build once instead of compiling
// utilities and watching every DOM change on visitors' computers.
module.exports = {
    content: ['./*.html', './game.js', './assets/**/*.js', './GAME/*/index.html'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                darkbg: '#080809', cardbg: '#121212', accent: '#ff2636',
                red: {400:'#ff8892',500:'#ff3344',600:'#e02030',700:'#b91b29',800:'#821923',950:'#300c11'},
                zinc: {100:'#f5f5f7',200:'#e4e4e7',300:'#d4d4d8',400:'#aaaab2',500:'#85858e',800:'#2b2b30',900:'#1b1b1e',950:'#0b0b0d'}
            }
        }
    }
};
