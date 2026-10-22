/**
 * Obrana království - Kreslící knihovna (Část D: střely, efekty, zóny, spojenci, fénix) — vylepšené textury
 * Od Gemini; zabaleno do vlastního rozsahu s vlastními pomocnými funkcemi, aby nepřepsalo
 * TDS.getCache / TDS.drawPath / TDS.cache z částí A–C.
 */
(function () {
const TDS = window.TDS || (window.TDS = {});
const OUTLINE = '#111111', LINE_WIDTH = 2;
// Vlastní generátor náhody (stav nesdílí s ostatními částmi)
let mw = 123456789, mz = 987654321;
const seed = i => { mw = (123456789 + i) & 0xffffffff; mz = (987654321 - i) & 0xffffffff; };
const rand = () => { mz = (36969 * (mz & 65535) + (mz >> 16)) & 0xffffffff; mw = (18000 * (mw & 65535) + (mw >> 16)) & 0xffffffff; return (((mz << 16) + (mw & 65535)) >>> 0) / 4294967296; };
function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}
// Tvar se stínem vpravo dole a tmavým obrysem
function drawPath(ctx, pathFunc, fillStyle, strokeStyle = OUTLINE, lineWidth = LINE_WIDTH, hasShadow = true) {
    if (hasShadow) {
        ctx.save(); ctx.translate(2, 2.5); ctx.beginPath(); pathFunc(ctx);
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.beginPath(); pathFunc(ctx);
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle && lineWidth > 0) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
    ctx.restore();
}
// Odlesk (světlo shora zleva) bez obrysu a stínu
function drawHighlight(ctx, pathFunc, fillStyle = 'rgba(255,255,255,0.45)') {
    ctx.save(); ctx.beginPath(); pathFunc(ctx); ctx.fillStyle = fillStyle; ctx.fill(); ctx.restore();
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

// ==========================================
// STŘELY (Projectiles) - Vylepšené detailní textury
// ==========================================
TDS.projectileDrawers = {
    arrow: (ctx) => {
        // Křidélka (letky) s zářezy
        drawPath(ctx, c => {
            c.moveTo(-12, 0); c.lineTo(-15, -4); c.lineTo(-7, -4); c.lineTo(-5, 0);
            c.lineTo(-7, 4); c.lineTo(-15, 4); c.closePath();
        }, '#eceff1', OUTLINE, 1.5);
        drawHighlight(ctx, c => { c.moveTo(-13, -1); c.lineTo(-14, -3); c.lineTo(-8, -3); c.lineTo(-7, -1); c.closePath(); }, '#ffffff');
        // Dřevěné tělo šípu
        drawPath(ctx, c => { roundRect(c, -10, -1.5, 16, 3, 1); }, '#8d6e63', OUTLINE, 1.5);
        drawHighlight(ctx, c => { c.rect(-9, -1, 14, 1); }, '#bcaaa4');
        // Kovový hrot s odleskem
        drawPath(ctx, c => {
            c.moveTo(4, -4.5); c.lineTo(13, 0); c.lineTo(4, 4.5); c.lineTo(6, 0); c.closePath();
        }, '#b0bec5', OUTLINE, 1.8);
        drawHighlight(ctx, c => { c.moveTo(5.5, -2.5); c.lineTo(11, 0); c.lineTo(6.5, 0); c.closePath(); }, '#ffffff');
    },
    arrowCrit: (ctx) => {
        // Zlatá aura kolem šípu
        drawHighlight(ctx, c => {
            c.moveTo(-16, 0); c.lineTo(4, -8); c.lineTo(17, 0); c.lineTo(4, 8); c.closePath();
        }, 'rgba(255, 215, 64, 0.35)');
        // Zlaté letky
        drawPath(ctx, c => {
            c.moveTo(-12, 0); c.lineTo(-16, -5); c.lineTo(-7, -5); c.lineTo(-4, 0);
            c.lineTo(-7, 5); c.lineTo(-16, 5); c.closePath();
        }, '#ffab00', OUTLINE, 1.5);
        // Zářivé tělo
        drawPath(ctx, c => { roundRect(c, -10, -2, 16, 4, 1.5); }, '#ffd740', OUTLINE, 1.5);
        // Diamantový zlatobílý hrot
        drawPath(ctx, c => {
            c.moveTo(3, -6); c.lineTo(15, 0); c.lineTo(3, 6); c.lineTo(6, 0); c.closePath();
        }, '#ffff00', OUTLINE, 1.8);
        drawHighlight(ctx, c => { c.moveTo(5, -3); c.lineTo(13, 0); c.lineTo(7, 0); c.closePath(); }, '#ffffff');
    },
    ballista: (ctx) => {
        // Stabilizační křidélka
        drawPath(ctx, c => {
            c.moveTo(-16, -2); c.lineTo(-19, -7); c.lineTo(-10, -5); c.lineTo(-8, -2);
            c.moveTo(-16, 2); c.lineTo(-19, 7); c.lineTo(-10, 5); c.lineTo(-8, 2);
        }, '#546e7a', OUTLINE, 1.5);
        // Těžký dubový trám
        drawPath(ctx, c => { roundRect(c, -16, -3, 24, 6, 2); }, '#5d4037', OUTLINE, 2);
        drawHighlight(ctx, c => { c.rect(-14, -2, 20, 1.8); }, '#8d6e63');
        // Kovové obruče
        drawPath(ctx, c => { c.rect(-10, -3.2, 3, 6.4); c.rect(0, -3.2, 3, 6.4); }, '#78909c', OUTLINE, 1.2, false);
        // Masivní ocelový hrot
        drawPath(ctx, c => {
            c.moveTo(6, -7); c.lineTo(19, 0); c.lineTo(6, 7); c.lineTo(8, 0); c.closePath();
        }, '#cfd8dc', OUTLINE, 2);
        drawHighlight(ctx, c => { c.moveTo(7.5, -4.5); c.lineTo(16.5, 0); c.lineTo(8.5, 0); c.closePath(); }, '#ffffff');
    },
    spike: (ctx) => {
        // Kovaný železný hrot s fazetou
        drawPath(ctx, c => {
            c.moveTo(-9, 0); c.lineTo(-5, -5); c.lineTo(11, 0); c.lineTo(-5, 5); c.closePath();
        }, '#78909c', OUTLINE, 1.8);
        // Horní světlejší ploška
        drawHighlight(ctx, c => {
            c.moveTo(-7, 0); c.lineTo(-4.5, -3.5); c.lineTo(9, 0); c.closePath();
        }, '#cfd8dc');
        // Spodní tmavší ploška
        drawHighlight(ctx, c => {
            c.moveTo(-7, 0); c.lineTo(-4.5, 3.5); c.lineTo(9, 0); c.closePath();
        }, 'rgba(0,0,0,0.2)');
    },
    blade: (ctx) => {
        // Ozubený pilový kotouč
        drawPath(ctx, c => {
            for (let i = 0; i < 8; i++) {
                let a = (i * Math.PI) / 4;
                let a2 = a + 0.28;
                if (i === 0) c.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
                else c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
                c.lineTo(Math.cos(a2) * 7.5, Math.sin(a2) * 7.5);
            }
            c.closePath();
        }, '#cfd8dc', OUTLINE, 2);
        // Kovový lesk na zubech
        drawHighlight(ctx, c => { c.arc(-2, -2, 7, 0, Math.PI * 2); }, 'rgba(255,255,255,0.5)');
        // Vnitřní mosazný prstenec a střed
        drawPath(ctx, c => { c.arc(0, 0, 5, 0, Math.PI * 2); }, '#ffb300', OUTLINE, 1.5, false);
        drawPath(ctx, c => { c.arc(0, 0, 2, 0, Math.PI * 2); }, '#263238', null, 0, false);
    },
    flame: (ctx) => {
        // Vnější rudý plamen
        drawPath(ctx, c => {
            c.moveTo(11, 0);
            c.quadraticCurveTo(2, -9, -10, -5);
            c.quadraticCurveTo(-5, 0, -12, 3);
            c.quadraticCurveTo(0, 10, 11, 0);
            c.closePath();
        }, '#ff3d00', OUTLINE, 1.5);
        // Oranžový střed
        drawHighlight(ctx, c => {
            c.moveTo(8, 0); c.quadraticCurveTo(1, -5, -6, -2); c.quadraticCurveTo(-2, 1, -6, 3); c.quadraticCurveTo(1, 5, 8, 0);
        }, '#ff9100');
        // Žlutobílé jádro
        drawHighlight(ctx, c => { c.arc(3, 0, 3, 0, Math.PI * 2); }, '#ffff8d');
    },
    iceball: (ctx) => {
        // Mrazivá aura
        drawHighlight(ctx, c => { c.arc(0, 0, 10, 0, Math.PI * 2); }, 'rgba(0, 229, 255, 0.25)');
        // Hrbolatá ledová koule
        drawPath(ctx, c => {
            for (let i = 0; i < 8; i++) {
                let a = (i / 8) * Math.PI * 2;
                let r = i % 2 === 0 ? 7.5 : 6.5;
                if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            c.closePath();
        }, '#4fc3f7', OUTLINE, 1.8);
        // Krystalický odlesk shora zleva
        drawHighlight(ctx, c => {
            c.moveTo(-4, -4); c.lineTo(1, -5); c.lineTo(-1, -1); c.lineTo(-5, 1); c.closePath();
        }, '#e1f5fe');
        drawHighlight(ctx, c => { c.arc(-2, -2, 1.8, 0, Math.PI * 2); }, '#ffffff');
    },
    icicle: (ctx) => {
        // Ostrý krystalický rampouch
        drawPath(ctx, c => {
            c.moveTo(-10, -5); c.lineTo(-6, -6); c.lineTo(13, 0); c.lineTo(-6, 6); c.lineTo(-10, 5); c.lineTo(-7, 0); c.closePath();
        }, '#29b6f6', OUTLINE, 1.8);
        // Horní ledová hrana
        drawHighlight(ctx, c => {
            c.moveTo(-7, 0); c.lineTo(-6, -4.5); c.lineTo(10, 0); c.closePath();
        }, '#b3e5fc');
        drawHighlight(ctx, c => {
            c.moveTo(-4, -1); c.lineTo(-3, -3); c.lineTo(5, -0.5); c.closePath();
        }, '#ffffff');
    },
    shard: (ctx) => {
        // Asymetrický ledový střep
        drawPath(ctx, c => {
            c.moveTo(9, 0); c.lineTo(1, -6); c.lineTo(-8, -3); c.lineTo(-5, 4); c.lineTo(2, 6); c.closePath();
        }, '#00e5ff', OUTLINE, 1.6);
        drawHighlight(ctx, c => {
            c.moveTo(7, 0); c.lineTo(1, -4.5); c.lineTo(-5, -2); c.lineTo(0, 1); c.closePath();
        }, '#e0f7fa');
    },
    barrel: (ctx) => {
        // Baculatý dřevěný soudek
        drawPath(ctx, c => {
            c.moveTo(-7, -7);
            c.quadraticCurveTo(0, -9, 7, -7);
            c.quadraticCurveTo(10, 0, 7, 7);
            c.quadraticCurveTo(0, 9, -7, 7);
            c.quadraticCurveTo(-10, 0, -7, -7);
            c.closePath();
        }, '#8d6e63', OUTLINE, 2);
        // Dřevěné plaňky (čáry)
        drawPath(ctx, c => {
            c.moveTo(-8, -2.5); c.lineTo(8, -2.5);
            c.moveTo(-8, 2.5); c.lineTo(8, 2.5);
        }, null, '#4e342e', 1.2, false);
        // Světlo shora zleva
        drawHighlight(ctx, c => {
            c.ellipse(-1, -4.5, 5, 1.5, 0, 0, Math.PI * 2);
        }, 'rgba(255,255,255,0.28)');
        // Železné obruče s nýty
        drawPath(ctx, c => {
            c.rect(-6, -7.5, 2.8, 15);
            c.rect(3.2, -7.5, 2.8, 15);
        }, '#78909c', OUTLINE, 1.5, false);
        // Doutnák a jiskra
        drawPath(ctx, c => {
            c.moveTo(0, 0); c.quadraticCurveTo(3, -6, 6, -9);
        }, null, '#d7ccc8', 2, false);
        drawPath(ctx, c => { c.arc(6, -9, 3.5, 0, Math.PI * 2); }, '#ff3d00', '#ffea00', 1.5, false);
        drawHighlight(ctx, c => { c.arc(6, -9, 1.5, 0, Math.PI * 2); }, '#ffffff');
    },
    harpoonBolt: (ctx) => {
        // Lano za harpunou
        drawPath(ctx, c => {
            c.moveTo(-18, 2); c.quadraticCurveTo(-15, -3, -12, 0);
        }, null, '#a1887f', 2, false);
        // Kovové tělo harpuny
        drawPath(ctx, c => { roundRect(c, -14, -2, 20, 4, 1.5); }, '#455a64', OUTLINE, 1.6);
        drawHighlight(ctx, c => { c.rect(-12, -1.2, 16, 1.2); }, '#90a4ae');
        // Zpětné háky harpuny
        drawPath(ctx, c => {
            c.moveTo(4, -2); c.lineTo(2, -7); c.lineTo(18, 0); c.lineTo(2, 7); c.lineTo(4, 2); c.closePath();
        }, '#cfd8dc', OUTLINE, 1.8);
        drawHighlight(ctx, c => {
            c.moveTo(4, -1); c.lineTo(3.5, -4.5); c.lineTo(15, 0); c.closePath();
        }, '#ffffff');
    },
    cannon: (ctx) => {
        // Těžká litinová dělová koule
        drawPath(ctx, c => { c.arc(0, 0, 8, 0, Math.PI * 2); }, '#263238', OUTLINE, 2);
        // Tmavší stín zespodu
        drawHighlight(ctx, c => {
            c.arc(1.5, 1.5, 6.5, 0, Math.PI * 2);
        }, 'rgba(0,0,0,0.35)');
        // Výrazný kovový odlesk vlevo nahoře
        drawHighlight(ctx, c => { c.arc(-2.5, -2.5, 3, 0, Math.PI * 2); }, 'rgba(255,255,255,0.45)');
        drawHighlight(ctx, c => { c.arc(-3, -3, 1.3, 0, Math.PI * 2); }, '#ffffff');
    },
    dart: (ctx) => {
        // Křidélka šipky
        drawPath(ctx, c => {
            c.moveTo(-10, 0); c.lineTo(-13, -4); c.lineTo(-6, -3); c.lineTo(-4, 0);
            c.lineTo(-6, 3); c.lineTo(-13, 4); c.closePath();
        }, '#26c6da', OUTLINE, 1.4);
        // Dřevěné tělo
        drawPath(ctx, c => { roundRect(c, -7, -1.5, 11, 3, 1); }, '#8d6e63', OUTLINE, 1.4);
        // Ostrá jehla
        drawPath(ctx, c => {
            c.moveTo(3, -3); c.lineTo(11, 0); c.lineTo(3, 3); c.closePath();
        }, '#eceff1', OUTLINE, 1.5);
    },
    dartSmall: (ctx) => {
        drawPath(ctx, c => {
            c.moveTo(-7, 0); c.lineTo(-9, -3); c.lineTo(-3, -2); c.lineTo(-3, 2); c.lineTo(-9, 3); c.closePath();
        }, '#ffca28', OUTLINE, 1.2);
        drawPath(ctx, c => {
            c.moveTo(-4, -1.8); c.lineTo(7, 0); c.lineTo(-4, 1.8); c.closePath();
        }, '#cfd8dc', OUTLINE, 1.4);
    },
    bolt: (ctx) => {
        // Fialová magická aura
        drawHighlight(ctx, c => { c.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); }, 'rgba(171, 71, 188, 0.35)');
        // Klikatý energetický projektil
        drawPath(ctx, c => {
            c.moveTo(12, 0); c.lineTo(2, -6); c.lineTo(4, -2); c.lineTo(-10, -4);
            c.lineTo(-5, 0); c.lineTo(-10, 4); c.lineTo(4, 2); c.lineTo(2, 6); c.closePath();
        }, '#ab47bc', '#4a148c', 1.6);
        drawHighlight(ctx, c => {
            c.moveTo(9, 0); c.lineTo(3, -3); c.lineTo(-4, 0); c.lineTo(3, 3); c.closePath();
        }, '#f3e5f5');
    },
    boltTrue: (ctx) => {
        // Silná arkánní záře
        drawHighlight(ctx, c => { c.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2); }, 'rgba(234, 128, 252, 0.45)');
        drawPath(ctx, c => {
            c.moveTo(15, 0); c.lineTo(3, -8); c.lineTo(5, -3); c.lineTo(-13, -6);
            c.lineTo(-7, 0); c.lineTo(-13, 6); c.lineTo(5, 3); c.lineTo(3, 8); c.closePath();
        }, '#ea80fc', '#4a148c', 1.8);
        drawHighlight(ctx, c => {
            c.moveTo(12, 0); c.lineTo(4, -4); c.lineTo(-6, 0); c.lineTo(4, 4); c.closePath();
        }, '#ffffff');
    },
    phoenixFire: (ctx) => {
        //Střela ve tvaru ohnivého ptáka / křídel
        drawPath(ctx, c => {
            c.moveTo(14, 0);
            c.quadraticCurveTo(4, -4, -4, -13);
            c.quadraticCurveTo(-2, -4, -14, -5);
            c.lineTo(-8, 0);
            c.lineTo(-14, 5);
            c.quadraticCurveTo(-2, 4, -4, 13);
            c.quadraticCurveTo(4, 4, 14, 0);
            c.closePath();
        }, '#ff3d00', OUTLINE, 1.8);
        drawHighlight(ctx, c => {
            c.moveTo(10, 0); c.quadraticCurveTo(2, -3, -2, -8); c.lineTo(-5, 0); c.lineTo(-2, 8); c.quadraticCurveTo(2, 3, 10, 0);
        }, '#ffab00');
        drawHighlight(ctx, c => { c.arc(4, 0, 3.5, 0, Math.PI * 2); }, '#ffff8d');
    },
    fireball: (ctx) => {
        // Plamenný ohon s výstupky
        drawPath(ctx, c => {
            c.moveTo(5, -7);
            c.quadraticCurveTo(-4, -8, -14, -4);
            c.lineTo(-9, 0);
            c.lineTo(-15, 4);
            c.quadraticCurveTo(-4, 8, 5, 7);
            c.arc(5, 0, 7, Math.PI / 2, -Math.PI / 2, true);
            c.closePath();
        }, '#ff5722', OUTLINE, 1.8);
        // Vnitřní žhavé jádro
        drawHighlight(ctx, c => {
            c.moveTo(5, -4.5); c.lineTo(-8, 0); c.lineTo(5, 4.5); c.arc(5, 0, 4.5, Math.PI / 2, -Math.PI / 2, true);
        }, '#ffca28');
        drawHighlight(ctx, c => { c.arc(6, -1, 3, 0, Math.PI * 2); }, '#ffffff');
    },
    flask: (ctx) => {
        // Skleněná baňka
        drawPath(ctx, c => {
            c.moveTo(-2.5, -8); c.lineTo(2.5, -8); c.lineTo(2.5, -4);
            c.quadraticCurveTo(8, -1, 7, 5);
            c.quadraticCurveTo(6, 9, 0, 9);
            c.quadraticCurveTo(-6, 9, -7, 5);
            c.quadraticCurveTo(-8, -1, -2.5, -4);
            c.closePath();
        }, '#e0f7fa', OUTLINE, 1.8);
        // Zelená kyselina uvnitř s hladinou
        drawHighlight(ctx, c => {
            c.moveTo(-5.5, 1);
            c.quadraticCurveTo(0, 2.5, 5.5, 1);
            c.quadraticCurveTo(6.5, 5, 5.5, 6.5);
            c.quadraticCurveTo(0, 8, -5.5, 6.5);
            c.quadraticCurveTo(-6.5, 5, -5.5, 1);
            c.closePath();
        }, '#64dd17');
        // Bublinky v kyselině
        drawHighlight(ctx, c => {
            c.arc(-2, 5, 1.5, 0, Math.PI * 2);
            c.arc(2, 3.5, 1, 0, Math.PI * 2);
        }, '#ccff90');
        // Korková zátka
        drawPath(ctx, c => { roundRect(c, -3, -11, 6, 4, 1); }, '#8d6e63', OUTLINE, 1.5, false);
        // Odlesk na skle
        drawHighlight(ctx, c => {
            c.moveTo(-4.5, 0); c.quadraticCurveTo(-5.5, 3, -4, 6); c.lineTo(-2.5, 5); c.quadraticCurveTo(-3.5, 2.5, -3, 0); c.closePath();
        }, 'rgba(255,255,255,0.75)');
    },
    scroll: (ctx) => {
        // Zlaté koncovky svitku
        drawPath(ctx, c => {
            roundRect(c, -7, -8.5, 3, 17, 1);
            roundRect(c, 4, -8.5, 3, 17, 1);
        }, '#ffb300', OUTLINE, 1.5);
        // Pergamen
        drawPath(ctx, c => {
            roundRect(c, -8.5, -6.5, 17, 13, 2.5);
        }, '#fff8e1', OUTLINE, 1.8);
        drawHighlight(ctx, c => { c.rect(-7, -5, 14, 3); }, '#ffffff');
        // Červená stuha a vosková pečeť
        drawPath(ctx, c => { c.rect(-2, -6.8, 4, 13.6); }, '#d32f2f', OUTLINE, 1.4, false);
        drawPath(ctx, c => { c.arc(0, 0, 3.8, 0, Math.PI * 2); }, '#b71c1c', OUTLINE, 1.5, false);
        drawHighlight(ctx, c => { c.arc(-1, -1, 1.3, 0, Math.PI * 2); }, '#ef5350');
    }
};

TDS.projectile = function(ctx, kind, x, y, ang, ts) {
    if (!TDS.projectileDrawers[kind]) return;
    const cvs = getCacheD('proj_v2_' + kind, 48, TDS.projectileDrawers[kind]);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    
    // Plynulá rotace u vybraných střel
    if (kind === 'blade') ctx.rotate(ts * 0.025);
    if (kind === 'barrel' || kind === 'flask' || kind === 'scroll') ctx.rotate(ts * 0.012);
    
    ctx.drawImage(cvs, -24, -24);
    ctx.restore();
};

// ==========================================
// EFEKTY (FX) - Bohaté vrstvené efekty a částice
// ==========================================
TDS.fx = function(ctx, kind, x, y, r, p, ts, o = {}) {
    ctx.save();
    ctx.translate(x, y);

    const fade = Math.max(0, Math.min(1, 1 - p));
    const size = Math.max(0.1, r * p);
    const seedVal = Math.floor(x * 13 + y * 37);

    switch(kind) {
        case 'boom':
        case 'boomFire':
        case 'boomGold': {
            const isFire = kind === 'boomFire';
            const isGold = kind === 'boomGold';
            const colOuter = isGold ? '#ff8f00' : (isFire ? '#d50000' : '#e64a19');
            const colMid = isGold ? '#ffc107' : (isFire ? '#ff6d00' : '#ff9800');
            const colCore = isGold ? '#ffff8d' : '#fff9c4';

            ctx.globalAlpha = fade;
            // Tlaková vlna
            ctx.strokeStyle = colMid;
            ctx.lineWidth = Math.max(1, 3 * fade);
            ctx.beginPath(); ctx.arc(0, 0, size * 1.15, 0, Math.PI * 2); ctx.stroke();

            // Obláčky kouře po obvodu
            seed(seedVal);
            ctx.fillStyle = isGold ? '#ffe082' : '#455a64';
            for (let i = 0; i < 6; i++) {
                let a = (i / 6) * Math.PI * 2 + p * 0.6;
                let dist = size * (0.75 + rand() * 0.25);
                let puffR = Math.max(0.5, r * 0.28 * fade);
                ctx.beginPath(); ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, puffR, 0, Math.PI * 2); ctx.fill();
            }

            // Hvězdicový výbuch s černým obrysem
            ctx.beginPath();
            const spikes = 10;
            for (let i = 0; i < spikes * 2; i++) {
                let a = (i / (spikes * 2)) * Math.PI * 2;
                let rad = (i % 2 === 0) ? size : size * 0.62;
                if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            ctx.closePath();
            ctx.fillStyle = colOuter;
            ctx.fill();
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 2 * fade;
            ctx.stroke();

            // Vnitřní žhavá vrstva
            ctx.fillStyle = colMid;
            ctx.beginPath(); ctx.arc(0, 0, size * 0.65, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = colCore;
            ctx.beginPath(); ctx.arc(-size * 0.1, -size * 0.1, size * 0.35, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'boomSmall': {
            ctx.globalAlpha = fade;
            let sR = Math.max(0.5, 14 * (0.3 + p * 0.7));
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                let a = (i / 12) * Math.PI * 2;
                let rad = (i % 2 === 0) ? sR : sR * 0.45;
                if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            ctx.closePath();
            ctx.fillStyle = '#ffca28';
            ctx.fill();
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 1.5 * fade;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, sR * 0.4, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'frost': {
            ctx.globalAlpha = fade;
            // Ledová hvězdice s krystaly
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                let a = (i / 12) * Math.PI * 2;
                let rad = (i % 2 === 0) ? size * 1.1 : size * 0.45;
                if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            ctx.closePath();
            ctx.fillStyle = '#4fc3f7';
            ctx.fill();
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 1.8 * fade;
            ctx.stroke();

            ctx.fillStyle = '#e1f5fe';
            ctx.beginPath(); ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'frostRing': {
            ctx.globalAlpha = fade;
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 6 * fade;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();

            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 3.5 * fade;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();

            // Drobné ledové hroty na prstenci
            for (let i = 0; i < 8; i++) {
                let a = (i / 8) * Math.PI * 2 + p * 0.5;
                let px = Math.cos(a) * size;
                let py = Math.sin(a) * size;
                ctx.fillStyle = '#e0f7fa';
                ctx.beginPath(); ctx.arc(px, py, 3 * fade, 0, Math.PI * 2); ctx.fill();
            }
            break;
        }
        case 'acid': {
            ctx.globalAlpha = fade;
            seed(seedVal);
            // Kyselinové cákance s obrysem
            for (let i = 0; i < 6; i++) {
                let a = rand() * Math.PI * 2;
                let d = rand() * size * 0.9;
                let sr = Math.max(1, (0.2 + rand() * 0.25) * r * fade);
                let bx = Math.cos(a) * d;
                let by = Math.sin(a) * d;
                ctx.fillStyle = '#76ff03';
                ctx.strokeStyle = OUTLINE;
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(bx, by, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#ccff90';
                ctx.beginPath(); ctx.arc(bx - sr * 0.25, by - sr * 0.25, sr * 0.35, 0, Math.PI * 2); ctx.fill();
            }
            break;
        }
        case 'ring': {
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#dd2c00';
            ctx.lineWidth = 6 * fade;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#ffab00';
            ctx.lineWidth = 3 * fade;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
            break;
        }
        case 'reveal': {
            ctx.globalAlpha = fade * 0.75;
            ctx.fillStyle = 'rgba(225, 190, 231, 0.35)';
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ab47bc';
            ctx.lineWidth = 3 * fade;
            ctx.stroke();
            // Magické oko uprostřed
            let eyeS = Math.max(1, r * 0.35 * fade);
            ctx.fillStyle = '#fff9c4';
            ctx.beginPath();
            ctx.moveTo(-eyeS, 0);
            ctx.quadraticCurveTo(0, -eyeS * 0.8, eyeS, 0);
            ctx.quadraticCurveTo(0, eyeS * 0.8, -eyeS, 0);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#8e24aa';
            ctx.beginPath(); ctx.arc(0, 0, eyeS * 0.35, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'horn': {
            ctx.globalAlpha = fade;
            ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
                let rad = size * (0.55 + i * 0.22);
                ctx.strokeStyle = OUTLINE;
                ctx.lineWidth = (6 - i) * fade + 2;
                ctx.beginPath(); ctx.arc(0, 0, rad, -Math.PI / 3, Math.PI / 3); ctx.stroke();
                ctx.strokeStyle = i === 0 ? '#ffff00' : '#ffca28';
                ctx.lineWidth = (5 - i) * fade;
                ctx.beginPath(); ctx.arc(0, 0, rad, -Math.PI / 3, Math.PI / 3); ctx.stroke();
            }
            break;
        }
        case 'rune': {
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#ea80fc';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, size * 0.78, 0, Math.PI * 2); ctx.stroke();

            // Rotující šesticípý hexagram uvnitř
            ctx.save();
            ctx.rotate(p * Math.PI);
            for (let t = 0; t < 2; t++) {
                ctx.rotate(Math.PI / 3);
                ctx.beginPath();
                for (let i = 0; i < 3; i++) {
                    let a = (i / 3) * Math.PI * 2;
                    let rx = Math.cos(a) * size * 0.78;
                    let ry = Math.sin(a) * size * 0.78;
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                }
                ctx.closePath();
                ctx.stroke();
            }
            ctx.restore();
            break;
        }
        case 'tracer':
        case 'beam':
        case 'missile': {
            if (o.tx !== undefined && o.ty !== undefined) {
                let dx = o.tx - x;
                let dy = o.ty - y;
                ctx.globalAlpha = fade;
                ctx.lineCap = 'round';
                if (kind === 'tracer') {
                    // Kouřová a zlatá stopa výstřelu
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.lineWidth = 5 * fade;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke();
                    ctx.strokeStyle = '#ffd740';
                    ctx.lineWidth = 2 * fade;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke();
                    // Záblesk na hlavni
                    ctx.fillStyle = '#ffab00';
                    ctx.beginPath(); ctx.arc(0, 0, 6 * fade, 0, Math.PI * 2); ctx.fill();
                } else if (kind === 'beam') {
                    let bw = (r || 5) * fade;
                    ctx.strokeStyle = '#00b0ff';
                    ctx.lineWidth = bw * 2.2;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke();
                    ctx.strokeStyle = '#e1f5fe';
                    ctx.lineWidth = bw * 0.9;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke();
                } else if (kind === 'missile') {
                    let startF = Math.max(0, p - 0.25);
                    let hx = dx * p;
                    let hy = dy * p;
                    // Kouřová stopa za raketou
                    ctx.strokeStyle = 'rgba(255, 152, 0, 0.6)';
                    ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.moveTo(dx * startF, dy * startF); ctx.lineTo(hx, hy); ctx.stroke();
                    // Hlavice střely
                    ctx.save();
                    ctx.translate(hx, hy);
                    ctx.rotate(Math.atan2(dy, dx));
                    drawPath(ctx, c => {
                        c.moveTo(8, 0); c.lineTo(-5, -4); c.lineTo(-3, 0); c.lineTo(-5, 4); c.closePath();
                    }, '#ff1744', OUTLINE, 1.5, false);
                    ctx.restore();
                }
            }
            break;
        }
        case 'zap': {
            if (o.tx !== undefined && o.ty !== undefined) {
                let dx = o.tx - x;
                let dy = o.ty - y;
                let dist = Math.hypot(dx, dy);
                let steps = Math.max(3, Math.floor(dist / 12));
                
                ctx.globalAlpha = fade;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Vnější fialová záře a vnitřní bílý blesk
                for (let pass = 0; pass < 2; pass++) {
                    seed(Math.floor(ts / 45) + seedVal);
                    ctx.strokeStyle = pass === 0 ? '#aa00ff' : '#ffffff';
                    ctx.lineWidth = pass === 0 ? 5 * fade : 2 * fade;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    for (let i = 1; i < steps; i++) {
                        let f = i / steps;
                        let nx = dx * f + (rand() - 0.5) * 22;
                        let ny = dy * f + (rand() - 0.5) * 22;
                        ctx.lineTo(nx, ny);
                    }
                    ctx.lineTo(dx, dy);
                    ctx.stroke();
                }
            }
            break;
        }
        case 'meteor': {
            if (o.tx !== undefined && o.ty !== undefined) {
                let tx = o.tx - x;
                let ty = o.ty - y;
                // Varovný stín na zemi v místě dopadu
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath(); ctx.ellipse(tx, ty, r * (0.4 + p * 0.8), r * (0.25 + p * 0.5), 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#ff3d00';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Samotný padající meteorit
                let curX = tx * p - (1 - p) * 90;
                let curY = ty - (1 - p) * 260;
                ctx.translate(curX, curY);
                ctx.rotate(Math.atan2(260, 90));

                // Plamenný ohon
                drawPath(ctx, c => {
                    c.moveTo(0, -r * 0.9);
                    c.lineTo(-r * 3.8, -r * 0.3);
                    c.lineTo(-r * 2.5, 0);
                    c.lineTo(-r * 4.2, r * 0.4);
                    c.lineTo(0, r * 0.9);
                    c.closePath();
                }, '#ff6d00', OUTLINE, 1.5, false);
                drawHighlight(ctx, c => {
                    c.moveTo(0, -r * 0.5); c.lineTo(-r * 2.2, 0); c.lineTo(0, r * 0.5); c.closePath();
                }, '#ffea00');

                // Čedičová skála s lávovými puklinami
                drawPath(ctx, c => {
                    for (let i = 0; i < 7; i++) {
                        let a = (i / 7) * Math.PI * 2;
                        let rad = r * (i % 2 === 0 ? 1.05 : 0.85);
                        if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                        else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
                    }
                    c.closePath();
                }, '#3e2723', OUTLINE, 2, false);
                drawHighlight(ctx, c => { c.arc(-r * 0.2, -r * 0.2, r * 0.4, 0, Math.PI * 2); }, '#ff3d00');
            }
            break;
        }
        case 'splat':
        case 'bossdie': {
            ctx.globalAlpha = fade;
            const col = o.col || '#7cb342';
            const blobs = kind === 'bossdie' ? 14 : 7;
            seed(seedVal);
            for (let i = 0; i < blobs; i++) {
                let a = (i / blobs) * Math.PI * 2 + rand() * 0.5;
                let d = (0.2 + rand() * 0.8) * size * (kind === 'bossdie' ? 1.8 : 1.1);
                let sr = Math.max(1.2, (0.2 + rand() * 0.35) * r * fade);
                let bx = Math.cos(a) * d;
                let by = Math.sin(a) * d;
                drawPath(ctx, c => { c.arc(bx, by, sr, 0, Math.PI * 2); }, col, OUTLINE, 1.5, false);
                drawHighlight(ctx, c => { c.arc(bx - sr * 0.28, by - sr * 0.28, sr * 0.32, 0, Math.PI * 2); }, 'rgba(255,255,255,0.55)');
            }
            break;
        }
        case 'sealbreak': {
            ctx.globalAlpha = fade;
            // Rozpadající se úlomky zlaté runové pečeti
            for (let i = 0; i < 6; i++) {
                let a = (i / 6) * Math.PI * 2 + p * 0.4;
                let dist = size * 0.9;
                ctx.save();
                ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
                ctx.rotate(a + p * 2);
                drawPath(ctx, c => {
                    c.moveTo(-5 * fade, -4 * fade); c.lineTo(6 * fade, 0); c.lineTo(-3 * fade, 5 * fade); c.closePath();
                }, '#ffd740', OUTLINE, 1.5, false);
                ctx.restore();
            }
            break;
        }
        case 'upgrade':
        case 'levelup': {
            ctx.globalAlpha = fade;
            seed(seedVal);
            let count = kind === 'levelup' ? 10 : 6;
            for (let i = 0; i < count; i++) {
                let a = (i / count) * Math.PI * 2;
                let d = p * r * (0.6 + rand() * 0.6);
                let sx = Math.cos(a) * d;
                let sy = Math.sin(a) * d - p * 24;
                let sr = (kind === 'levelup' ? 5 : 3.8) * fade;
                // Čtyřcípá hvězdička
                drawPath(ctx, c => {
                    c.moveTo(sx, sy - sr);
                    c.quadraticCurveTo(sx, sy, sx + sr, sy);
                    c.quadraticCurveTo(sx, sy, sx, sy + sr);
                    c.quadraticCurveTo(sx, sy, sx - sr, sy);
                    c.quadraticCurveTo(sx, sy, sx, sy - sr);
                    c.closePath();
                }, '#ffff00', '#ff6f00', 1, false);
            }
            break;
        }
        case 'place':
        case 'sell': {
            ctx.globalAlpha = fade;
            const isSell = kind === 'sell';
            seed(seedVal);
            for (let i = 0; i < 9; i++) {
                let a = (i / 9) * Math.PI * 2 + rand() * 0.4;
                let d = (0.3 + p * 0.7) * r;
                let pr = Math.max(1, (5 + rand() * 4) * fade);
                let px = Math.cos(a) * d;
                let py = Math.sin(a) * d;
                drawPath(ctx, c => { c.arc(px, py, pr, 0, Math.PI * 2); }, isSell ? '#ffe082' : '#eceff1', OUTLINE, 1.4, false);
                drawHighlight(ctx, c => { c.arc(px - pr * 0.25, py - pr * 0.25, pr * 0.35, 0, Math.PI * 2); }, '#ffffff');
            }
            break;
        }
        case 'gold':
        case 'goldSplash': {
            ctx.globalAlpha = fade;
            seed(seedVal);
            let coins = kind === 'goldSplash' ? 6 : 1;
            for (let i = 0; i < coins; i++) {
                let px = 0;
                let py = -p * 32;
                if (kind === 'goldSplash') {
                    let a = (i / coins) * Math.PI * 2 + rand() * 0.4;
                    px = Math.cos(a) * p * 26;
                    py = Math.sin(a) * p * 18 - Math.sin(p * Math.PI) * 24;
                }
                drawPath(ctx, c => { c.arc(px, py, 5.5, 0, Math.PI * 2); }, '#ffd740', OUTLINE, 1.5, false);
                drawPath(ctx, c => { c.arc(px, py, 3.2, 0, Math.PI * 2); }, null, '#ff8f00', 1, false);
                drawHighlight(ctx, c => { c.arc(px - 1.5, py - 1.5, 1.5, 0, Math.PI * 2); }, '#ffffff');
            }
            break;
        }
        case 'blade': {
            // Efekt seknutí čepelí
            ctx.globalAlpha = fade;
            TDS.projectile(ctx, 'blade', 0, 0, p * Math.PI * 4, ts);
            break;
        }
        case 'trap': {
            ctx.globalAlpha = fade;
            let jawOffset = (1 - Math.min(1, p * 2.5)) * 8;
            // Horní a spodní ozubená čelist železné pasti
            for (let dir of [-1, 1]) {
                ctx.save();
                ctx.translate(0, dir * jawOffset);
                drawPath(ctx, c => {
                    c.arc(0, 0, 14, dir === -1 ? Math.PI : 0, dir === -1 ? 0 : Math.PI);
                    for (let t = -10; t <= 10; t += 5) {
                        c.lineTo(t, -dir * 4);
                        c.lineTo(t - 2.5, 0);
                    }
                    c.closePath();
                }, '#78909c', OUTLINE, 1.8, false);
                ctx.restore();
            }
            break;
        }
        case 'shrink': {
            ctx.globalAlpha = fade;
            let sRad = Math.max(1, r * (1 - p));
            ctx.strokeStyle = '#d500f9';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, sRad, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, sRad * 0.65, 0, Math.PI * 2); ctx.stroke();
            break;
        }
        case 'potion': {
            if (o.tx !== undefined && o.ty !== undefined) {
                let dx = o.tx - x;
                let dy = o.ty - y;
                let arch = Math.sin(p * Math.PI) * 45;
                // Stín baňky na zemi
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.beginPath(); ctx.ellipse(dx * p, dy * p, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
                // Letící baňka po oblouku
                ctx.translate(dx * p, dy * p - arch);
                TDS.projectile(ctx, 'flask', 0, 0, p * Math.PI * 4, ts);
            }
            break;
        }
        case 'regrow': {
            ctx.globalAlpha = fade;
            let sy = -p * 18;
            let sr = Math.max(2, r * 0.45 * fade);
            // Zelený léčivý kříž / krystal
            drawPath(ctx, c => {
                roundRect(c, -sr * 0.35, sy - sr, sr * 0.7, sr * 2, 2);
                roundRect(c, -sr, sy - sr * 0.35, sr * 2, sr * 0.7, 2);
            }, '#64dd17', OUTLINE, 1.6, false);
            drawHighlight(ctx, c => { c.arc(-sr * 0.15, sy - sr * 0.4, sr * 0.25, 0, Math.PI * 2); }, '#ccff90');
            break;
        }
        case 'flame': {
            ctx.globalAlpha = fade;
            ctx.rotate(o.ang || 0);
            // Vrstvený kužel plamenů
            drawPath(ctx, c => {
                c.moveTo(0, 0);
                c.lineTo(size, -size * 0.48);
                c.arc(size, 0, size * 0.48, -Math.PI / 2, Math.PI / 2);
                c.closePath();
            }, '#ff3d00', OUTLINE, 1.8, false);
            drawHighlight(ctx, c => {
                c.moveTo(2, 0);
                c.lineTo(size * 0.75, -size * 0.3);
                c.arc(size * 0.75, 0, size * 0.3, -Math.PI / 2, Math.PI / 2);
                c.closePath();
            }, '#ffab00');
            drawHighlight(ctx, c => {
                c.arc(size * 0.4, 0, size * 0.18, 0, Math.PI * 2);
            }, '#ffff8d');
            break;
        }
        case 'leak': {
            ctx.globalAlpha = fade * 0.85;
            // Výstražný rudý pulz a lebka
            ctx.fillStyle = 'rgba(211, 47, 47, 0.35)';
            ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#d50000';
            ctx.lineWidth = 3 * fade;
            ctx.stroke();

            drawPath(ctx, c => {
                c.arc(0, -3, 9, Math.PI, 0, false);
                c.lineTo(7, 5); c.lineTo(4, 5); c.lineTo(4, 9);
                c.lineTo(-4, 9); c.lineTo(-4, 5); c.lineTo(-7, 5); c.closePath();
            }, '#ffebee', OUTLINE, 1.8, false);
            ctx.fillStyle = '#d50000';
            ctx.beginPath(); ctx.arc(-3.5, -2, 2.2, 0, Math.PI * 2); ctx.arc(3.5, -2, 2.2, 0, Math.PI * 2); ctx.fill();
            break;
        }
    }
    
    ctx.restore();
};

// ==========================================
// ZÓNY (Zones) - Vylepšené plošné efekty na cestě
// ==========================================
TDS.zone = function(ctx, kind, x, y, r, ts, fade) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));

    if (kind === 'fire') {
        // Spálená žhnoucí země s lávovým okrajem
        drawPath(ctx, c => { c.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2); }, '#3e2723', '#dd2c00', 2.5, false);
        drawHighlight(ctx, c => { c.ellipse(0, 0, r * 0.78, r * 0.62, 0, 0, Math.PI * 2); }, 'rgba(255, 87, 34, 0.55)');

        // Tančící plamínky uvnitř zóny
        seed(Math.floor(x + y));
        for (let i = 0; i < 9; i++) {
            let a = (i / 9) * Math.PI * 2 + ts * 0.0015 * (i % 2 === 0 ? 1 : -1);
            let dist = (0.2 + rand() * 0.55) * r;
            let fx = Math.cos(a) * dist;
            let fy = Math.sin(a) * dist * 0.8;
            let fh = 8 + Math.sin(ts * 0.008 + i * 2) * 4;

            drawPath(ctx, c => {
                c.moveTo(fx - 5, fy);
                c.quadraticCurveTo(fx - 5, fy - fh, fx, fy - fh * 1.4);
                c.quadraticCurveTo(fx + 5, fy - fh, fx + 5, fy);
                c.closePath();
            }, '#ff6d00', OUTLINE, 1.4, false);
            drawHighlight(ctx, c => {
                c.moveTo(fx - 2.5, fy); c.lineTo(fx, fy - fh * 0.9); c.lineTo(fx + 2.5, fy); c.closePath();
            }, '#ffff00');
        }
    } else if (kind === 'acid') {
        // Organická kyselinová louže s tmavým obrysem
        seed(Math.floor(x * 7 + y * 13));
        drawPath(ctx, c => {
            for (let i = 0; i < 12; i++) {
                let a = (i / 12) * Math.PI * 2;
                let rad = r * (0.85 + Math.sin(i * 3) * 0.12);
                let px = Math.cos(a) * rad;
                let py = Math.sin(a) * rad * 0.85;
                if (i === 0) c.moveTo(px, py);
                else c.quadraticCurveTo(Math.cos(a - 0.25) * r, Math.sin(a - 0.25) * r * 0.85, px, py);
            }
            c.closePath();
        }, '#64dd17', OUTLINE, 2, true);

        // Světlejší střed louže
        drawHighlight(ctx, c => { c.ellipse(-r * 0.1, -r * 0.1, r * 0.65, r * 0.5, 0, 0, Math.PI * 2); }, '#b2ff59');

        // Animované praskající bubliny
        for (let i = 0; i < 6; i++) {
            let bx = (rand() - 0.5) * r * 1.1;
            let by = (rand() - 0.5) * r * 0.9;
            let pulse = (Math.sin(ts * 0.005 + i * 1.7) + 1) * 0.5;
            let br = 2 + pulse * 4.5;
            drawPath(ctx, c => { c.arc(bx, by, br, 0, Math.PI * 2); }, '#76ff03', OUTLINE, 1.4, false);
            drawHighlight(ctx, c => { c.arc(bx - br * 0.3, by - br * 0.3, br * 0.35, 0, Math.PI * 2); }, '#ffffff');
        }
    } else if (kind === 'storm') {
        // Vířící bouře živlů
        drawPath(ctx, c => { c.arc(0, 0, r, 0, Math.PI * 2); }, 'rgba(41, 182, 246, 0.35)', '#0288d1', 2, false);
        
        ctx.save();
        ctx.rotate(ts * 0.003);
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.strokeStyle = i % 2 === 0 ? '#e1f5fe' : '#80d8ff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.72, 0, Math.PI * 0.65);
            ctx.stroke();
        }
        ctx.restore();

        // Drobné elektrické výboje uvnitř bouře
        seed(Math.floor(ts / 80));
        ctx.strokeStyle = '#ffff8d';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        let sx = (rand() - 0.5) * r * 0.8;
        let sy = (rand() - 0.5) * r * 0.8;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rand() - 0.5) * 18, sy + (rand() - 0.5) * 18);
        ctx.lineTo(sx + (rand() - 0.5) * 28, sy + (rand() - 0.5) * 28);
        ctx.stroke();
    }

    ctx.restore();
};

// ==========================================
// SPOJENCI (Allies) - Detailní kostlivec a kostěný drak
// ==========================================
TDS.ally = function(ctx, big, x, y, ang, ts) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    const step = Math.sin(ts * 0.01) * 3.5;

    if (big) {
        // --- KOSTĚNÝ DRAK ---
        const wingAng = Math.sin(ts * 0.007) * 0.38;

        // Křídla s kostěnými prsty a potrhanou blánou
        for (let dir of [-1, 1]) {
            ctx.save();
            ctx.scale(1, dir);
            ctx.translate(2, 7);
            ctx.rotate(wingAng);
            // Tmavá blána křídla
            drawPath(ctx, c => {
                c.moveTo(0, 0);
                c.lineTo(-6, 28);
                c.quadraticCurveTo(-12, 20, -18, 22);
                c.quadraticCurveTo(-14, 12, -12, 2);
                c.closePath();
            }, 'rgba(55, 71, 79, 0.85)', OUTLINE, 1.8, true);
            // Kostěné žebroví křídla
            drawPath(ctx, c => {
                c.moveTo(0, 0); c.lineTo(-6, 28);
                c.moveTo(-2, 8); c.lineTo(-18, 22);
            }, null, '#eceff1', 2.5, false);
            ctx.restore();
        }

        // Ocas a páteř složená z jednotlivých obratlů
        for (let i = -22; i <= 10; i += 5) {
            let sway = Math.sin(ts * 0.008 + i * 0.2) * (i < 0 ? 2.5 : 0.5);
            let w = i < -10 ? 3 : 4.5;
            // Žebra u hrudníku
            if (i >= -6 && i <= 6) {
                drawPath(ctx, c => {
                    c.moveTo(i, sway - 9); c.quadraticCurveTo(i + 2, sway, i, sway + 9);
                }, null, '#cfd8dc', 2.2, false);
            }
            drawPath(ctx, c => {
                roundRect(c, i - 2, sway - w / 2, 4, w, 1.5);
            }, '#f5f5f5', OUTLINE, 1.5, true);
        }

        // Rohatá dračí lebka
        drawPath(ctx, c => {
            // Rohy dozadu
            c.moveTo(12, -6); c.quadraticCurveTo(4, -14, -2, -12); c.quadraticCurveTo(6, -8, 10, -4);
            c.moveTo(12, 6); c.quadraticCurveTo(4, 14, -2, 12); c.quadraticCurveTo(6, 8, 10, 4);
        }, '#cfd8dc', OUTLINE, 1.8, true);

        drawPath(ctx, c => {
            c.moveTo(10, -7);
            c.lineTo(18, -6);
            c.lineTo(28, -3);
            c.lineTo(30, 0);
            c.lineTo(28, 3);
            c.lineTo(18, 6);
            c.lineTo(10, 7);
            c.closePath();
        }, '#f5f5f5', OUTLINE, 2, true);
        drawHighlight(ctx, c => { c.ellipse(16, -2, 5, 2.5, 0, 0, Math.PI * 2); }, '#ffffff');

        // Planoucí rudé oči
        ctx.fillStyle = '#ff1744';
        ctx.beginPath(); ctx.arc(19, -3, 2.2, 0, Math.PI * 2); ctx.arc(19, 3, 2.2, 0, Math.PI * 2); ctx.fill();
    } else {
        // --- PŘÁTELSKÝ KOSTLIVEC BOJOVNÍK ---
        // Pravá ruka s mečem
        ctx.save();
        ctx.translate(2, 6);
        ctx.rotate(step * 0.08);
        // Kost paže
        drawPath(ctx, c => { c.moveTo(0, 0); c.lineTo(8, 2); }, null, '#e0e0e0', 3, true);
        // Čepel meče
        drawPath(ctx, c => {
            c.moveTo(8, 0); c.lineTo(21, -1); c.lineTo(24, 1.5); c.lineTo(21, 4); c.lineTo(8, 3); c.closePath();
        }, '#cfd8dc', OUTLINE, 1.6, true);
        drawHighlight(ctx, c => { c.rect(9, 0.2, 11, 1.2); }, '#ffffff');
        // Záštita meče
        drawPath(ctx, c => { roundRect(c, 6.5, -2.5, 3, 8, 1); }, '#ffb300', OUTLINE, 1.4, false);
        ctx.restore();

        // Levá ruka s dřevěným okovaným štítem
        ctx.save();
        ctx.translate(3, -7);
        ctx.rotate(-step * 0.06);
        drawPath(ctx, c => {
            c.ellipse(3, 0, 3.5, 8, 0.2, 0, Math.PI * 2);
        }, '#6d4c41', OUTLINE, 1.8, true);
        drawPath(ctx, c => { c.arc(4, 0, 2.5, 0, Math.PI * 2); }, '#90a4ae', OUTLINE, 1.2, false);
        ctx.restore();

        // Ramena / hrudní koš
        drawPath(ctx, c => {
            roundRect(c, -4, -9, 8, 18, 4);
        }, '#cfd8dc', OUTLINE, 1.8, true);

        // Lebka kostlivce
        drawPath(ctx, c => { c.arc(0, 0, 7, 0, Math.PI * 2); }, '#f5f5f5', OUTLINE, 2, true);
        drawHighlight(ctx, c => { c.arc(-2, -2, 3.5, 0, Math.PI * 2); }, '#ffffff');
        // Prasklina na lebce
        drawPath(ctx, c => { c.moveTo(-4, -3); c.lineTo(-1, -1); c.lineTo(-3, 1); }, null, '#757575', 1.2, false);
        // Oční důlky se tyrkysovou jiskrou
        ctx.fillStyle = '#111111';
        ctx.beginPath(); ctx.arc(3.5, -2.5, 1.8, 0, Math.PI * 2); ctx.arc(3.5, 2.5, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath(); ctx.arc(3.8, -2.5, 0.9, 0, Math.PI * 2); ctx.arc(3.8, 2.5, 0.9, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
};

// ==========================================
// OHNIVÝ FÉNIX (Phoenix)
// ==========================================
TDS.phoenix = function(ctx, x, y, ts, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);   // směr letu (pohyb po mapě řídí hra)

    let wingSweep = Math.sin(ts * 0.012) * 8;

    // Měkký stín hluboko pod letícím fénixem
    ctx.save();
    ctx.translate(10, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dlouhé vlající ocasní stuhy
    drawPath(ctx, c => {
        let wave = Math.sin(ts * 0.015) * 4;
        c.moveTo(-6, -4);
        c.quadraticCurveTo(-18, -8 + wave, -30, -5 - wave);
        c.lineTo(-22, 0);
        c.lineTo(-32, 6 - wave);
        c.quadraticCurveTo(-18, 8 + wave, -6, 4);
        c.closePath();
    }, '#ff3d00', OUTLINE, 1.8, false);

    // Rozpětí křídel s vrstveným ohnivým peřím
    drawPath(ctx, c => {
        // Levé a pravé křídlo
        c.moveTo(4, -3);
        c.quadraticCurveTo(2 - wingSweep * 0.4, -20, -6 - wingSweep, -32);
        c.lineTo(-10 - wingSweep * 0.7, -22);
        c.lineTo(-15 - wingSweep * 0.5, -25);
        c.quadraticCurveTo(-10, -12, -6, -3);

        c.moveTo(4, 3);
        c.quadraticCurveTo(2 - wingSweep * 0.4, 20, -6 - wingSweep, 32);
        c.lineTo(-10 - wingSweep * 0.7, 22);
        c.lineTo(-15 - wingSweep * 0.5, 25);
        c.quadraticCurveTo(-10, 12, -6, 3);
        c.closePath();
    }, '#ff6d00', OUTLINE, 2, false);

    // Zlatavé vnitřní peří křídel
    drawHighlight(ctx, c => {
        c.moveTo(2, -2);
        c.quadraticCurveTo(0, -14, -5 - wingSweep * 0.6, -21);
        c.lineTo(-5, -2);
        c.moveTo(2, 2);
        c.quadraticCurveTo(0, 14, -5 - wingSweep * 0.6, 21);
        c.lineTo(-5, 2);
        c.closePath();
    }, '#ffd740');

    // Tělo, hlava a zlatý zobák
    drawPath(ctx, c => {
        c.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    }, '#ffab00', OUTLINE, 2, false);
    drawHighlight(ctx, c => { c.ellipse(2, -1.5, 6, 3, 0, 0, Math.PI * 2); }, '#ffff8d');

    // Zobák a korunka
    drawPath(ctx, c => {
        c.moveTo(9, -3); c.lineTo(16, 0); c.lineTo(9, 3); c.closePath();
    }, '#ffff00', OUTLINE, 1.6, false);

    ctx.restore();
};
})();
