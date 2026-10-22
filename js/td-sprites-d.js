/**
 * Obrana království - Kreslící knihovna (Část D: střely, efekty, zóny, spojenci, fénix)
 * Od Gemini; zabaleno do vlastního rozsahu s vlastními pomocnými funkcemi, aby nepřepsalo
 * TDS.getCache / TDS.drawPath z částí B a C.
 */
(function () {
const TDS = window.TDS || (window.TDS = {});
const OUTLINE = TDS.OUTLINE || '#111';
// Každý tvar je samostatná cesta (jinak by se výplně slévaly) + jemný stín vpravo dole
function drawPath(ctx, pathFunc, fillStyle, strokeStyle = OUTLINE, lineWidth = 2) {
    ctx.save();
    ctx.translate(2, 2);
    ctx.beginPath(); pathFunc(ctx);
    if (fillStyle) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); }
    ctx.restore();
    ctx.save();
    ctx.beginPath(); pathFunc(ctx);
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle && lineWidth > 0) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
}
const cacheD = new Map();
TDS.clearCacheD = () => cacheD.clear();
function getCacheD(id, size, drawFunc) {
    let cvs = cacheD.get(id);
    if (!cvs) {
        cvs = document.createElement('canvas'); cvs.width = size; cvs.height = size;
        const ctx = cvs.getContext('2d'); ctx.translate(size / 2, size / 2); drawFunc(ctx);
        cacheD.set(id, cvs);
    }
    return cvs;
}
if (!TDS.seed) {   // pro jistotu, kdyby se část D načetla samostatně
    let mw = 123456789, mz = 987654321;
    TDS.seed = i => { mw = (123456789 + i) >>> 0; mz = (987654321 - i) >>> 0; };
    TDS.rand = () => { mz = (36969 * (mz & 65535) + (mz >>> 16)) >>> 0; mw = (18000 * (mw & 65535) + (mw >>> 16)) >>> 0; return (((mz << 16) + (mw & 65535)) >>> 0) / 4294967296; };
}
if (!TDS.roundRect) TDS.roundRect = function (ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

TDS.projectileDrawers = {
    arrow: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-8, -1); c.lineTo(4, -1); c.lineTo(4, 1); c.lineTo(-8, 1); c.closePath(); }, '#795548', null, 0); // Tělo
        drawPath(ctx, c => { c.moveTo(4, -3); c.lineTo(10, 0); c.lineTo(4, 3); c.closePath(); }, '#9e9e9e', TDS.OUTLINE, 1.5); // Hrot
        drawPath(ctx, c => { c.moveTo(-8, -3); c.lineTo(-4, 0); c.lineTo(-8, 3); c.lineTo(-10, 0); c.closePath(); }, '#f5f5f5', TDS.OUTLINE, 1.5); // Letky
    },
    arrowCrit: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-10, -3); c.lineTo(12, 0); c.lineTo(-10, 3); c.closePath(); }, '#ffeb3b', '#ff9800', 2);
    },
    ballista: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-12, -2); c.lineTo(8, -2); c.lineTo(8, 2); c.lineTo(-12, 2); c.closePath(); }, '#5d4037', TDS.OUTLINE, 1.5);
        drawPath(ctx, c => { c.moveTo(8, -4); c.lineTo(16, 0); c.lineTo(8, 4); c.closePath(); }, '#e0e0e0', TDS.OUTLINE, 2);
    },
    spike: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-6, -4); c.lineTo(8, 0); c.lineTo(-6, 4); c.closePath(); }, '#9e9e9e', TDS.OUTLINE, 1.5);
    },
    blade: (ctx) => {
        drawPath(ctx, c => {
            c.beginPath();
            for(let i=0; i<8; i++) {
                let a = (i * Math.PI) / 4;
                c.lineTo(Math.cos(a)*10, Math.sin(a)*10);
                c.lineTo(Math.cos(a+0.2)*6, Math.sin(a+0.2)*6);
            }
            c.closePath();
        }, '#e0e0e0', TDS.OUTLINE, 2);
        ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fillStyle = '#424242'; ctx.fill();
    },
    flame: (ctx) => {
        drawPath(ctx, c => { c.moveTo(8, 0); c.quadraticCurveTo(-6, 8, -8, 0); c.quadraticCurveTo(-6, -8, 8, 0); }, '#ff5722', '#ff9800', 1.5);
    },
    iceball: (ctx) => {
        drawPath(ctx, c => { c.arc(0, 0, 6, 0, Math.PI*2); }, '#81d4fa', TDS.OUTLINE, 1.5);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI*2); ctx.fill();
    },
    icicle: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-8, -4); c.lineTo(10, 0); c.lineTo(-8, 4); c.closePath(); }, '#4fc3f7', TDS.OUTLINE, 1.5);
    },
    shard: (ctx) => {
        drawPath(ctx, c => { c.moveTo(6, 0); c.lineTo(0, 5); c.lineTo(-6, 2); c.lineTo(-4, -4); c.lineTo(2, -6); c.closePath(); }, '#00e5ff', TDS.OUTLINE, 1.5);
    },
    barrel: (ctx) => {
        drawPath(ctx, c => { TDS.roundRect(c, -8, -6, 16, 12, 3); }, '#8d6e63', TDS.OUTLINE, 2);
        drawPath(ctx, c => { c.moveTo(-6, -6); c.lineTo(-6, 6); c.moveTo(6, -6); c.lineTo(6, 6); }, null, '#bdbdbd', 2); // obruče
        ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill(); // doutnák
    },
    harpoonBolt: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-14, -2); c.lineTo(10, -2); c.lineTo(10, 2); c.lineTo(-14, 2); c.closePath(); }, '#424242', TDS.OUTLINE, 1.5);
        drawPath(ctx, c => { c.moveTo(10, -5); c.lineTo(18, 0); c.lineTo(10, 5); c.lineTo(10, 2); c.lineTo(6, 2); c.lineTo(6, -2); c.lineTo(10, -2); c.closePath(); }, '#9e9e9e', TDS.OUTLINE, 1.5);
    },
    cannon: (ctx) => {
        drawPath(ctx, c => { c.arc(0, 0, 7, 0, Math.PI*2); }, '#212121', TDS.OUTLINE, 2);
    },
    dart: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-6, -1); c.lineTo(4, -1); c.lineTo(4, 1); c.lineTo(-6, 1); c.closePath(); }, '#a1887f', null, 0);
        drawPath(ctx, c => { c.moveTo(4, -2); c.lineTo(8, 0); c.lineTo(4, 2); c.closePath(); }, '#e0e0e0', TDS.OUTLINE, 1);
    },
    dartSmall: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-4, 0); c.lineTo(4, 0); }, null, '#e0e0e0', 2);
    },
    bolt: (ctx) => {
        drawPath(ctx, c => { c.moveTo(10, 0); c.lineTo(-6, 5); c.lineTo(-2, 0); c.lineTo(-6, -5); c.closePath(); }, '#ab47bc', '#e1bee7', 1.5);
    },
    boltTrue: (ctx) => {
        drawPath(ctx, c => { c.moveTo(12, 0); c.lineTo(-8, 6); c.lineTo(-3, 0); c.lineTo(-8, -6); c.closePath(); }, '#fff', '#ea80fc', 2);
    },
    phoenixFire: (ctx) => {
        drawPath(ctx, c => { c.arc(0,0,10,0,Math.PI*2); }, '#ff3d00', '#ffea00', 2);
    },
    fireball: (ctx) => {
        drawPath(ctx, c => { c.arc(4,0,6,0,Math.PI*2); c.moveTo(4, -6); c.lineTo(-10, 0); c.lineTo(4, 6); c.closePath(); }, '#ff9800', '#ff5722', 1.5);
    },
    flask: (ctx) => {
        drawPath(ctx, c => { c.moveTo(-2, -6); c.lineTo(2, -6); c.lineTo(2, -3); c.lineTo(5, 4); c.lineTo(-5, 4); c.lineTo(-2, -3); c.closePath(); }, 'rgba(255,255,255,0.7)', TDS.OUTLINE, 1.5);
        ctx.fillStyle = '#76ff03'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(4, 3); ctx.lineTo(-4, 3); ctx.fill();
    },
    scroll: (ctx) => {
        drawPath(ctx, c => { TDS.roundRect(c, -6, -4, 12, 8, 2); }, '#fff9c4', TDS.OUTLINE, 1.5);
        drawPath(ctx, c => { c.moveTo(-2, -4); c.lineTo(-2, 4); c.moveTo(2, -4); c.lineTo(2, 4); }, null, '#d32f2f', 2);
    }
};

TDS.projectile = function(ctx, kind, x, y, ang, ts) {
    if (!TDS.projectileDrawers[kind]) return;
    const cvs = getCacheD('proj_' + kind, 40, TDS.projectileDrawers[kind]);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    
    // Rotace pro specifické střely (např. rotující za letu)
    if (kind === 'blade') ctx.rotate(ts * 0.02);
    if (kind === 'barrel' || kind === 'flask') ctx.rotate(ts * 0.01);
    
    ctx.drawImage(cvs, -20, -20);
    ctx.restore();
};

// ==========================================
// EFEKTY (FX)
// ==========================================
TDS.fx = function(ctx, kind, x, y, r, p, ts, o = {}) {
    ctx.save();
    ctx.translate(x, y);

    const fade = 1 - p;
    const size = r * p;

    switch(kind) {
        case 'boom':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ff5722';
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
            break;
        case 'boomFire':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ff3d00';
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath(); ctx.arc(0, 0, size * 0.6, 0, Math.PI*2); ctx.fill();
            break;
        case 'boomGold':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ffca28';
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
            break;
        case 'boomSmall':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, 10 * fade, 0, Math.PI*2); ctx.fill();
            break;
        case 'frost':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#81d4fa';
            ctx.beginPath();
            for(let i=0; i<6; i++) {
                let a = (i * Math.PI) / 3;
                ctx.lineTo(Math.cos(a)*size, Math.sin(a)*size);
                ctx.lineTo(Math.cos(a+0.5)*size*0.4, Math.sin(a+0.5)*size*0.4);
            }
            ctx.closePath(); ctx.fill();
            break;
        case 'frostRing':
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 4 * fade;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.stroke();
            break;
        case 'acid':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#76ff03';
            TDS.seed(Math.floor(x + y));
            for(let i=0; i<5; i++) {
                let a = TDS.rand() * Math.PI * 2;
                let d = TDS.rand() * size;
                let sr = TDS.rand() * r * 0.3 * fade;
                ctx.beginPath(); ctx.arc(Math.cos(a)*d, Math.sin(a)*d, sr, 0, Math.PI*2); ctx.fill();
            }
            break;
        case 'ring':
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.stroke();
            break;
        case 'reveal':
            ctx.globalAlpha = fade * 0.5;
            ctx.fillStyle = '#e1bee7';
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#ab47bc'; ctx.lineWidth = 2; ctx.stroke();
            break;
        case 'horn':
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ffca28';
            ctx.lineWidth = 5 * fade;
            ctx.beginPath(); ctx.arc(0, 0, size, -Math.PI/4, Math.PI/4); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, size*0.7, -Math.PI/4, Math.PI/4); ctx.stroke();
            break;
        case 'rune':
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ea80fc';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.stroke();
            // Náznak run uvnitř kruhu
            ctx.save(); ctx.rotate(p * Math.PI);
            ctx.beginPath(); ctx.moveTo(-size*0.5, -size*0.5); ctx.lineTo(size*0.5, size*0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-size*0.5, size*0.5); ctx.lineTo(size*0.5, -size*0.5); ctx.stroke();
            ctx.restore();
            break;
        case 'tracer':
        case 'beam':
        case 'missile':
            // Kreslení čáry od (x,y) k (tx,ty)
            if (o.tx !== undefined && o.ty !== undefined) {
                let dx = o.tx - x; let dy = o.ty - y;
                ctx.globalAlpha = fade;
                ctx.strokeStyle = kind === 'tracer' ? '#ffca28' : (kind === 'beam' ? '#00e5ff' : '#ff5252');
                ctx.lineWidth = kind === 'beam' ? (r || 4) : 2;
                ctx.beginPath(); 
                if (kind === 'missile') {
                    ctx.moveTo(dx * p, dy * p);
                    ctx.lineTo(dx * Math.min(1, p + 0.2), dy * Math.min(1, p + 0.2));
                } else {
                    ctx.moveTo(0, 0); ctx.lineTo(dx, dy); 
                }
                ctx.stroke();
            }
            break;
        case 'zap':
            if (o.tx !== undefined && o.ty !== undefined) {
                let dx = o.tx - x; let dy = o.ty - y;
                let dist = Math.hypot(dx, dy);
                let steps = Math.floor(dist / 10);
                
                ctx.strokeStyle = '#ea80fc';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0,0);
                TDS.seed(Math.floor(ts / 50)); // Jitter každých 50ms
                for(let i=1; i<steps; i++) {
                    let f = i/steps;
                    let nx = dx * f + (TDS.rand() - 0.5) * 20;
                    let ny = dy * f + (TDS.rand() - 0.5) * 20;
                    ctx.lineTo(nx, ny);
                }
                ctx.lineTo(dx, dy);
                ctx.stroke();
            }
            break;
        case 'meteor':
            if (o.tx !== undefined && o.ty !== undefined) {
                let startY = o.ty - 300;
                let curY = startY + (o.ty - startY) * p;
                let curX = x + (o.tx - x) * p;
                
                ctx.translate(curX - x, curY - y);
                ctx.fillStyle = '#ff3d00';
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
                
                // Ocas
                ctx.fillStyle = '#ffeb3b';
                ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.lineTo(0, -r*3); ctx.closePath(); ctx.fill();
            }
            break;
        case 'splat':
        case 'bossdie':
            ctx.globalAlpha = fade;
            ctx.fillStyle = o.col || '#8bc34a';
            TDS.seed(Math.floor(x + y));
            let blobs = kind === 'bossdie' ? 12 : 5;
            for(let i=0; i<blobs; i++) {
                let a = TDS.rand() * Math.PI * 2;
                let d = TDS.rand() * size * (kind === 'bossdie' ? 2 : 1);
                let sr = TDS.rand() * r * fade * 0.5;
                ctx.beginPath(); ctx.arc(Math.cos(a)*d, Math.sin(a)*d, Math.max(0.1, sr), 0, Math.PI*2); ctx.fill();
            }
            break;
        case 'sealbreak':
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ffb300';
            ctx.lineWidth = 3 * fade;
            TDS.seed(Math.floor(x + y));
            for(let i=0; i<4; i++) {
                let a = (i * Math.PI) / 2 + p;
                let d = size;
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*d, Math.sin(a)*d); ctx.stroke();
            }
            break;
        case 'upgrade':
        case 'levelup':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ffca28';
            TDS.seed(Math.floor(x + y));
            for(let i=0; i<8; i++) {
                let a = TDS.rand() * Math.PI * 2;
                let d = p * r * (0.5 + TDS.rand());
                ctx.beginPath(); ctx.arc(Math.cos(a)*d, Math.sin(a)*d - p*20, 2, 0, Math.PI*2); ctx.fill();
            }
            break;
        case 'place':
        case 'sell':
            ctx.globalAlpha = fade;
            ctx.fillStyle = kind === 'place' ? '#cfd8dc' : '#ffcc80'; // Prach vs zlatý prach
            TDS.seed(Math.floor(x + y));
            for(let i=0; i<10; i++) {
                let a = TDS.rand() * Math.PI * 2;
                let d = TDS.rand() * size;
                ctx.beginPath(); ctx.arc(Math.cos(a)*d, Math.sin(a)*d, 3*fade, 0, Math.PI*2); ctx.fill();
            }
            break;
        case 'gold':
        case 'goldSplash':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ffca28';
            TDS.seed(Math.floor(x + y));
            let coins = kind === 'goldSplash' ? 6 : 1;
            for(let i=0; i<coins; i++) {
                let px = 0; let py = -p * 30; // Vyletí nahoru
                if (kind === 'goldSplash') {
                    let a = TDS.rand() * Math.PI * 2;
                    px = Math.cos(a) * p * 20;
                    py = Math.sin(a) * p * 20 - Math.sin(p * Math.PI) * 20;
                }
                ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 1; ctx.stroke();
            }
            break;
        case 'trap': // Skousnutí pasti
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#757575';
            ctx.save();
            ctx.translate(0, -size*0.2); ctx.rotate(-p*0.5); 
            ctx.fillRect(-10, -2, 20, 4); // Čelist
            ctx.restore();
            ctx.save();
            ctx.translate(0, size*0.2); ctx.rotate(p*0.5); 
            ctx.fillRect(-10, -2, 20, 4);
            ctx.restore();
            break;
        case 'shrink':
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ab47bc';
            ctx.lineWidth = 3;
            // Kruh co se zmenšuje
            let shrinkSize = r * (1 - p);
            ctx.beginPath(); ctx.arc(0, 0, Math.max(0.1, shrinkSize), 0, Math.PI*2); ctx.stroke();
            break;
        case 'potion': // Lektvar letící po oblouku
            if (o.tx !== undefined && o.ty !== undefined) {
                const dx = o.tx - x, dy = o.ty - y;
                let arch = Math.sin(p * Math.PI) * 40; // Výška oblouku
                
                ctx.translate(dx * p, dy * p - arch);
                ctx.rotate(p * Math.PI * 4); // Rotace za letu
                TDS.projectile(ctx, 'flask', 0, 0, 0, ts);
            }
            break;
        case 'regrow':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#64dd17';
            ctx.beginPath();
            ctx.moveTo(0, size); ctx.lineTo(-size*0.5, 0); ctx.lineTo(0, -size); ctx.lineTo(size*0.5, 0); ctx.closePath();
            ctx.fill();
            break;
        case 'flame':
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ff5722';
            ctx.rotate(o.ang || 0);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(size, -size*0.5);
            ctx.arc(size, 0, size*0.5, -Math.PI/2, Math.PI/2);
            ctx.closePath();
            ctx.fill();
            break;
        case 'leak':
            ctx.globalAlpha = fade * 0.7;
            ctx.fillStyle = '#d32f2f';
            ctx.fillRect(-50, -50, 100, 100);
            break;
    }
    
    ctx.restore();
};

// ==========================================
// ZÓNY (Zones)
// ==========================================
TDS.zone = function(ctx, kind, x, y, r, ts, fade) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = fade;

    if (kind === 'fire') {
        TDS.seed(Math.floor(ts / 100)); // Animace ohně
        for(let i=0; i<8; i++) {
            let a = (i/8) * Math.PI * 2;
            let dist = TDS.rand() * r * 0.8;
            ctx.fillStyle = TDS.rand() > 0.5 ? '#ff9800' : '#ff3d00';
            ctx.beginPath(); ctx.arc(Math.cos(a)*dist, Math.sin(a)*dist, 5 + TDS.rand()*5, 0, Math.PI*2); ctx.fill();
        }
    } else if (kind === 'acid') {
        ctx.fillStyle = 'rgba(118, 255, 3, 0.4)';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        TDS.seed(Math.floor(x + y));
        ctx.fillStyle = '#64dd17';
        for(let i=0; i<5; i++) {
            let px = (TDS.rand() - 0.5) * r;
            let py = (TDS.rand() - 0.5) * r;
            // Bubliny
            let br = 2 + Math.sin(ts * 0.005 + i) * 2; 
            ctx.beginPath(); ctx.arc(px, py, Math.max(0.1, br), 0, Math.PI*2); ctx.fill();
        }
    } else if (kind === 'storm') {
        ctx.fillStyle = 'rgba(129, 212, 250, 0.3)';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.save();
        ctx.rotate(ts * 0.002);
        for(let i=0; i<3; i++) {
            ctx.beginPath(); ctx.arc(0, 0, r * ((ts % 1000)/1000 + i/3) % r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
    }

    ctx.restore();
};

// ==========================================
// SPOJENCI (Allies)
// ==========================================
TDS.ally = function(ctx, big, x, y, ang, ts) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    const step = Math.sin(ts * 0.01) * 3; // Animace chůze/letu

    if (big) {
        // Kostěný drak
        drawPath(ctx, c => {
            // Křídla (máchání)
            c.save(); c.translate(0, -8); c.rotate(Math.sin(ts*0.005)*0.5);
            c.moveTo(0,0); c.lineTo(-20, -30); c.lineTo(10, -20); c.closePath();
            c.restore();
            
            c.save(); c.translate(0, 8); c.rotate(-Math.sin(ts*0.005)*0.5);
            c.moveTo(0,0); c.lineTo(-20, 30); c.lineTo(10, 20); c.closePath();
            c.restore();

            // Tělo / Páteř
            c.moveTo(-20, 0); c.lineTo(15, 0); 
        }, null, '#e0e0e0', 4);
        
        // Hlava lebka
        drawPath(ctx, c => { c.arc(18, 0, 6, 0, Math.PI*2); c.moveTo(24, -3); c.lineTo(30, -2); c.lineTo(24, 3); }, '#f5f5f5', TDS.OUTLINE, 2);
        
        // Oči červené
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath(); ctx.arc(20, -2, 2, 0, Math.PI*2); ctx.arc(20, 2, 2, 0, Math.PI*2); ctx.fill();
    } else {
        // Kostlivec
        drawPath(ctx, c => {
            // Ruce se zbraní
            c.moveTo(0, -4); c.lineTo(8 + step, -8); c.lineTo(16 + step, -4); // Meč
        }, null, '#bdbdbd', 2);
        
        drawPath(ctx, c => { c.moveTo(10+step, -8); c.lineTo(20+step, 0); }, null, '#9e9e9e', 3); // Čepel
        
        // Tělo
        drawPath(ctx, c => { c.arc(0, 0, 5, 0, Math.PI*2); }, '#f5f5f5', TDS.OUTLINE, 2);
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(2, -2, 1, 0, Math.PI*2); ctx.arc(2, 2, 1, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
};

TDS.phoenix = function(ctx, x, y, ts, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);   // směr letu (pohyb po mapě řídí hra)

    let wingSweep = Math.sin(ts * 0.01) * 10;
    
    drawPath(ctx, c => {
        // Křídla
        c.moveTo(0, 0); c.quadraticCurveTo(-10, -20 - wingSweep, 5, -30); c.quadraticCurveTo(10, -10, 0, 0);
        c.moveTo(0, 0); c.quadraticCurveTo(-10, 20 + wingSweep, 5, 30); c.quadraticCurveTo(10, 10, 0, 0);
        // Ocas
        c.moveTo(-5, -5); c.lineTo(-20, 0); c.lineTo(-5, 5);
    }, '#ff9800', '#ff3d00', 2);

    // Tělo a Hlava
    drawPath(ctx, c => { c.arc(0, 0, 6, 0, Math.PI*2); c.moveTo(6, -3); c.lineTo(12, 0); c.lineTo(6, 3); }, '#ffeb3b', '#ff5722', 2);

    ctx.restore();
};
})();
