let active = false;
let totalScore = 0;
let items = [];

function toggleConnection() {
    active = !active;
    const btn = document.getElementById('btn-connect');
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-txt');
    const overlay = document.getElementById('overlay-screen');

    if(active) {
        if (btn) {
            btn.innerText = "Oprește Conexiunea";
            btn.className = "w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer";
        }
        if (dot) dot.className = "w-3 h-3 rounded-full bg-green-500 animate-pulse";
        if (txt) {
            txt.innerText = "Conectat la TikTok Live (" + document.getElementById('tiktok-user').value + ")";
            txt.className = "text-xs font-bold text-green-400";
        }
        if (overlay) overlay.classList.add('hidden');
        runEngine();
    } else {
        if (btn) {
            btn.innerText = "Pornește Conexiunea Live";
            btn.className = "w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition glow-red cursor-pointer";
        }
        if (dot) dot.className = "w-3 h-3 rounded-full bg-zinc-600";
        if (txt) {
            txt.innerText = "Joc Inactiv";
            txt.className = "text-xs font-bold text-zinc-400";
        }
        if (overlay) overlay.classList.remove('hidden');
    }
}

function simulateEvent(name, pts) {
    if(!active) {
        alert("Pornește mai întâi conexiunea live din panou!");
        return;
    }
    totalScore += pts;
    const scoreDisp = document.getElementById('score-display');
    if (scoreDisp) scoreDisp.innerText = totalScore;

    const canvas = document.getElementById('hubCanvas');
    const w = canvas ? canvas.width : 800;
    const h = canvas ? canvas.height : 460;

    for(let i = 0; i < (pts / 10 || 3); i++) {
        items.push({
            x: Math.random() * w,
            y: h + 20,
            size: Math.random() * 15 + 8,
            speed: Math.random() * -4 - 1,
            color: name === 'DRAGON' ? '#ef4444' : '#f43f5e'
        });
    }
}

function runEngine() {
    const canvas = document.getElementById('hubCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    
    function loop() {
        if(!active || !ctx) return;
        ctx.fillStyle = '#050507';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#27272a';
        ctx.font = '12px monospace';
        ctx.fillText('TIKINTERACT HUB ENGINE // ACTIVE STREAM', 20, 30);

        for(let idx = items.length - 1; idx >= 0; idx--) {
            let it = items[idx];
            it.y += it.speed;
            ctx.fillStyle = it.color;
            ctx.beginPath();
            ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2);
            ctx.fill();

            if(it.y < -20) items.splice(idx, 1);
        }

        requestAnimationFrame(loop);
    }
    loop();
}