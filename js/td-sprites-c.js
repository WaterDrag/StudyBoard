/**
 * Obrana království - Kreslící knihovna (Část C: věže 6–10 a hrdinové)
 * Od Gemini; zabaleno do vlastního rozsahu. TDS.tower je společný pro části B i C.
 */
(function () {
const TDS = window.TDS || (window.TDS = {});

// --- Pomocné a stavové proměnné ---
TDS.cache = TDS.cache || {}; 
TDS.OUTLINE = '#111';
TDS.LINE_WIDTH = 2;

// --- Vlastní generátor náhody (seedovaný) ---
TDS.m_w = 123456789;
TDS.m_z = 987654321;
TDS.mask = 0xffffffff;
TDS.seed = function(i) {
    TDS.m_w = (123456789 + i) & TDS.mask;
    TDS.m_z = (987654321 - i) & TDS.mask;
};
TDS.rand = function() {
    TDS.m_z = (36969 * (TDS.m_z & 65535) + (TDS.m_z >> 16)) & TDS.mask;
    TDS.m_w = (18000 * (TDS.m_w & 65535) + (TDS.m_w >> 16)) & TDS.mask;
    let result = ((TDS.m_z << 16) + (TDS.m_w & 65535)) >>> 0;
    result /= 4294967296;
    return result;
};

// --- Základní kreslící funkce (bez zakázaných API) ---
TDS.roundRect = function(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
};

// Kreslení se stínem řešené posunem (žádný shadowBlur)
TDS.drawPath = function(ctx, pathFunc, fillStyle, strokeStyle = TDS.OUTLINE, lineWidth = TDS.LINE_WIDTH) {
    ctx.save();
    // 1. Měkký stín
    ctx.save();
    ctx.translate(3, 3);
    ctx.beginPath(); // každý tvar je samostatná cesta
    pathFunc(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.restore();
    
    // 2. Tvar
    ctx.beginPath();
    pathFunc(ctx);
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (strokeStyle && lineWidth > 0) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    ctx.restore();
};

TDS.circlePath = function(x, y, r) {
    return function(ctx) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
    };
};

TDS.rectPath = function(x, y, w, h, r) {
    return function(ctx) {
        if (r) TDS.roundRect(ctx, x, y, w, h, r);
        else { ctx.beginPath(); ctx.rect(x, y, w, h); }
    };
};

// Vytvoření offscreen canvasu
TDS.createCanvas = function(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
};

// Cache systém
TDS.getCache = function(id, part, keyArr, size, drawFunc) {
    const key = `${id}_${part}_${keyArr.join('-')}`;
    if (!TDS.cache[key]) {
        const cvs = TDS.createCanvas(size, size);
        const ctx = cvs.getContext('2d');
        ctx.translate(size / 2, size / 2);
        drawFunc(ctx);
        TDS.cache[key] = cvs;
    }
    return TDS.cache[key];
};

TDS.getMainPath = function(up) {
    for (let i = 0; i < 3; i++) {
        if (up[i] >= 3) return { path: i + 1, level: up[i] };
    }
    return { path: 0, level: Math.max(...up) }; 
};

// ==========================================
// VYKRESLOVÁNÍ VĚŽÍ 6 - 10
// ==========================================
TDS.drawers = TDS.drawers || {};

// 6. ŘÍČNÍ GALÉRA
TDS.drawers.ricni_galera = {
    base: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        let hullColor = '#8d6e63'; // Dřevěný trup
        if (mp.path === 2 && mp.level >= 2) hullColor = '#d32f2f'; // Řecký oheň (červená)
        if (mp.path === 2 && mp.level >= 4) hullColor = '#212121'; // Černo-červený pancíř
        if (mp.path === 3 && mp.level >= 5) hullColor = '#1976d2'; // Admirálská loď

        // Loď je vždy orientována doprava, zbraně rotují ve věžičce
        TDS.drawPath(ctx, function(c) {
            c.beginPath();
            c.moveTo(-20, -12);
            c.quadraticCurveTo(0, -16, 24, 0); // Špička (příď doprava)
            c.quadraticCurveTo(0, 16, -20, 12);
            c.lineTo(-24, 0); // Záď
            c.closePath();
        }, hullColor);

        // Palubní detaily
        TDS.drawPath(ctx, TDS.rectPath(-16, -8, 20, 16, 2), '#5d4037');

        // Cesta 3: Vesla
        if (mp.path === 3 && mp.level >= 1) {
            ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 2;
            for(let i=0; i<4; i++) {
                let x = -10 + i * 5;
                ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x-4, -18); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x-4, 18); ctx.stroke();
            }
        }
    },
    turret: function(ctx, up, s) {
        const mp = TDS.getMainPath(up);
        
        // Stožár nebo dělo
        if (mp.path === 1) {
            // Maják / Světlo
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#5d4037'); // Stěžeň
            if (mp.level >= 1) TDS.drawPath(ctx, TDS.circlePath(0, 0, 10), 'rgba(215, 204, 200, 0.8)'); // Koš
            if (mp.level >= 3) {
                // Lucerna
                TDS.drawPath(ctx, TDS.rectPath(-4, -4, 8, 8, 2), '#ffb300');
                // Světlo
                if (s.mode === 'lighthouse' || mp.level >= 4) {
                    ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
                    ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(40, -16); ctx.lineTo(40, 16); ctx.lineTo(4, 4); ctx.fill();
                }
            }
            if (mp.level === 5) {
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 14), 'rgba(255, 255, 255, 0.9)', '#ffeb3b'); // Zlatobílá kopule
            }
        } else if (mp.path === 2) {
            // Děla / Harpuny
            if (mp.level >= 3) { // Moždíř / Dělo
                let color = mp.level >= 5 ? '#ffca28' : '#424242'; // Zlatá vs ocel
                TDS.drawPath(ctx, TDS.rectPath(-6, -6, 20, 12, 2), color);
                TDS.drawPath(ctx, TDS.rectPath(12, -7, 6, 14, 2), '#212121'); // Ústí
            } else { // Harpuny
                let tip = mp.level >= 2 ? '#ff5722' : '#9e9e9e'; // Hořící špička
                TDS.drawPath(ctx, TDS.rectPath(-4, -2, 16, 4), '#757575');
                TDS.drawPath(ctx, function(c){ c.moveTo(12, -4); c.lineTo(20, 0); c.lineTo(12, 4); c.closePath(); }, tip);
            }
        } else if (mp.path === 3) {
            // Balisty / Oštěpy
            if (mp.level >= 4) { // Průrazné oštěpy / Rotační
                TDS.drawPath(ctx, TDS.rectPath(-8, -8, 16, 16, 2), '#ffca28'); // Základna
                TDS.drawPath(ctx, TDS.rectPath(4, -6, 14, 2), '#e0e0e0');
                TDS.drawPath(ctx, TDS.rectPath(4, 0, 14, 2), '#e0e0e0');
                TDS.drawPath(ctx, TDS.rectPath(4, 6, 14, 2), '#e0e0e0');
            } else { // Dvojité šipky
                TDS.drawPath(ctx, TDS.rectPath(-4, -6, 14, 2), '#795548');
                TDS.drawPath(ctx, TDS.rectPath(-4, 4, 14, 2), '#795548');
            }
        } else {
            // Základ
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#795548');
            TDS.drawPath(ctx, TDS.rectPath(-2, -2, 10, 4), '#9e9e9e');
        }
    }
};

// 7. ARKÁNNÍ ČARODĚJ
TDS.drawers.arkanni_carodej = {
    base: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        // Cesta 3: Magický kruh (Nekromancie/Vidění)
        if (mp.path === 3) {
            let color = mp.level >= 4 ? '#4caf50' : '#81c784'; // Zelená
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 18), 'rgba(0,0,0,0)', color, 3);
            if (mp.level >= 5) TDS.drawPath(ctx, TDS.rectPath(-12, -12, 24, 24, 2), '#212121'); // Trůn
        } else {
            // Základní podstavec
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 16), '#9e9e9e');
            // Cesta 1: Runové prstence
            if (mp.path === 1 && mp.level >= 2) {
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 20), 'rgba(0,0,0,0)', '#ab47bc', 2);
            }
        }
    },
    turret: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        let robe = '#7e57c2'; // Fialová
        let hat = '#7e57c2';
        let staff = '#5d4037';
        let crystal = '#ba68c8';
        
        if (mp.path === 1) {
            if (mp.level >= 4) { robe = '#ffd54f'; crystal = '#ea80fc'; } // Zlatá
            if (mp.level === 5) { robe = '#ab47bc'; hat = '#ffd54f'; }
        }
        if (mp.path === 2) {
            robe = mp.level >= 2 ? '#d32f2f' : '#ef5350'; // Ohnivá
            if (mp.level >= 3) hat = '#ffca28'; // Zlatá dračí maska
        }
        if (mp.path === 3) {
            if (mp.level >= 4) { robe = '#1b5e20'; hat = '#212121'; crystal = '#64dd17'; } // Nekromant
        }

        // Tělo
        TDS.drawPath(ctx, TDS.circlePath(0, 0, 9), robe);
        
        // Hlava / Klobouk
        if (mp.path === 2 && mp.level >= 3) { // Dračí maska
            TDS.drawPath(ctx, function(c){ c.moveTo(-6, -6); c.lineTo(8, 0); c.lineTo(-6, 6); c.closePath(); }, hat);
        } else {
            TDS.drawPath(ctx, TDS.circlePath(2, 0, 6), '#ffccbc'); // Obličej
            TDS.drawPath(ctx, function(c){ c.moveTo(-4, -8); c.lineTo(12, 0); c.lineTo(-4, 8); c.closePath(); }, hat); // Klobouk zezadu dopředu
        }

        // Zbraň / Hůl
        TDS.drawPath(ctx, TDS.rectPath(4, -12, 16, 3), staff);
        
        if (mp.path === 3 && mp.level >= 4) {
            // Lebka na holi
            TDS.drawPath(ctx, TDS.circlePath(22, -10.5, 4), '#f5f5f5');
            ctx.fillStyle = '#64dd17'; ctx.fillRect(23, -12, 2, 2); // Oči
        } else {
            // Krystal
            TDS.drawPath(ctx, TDS.circlePath(22, -10.5, 5), crystal);
        }

        // Druhá ruka (Koule / Oheň / Lucerna)
        if (mp.path === 2 && mp.level >= 1) { // Ohnivá koule
            TDS.drawPath(ctx, TDS.circlePath(8, 10, 4), '#ff9800');
        } else if (mp.path === 3 && mp.level >= 3) { // Lucerna
            TDS.drawPath(ctx, TDS.rectPath(6, 8, 6, 8, 1), '#ffb300');
        }

        // Cesta 2: Křídla fénixe
        if (mp.path === 2 && mp.level >= 4) {
            TDS.drawPath(ctx, function(c){ c.moveTo(-5, -5); c.quadraticCurveTo(-15, -20, 0, -15); }, '#ff5722');
            TDS.drawPath(ctx, function(c){ c.moveTo(-5, 5); c.quadraticCurveTo(-15, 20, 0, 15); }, '#ff5722');
        }
    }
};

// 8. KRÁLOVSKÝ ALCHYMISTA
TDS.drawers.kralovsky_alchymista = {
    base: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        // Stůl / Laboratoř
        let table = '#795548';
        if (mp.path === 1 && mp.level >= 5) table = '#e0f7fa'; // Křišťálová
        if (mp.path === 3 && mp.level >= 4) table = '#ffca28'; // Zlatá

        TDS.drawPath(ctx, TDS.rectPath(-16, -10, 12, 20, 2), table);

        // Nádobí na stole
        let liquid = '#64dd17'; // Zelená (default)
        if (mp.path === 1) liquid = mp.level >= 3 ? '#ab47bc' : '#ff5252'; // Zuřivost/Život
        if (mp.path === 2) liquid = mp.level >= 3 ? '#ff5722' : '#ffea00'; // Žíravá/Výbušná
        if (mp.path === 3 && mp.level >= 3) liquid = '#ffca28'; // Zlato

        TDS.drawPath(ctx, TDS.circlePath(-10, -4, 4), 'rgba(255,255,255,0.7)', TDS.OUTLINE);
        ctx.fillStyle = liquid; ctx.beginPath(); ctx.arc(-10, -4, 3, 0, Math.PI); ctx.fill();

        if (mp.level >= 3) {
            // Kotel
            TDS.drawPath(ctx, TDS.circlePath(-10, 6, 6), '#424242');
            ctx.fillStyle = liquid; ctx.beginPath(); ctx.arc(-10, 6, 4, 0, Math.PI*2); ctx.fill();
        }
    },
    turret: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        let robe = '#8d6e63';
        
        if (mp.path === 2 && mp.level >= 2) robe = '#4e342e'; // Těžká zástěra
        if (mp.path === 3) {
            if (mp.level >= 3) robe = '#ffca28'; // Zlatá
            if (mp.level === 5) robe = '#e0e0e0'; // Diamant
        }

        // Tělo
        TDS.drawPath(ctx, TDS.circlePath(4, 0, 8), robe);
        TDS.drawPath(ctx, TDS.circlePath(4, 0, 5), '#ffccbc'); // Hlava
        
        // Brýle
        if (mp.path === 2 && mp.level >= 2) {
            TDS.drawPath(ctx, TDS.rectPath(6, -3, 3, 3), '#90caf9');
            TDS.drawPath(ctx, TDS.rectPath(6, 1, 3, 3), '#90caf9');
        }

        // Házená baňka v ruce
        let bColor = '#64dd17';
        if (mp.path === 1) bColor = '#ff5252';
        if (mp.path === 2) bColor = mp.level >= 4 ? '#ab47bc' : '#ffea00';
        if (mp.path === 3 && mp.level >= 3) bColor = '#ffca28';

        let bSize = (mp.path === 1 && mp.level >= 1) ? 5 : 3;

        // Ruka s baňkou (natažená)
        TDS.drawPath(ctx, function(c){ c.moveTo(4, 8); c.lineTo(12, 10); }, robe, TDS.OUTLINE, 3);
        TDS.drawPath(ctx, TDS.circlePath(14, 10, bSize), 'rgba(255,255,255,0.8)');
        ctx.fillStyle = bColor; ctx.beginPath(); ctx.arc(14, 10, bSize-1, 0, Math.PI); ctx.fill();
    }
};

// 9. STRÁŽNÍ HLÁSKA
TDS.drawers.strazni_hlaska = {
    base: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        let color = '#9e9e9e'; // Kámen
        let roof = '#795548'; // Dřevo
        
        if (mp.path === 1 && mp.level >= 4) roof = '#ffca28'; // Zlatá střecha
        if (mp.path === 2 && mp.level >= 5) color = '#f5f5f5'; // Katedrála
        if (mp.path === 3 && mp.level >= 3) roof = '#ff5722'; // Měď/Banka
        if (mp.path === 3 && mp.level === 5) color = '#fff9c4'; // Mramor

        // Základna (široká)
        TDS.drawPath(ctx, TDS.rectPath(-20, -20, 40, 40, 4), color);
        
        // Vnitřní věž/střecha
        TDS.drawPath(ctx, TDS.rectPath(-12, -12, 24, 24, 2), roof);

        // Detaily kolem
        if (mp.path === 1 && mp.level >= 2) { // Bubny
            TDS.drawPath(ctx, TDS.circlePath(-16, -16, 5), '#d7ccc8');
            TDS.drawPath(ctx, TDS.circlePath(-16, 16, 5), '#d7ccc8');
        }
        if (mp.path === 3 && mp.level >= 3) { // Truhly
            TDS.drawPath(ctx, TDS.rectPath(-22, -10, 6, 8, 1), '#8d6e63');
            TDS.drawPath(ctx, TDS.rectPath(-22, 2, 6, 8, 1), '#8d6e63');
        }
    },
    turret: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        // Hláska se neotáčí za nepřáteli, animujeme prapory
        
        // Cesta 1: Prapory / Balista
        if (mp.path === 1) {
            if (mp.level === 5) { // Obří zlatá balista
                TDS.drawPath(ctx, TDS.rectPath(-4, -8, 16, 16, 2), '#ffca28');
                TDS.drawPath(ctx, function(c){ c.moveTo(8, -12); c.lineTo(16, 0); c.lineTo(8, 12); }, '#fff', TDS.OUTLINE, 3);
            } else if (mp.level >= 1) { // Prapor (vlající doprava)
                TDS.drawPath(ctx, function(c){ c.moveTo(0,0); c.lineTo(20, -6); c.lineTo(16, 0); c.lineTo(20, 6); c.closePath(); }, '#1976d2');
            }
        }
        
        // Cesta 2: Světlomet / Zvony / Rohy
        if (mp.path === 2) {
            if (mp.level >= 4) { // Rohy
                TDS.drawPath(ctx, function(c){ c.moveTo(0, -6); c.lineTo(16, -12); c.lineTo(16, -4); c.closePath(); }, '#ffca28');
                TDS.drawPath(ctx, function(c){ c.moveTo(0, 6); c.lineTo(16, 12); c.lineTo(16, 4); c.closePath(); }, '#ffca28');
            } else if (mp.level >= 2) { // Zrcadlo/Světlo
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 8), '#81d4fa');
            } else { // Louč
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 4), '#64dd17');
            }
        }
        
        // Cesta 3: Krystal / Kniha
        if (mp.path === 3) {
            if (mp.level === 5) { // Levitující krystal
                TDS.drawPath(ctx, function(c){ c.moveTo(0, -8); c.lineTo(8, 0); c.lineTo(0, 8); c.lineTo(-8, 0); c.closePath(); }, '#00e5ff');
            } else if (mp.level >= 2) { // Zlatá pečeť
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#ffca28');
            }
        }
    }
};

// 10. ZLATÝ DŮL
TDS.drawers.zlaty_dul = {
    base: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        let rockColor = '#757575';
        
        if (mp.path === 2 && mp.level >= 3) rockColor = '#f5f5f5'; // Mramorová banka
        if (mp.path === 2 && mp.level === 5) rockColor = '#ffca28'; // Zlatá pevnost
        if (mp.path === 3 && mp.level >= 4) rockColor = '#fff9c4'; // Bazar

        // Hora / Budova (velká)
        TDS.drawPath(ctx, function(c){ c.arc(0, 0, 26, 0, Math.PI*2); }, rockColor);

        // Vchod do dolu
        TDS.drawPath(ctx, function(c){ c.arc(16, 0, 10, -Math.PI/2, Math.PI/2); c.lineTo(16, -10); c.closePath(); }, '#212121');

        // Detaily kolejí
        if (mp.path === 1 || mp.path === 3) {
            ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(16, -4); ctx.lineTo(30, -4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(30, 4); ctx.stroke();
        }

        // Zlato před dolem
        if (mp.path === 1 && mp.level >= 2) {
            TDS.drawPath(ctx, TDS.circlePath(24, 8, 4), '#ffca28');
            TDS.drawPath(ctx, TDS.circlePath(28, 10, 3), '#ffca28');
        }

        // Cesta 3: Stany/Bazar
        if (mp.path === 3 && mp.level >= 3) {
            TDS.drawPath(ctx, TDS.rectPath(-20, -24, 16, 12, 2), '#d32f2f'); // Červený stan
            TDS.drawPath(ctx, TDS.rectPath(-20, 12, 16, 12, 2), '#1976d2'); // Modrý stan
        }
    },
    turret: function(ctx, up) {
        const mp = TDS.getMainPath(up);
        // Vozík nebo střešní detaily
        if (mp.path === 1) {
            if (mp.level === 5) { // Trpasličí koruna na vrcholu
                TDS.drawPath(ctx, function(c){ c.moveTo(-10, -10); c.lineTo(-6, -18); c.lineTo(0, -10); c.lineTo(6, -18); c.lineTo(10, -10); c.closePath(); }, '#ffca28');
            } else if (mp.level >= 3) { // Parní komín
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#424242');
                ctx.fillStyle = '#ff9800'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
            }
        }
        
        if (mp.path === 2 && mp.level >= 2) {
            // Trezor
            TDS.drawPath(ctx, TDS.rectPath(-8, -8, 16, 16, 2), '#5d4037');
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#9e9e9e'); // Kolo trezoru
        }
        
        if (mp.path === 3 && mp.level >= 1) {
            // Vozík se zlatem / krystaly
            TDS.drawPath(ctx, TDS.rectPath(20, -6, 10, 12, 1), '#795548');
            TDS.drawPath(ctx, TDS.circlePath(25, 0, 4), mp.level >= 2 ? '#00e5ff' : '#ffca28');
        }
    }
};

// ==========================================
// HRDINOVÉ
// ==========================================
TDS.heroDrawers = {
    lovec_bedrich: function(ctx, lvl, s) {
        let armor = '#795548'; // Kůže
        let bow = '#5d4037';
        if (lvl >= 10) { armor = '#4caf50'; bow = '#ffca28'; } // Zelená zbroj, zlatý luk
        if (lvl >= 20) { armor = '#ffca28'; bow = '#e0e0e0'; } // Zlatá zbroj, ocelový luk

        // Aura pro lvl 20+
        if (lvl >= 20) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI*2); ctx.fill();
        }

        // Plášť
        TDS.drawPath(ctx, function(c){ c.arc(0, 0, 12, -Math.PI/1.5, Math.PI/1.5); c.lineTo(-14, 12); c.lineTo(-14, -12); c.closePath(); }, '#388e3c');
        
        // Zbroj
        TDS.drawPath(ctx, TDS.circlePath(0, 0, 9), armor);
        TDS.drawPath(ctx, TDS.circlePath(2, 0, 5), '#ffccbc'); // Hlava

        // Luk / Kuše
        if (lvl >= 10) { // Těžká kuše
            TDS.drawPath(ctx, TDS.rectPath(6, -2, 18, 4), bow);
            TDS.drawPath(ctx, function(c){ c.moveTo(20, -14); c.quadraticCurveTo(24, 0, 20, 14); }, '#9e9e9e', TDS.OUTLINE, 3);
        } else { // Luk
            TDS.drawPath(ctx, function(c){ c.moveTo(10, -12); c.quadraticCurveTo(20, 0, 10, 12); }, bow, TDS.OUTLINE, 3);
        }

        // Zářící šíp (crit)
        if (s.crit) {
            ctx.strokeStyle = '#ff3d00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(24, 0); ctx.stroke();
        }
    },
    carodejka_radka: function(ctx, lvl, s) {
        let robe = '#1e88e5';
        let staff = '#8d6e63';
        let crystal = '#00e5ff';
        if (lvl >= 10) { robe = '#ab47bc'; staff = '#e0e0e0'; crystal = '#ea80fc'; }
        if (lvl >= 20) { robe = '#212121'; staff = '#ffca28'; crystal = '#ffff00'; }

        if (lvl >= 20) {
            ctx.fillStyle = 'rgba(234, 128, 252, 0.4)';
            ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI*2); ctx.fill();
        }

        // Tělo
        TDS.drawPath(ctx, TDS.circlePath(0, 0, 10), robe);
        TDS.drawPath(ctx, TDS.circlePath(2, 0, 5), '#ffccbc');
        
        // Vlasy
        TDS.drawPath(ctx, function(c){ c.arc(2, 0, 6, Math.PI/2, Math.PI*1.5); c.closePath(); }, '#ff9800');

        // Hůl
        TDS.drawPath(ctx, TDS.rectPath(6, -10, 14, 2), staff);
        
        // Krystal (větší při castění)
        let cr = s.casting ? 8 : 5;
        TDS.drawPath(ctx, function(c){ c.moveTo(20, -9-cr); c.lineTo(20+cr, -9); c.lineTo(20, -9+cr); c.lineTo(20-cr, -9); c.closePath(); }, crystal);

        // Blesky
        if (s.casting) {
            ctx.strokeStyle = crystal; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(20, -9); ctx.lineTo(35, -20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(20, -9); ctx.lineTo(35, 2); ctx.stroke();
        }
    },
    kronikar_oskar: function(ctx, lvl, s) {
        let robe = '#d84315';
        let book = '#5d4037';
        if (lvl >= 10) { robe = '#2e7d32'; book = '#1565c0'; }
        if (lvl >= 20) { robe = '#fff'; book = '#ffca28'; }

        if (lvl >= 20) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI*2); ctx.fill();
        }

        // Plášť
        TDS.drawPath(ctx, TDS.circlePath(0, 0, 10), robe);
        TDS.drawPath(ctx, TDS.circlePath(2, 0, 5), '#ffccbc'); // Hlava
        TDS.drawPath(ctx, TDS.circlePath(0, 0, 4), '#cfd8dc'); // Brýle

        // Kniha / Svitek (velká v rukou před ním)
        TDS.drawPath(ctx, TDS.rectPath(8, -8, 10, 16, 1), book);
        TDS.drawPath(ctx, TDS.rectPath(10, -7, 8, 14), '#fff9c4'); // Stránky
        
        // Magie z knihy
        if (s.casting) {
            ctx.fillStyle = '#ffca28';
            for(let i=0; i<3; i++) {
                ctx.beginPath(); ctx.arc(22 + i*5, -4 + (i%2)*8, 2, 0, Math.PI*2); ctx.fill();
            }
        }
    }
};

// --- HLAVNÍ API (společné pro části B a C) ---
// Katapult (nabíjení), čepová věž (otáčení) a mrazivý mág se kreslí živě,
// ostatní věžičky se berou z cache (klíč obsahuje i režim, např. maják).
const LIVE = { oblehaci_katapult: 1, cepova_vez: 1, mrazivy_mag: 1 };
TDS.tower = function(ctx, id, x, y, r, ang, ts, up, s) {
    const drawer = TDS.drawers[id];
    if (!drawer) return;
    s = s || {};
    const cacheSize = Math.ceil(r * 4);
    const baseCvs = TDS.getCache(id, 'base', up, cacheSize, (c) => drawer.base(c, up));
    ctx.save();
    if (s.buffed) {
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 64, 129, 0.3)'; ctx.fill();
    }
    ctx.drawImage(baseCvs, x - cacheSize / 2, y - cacheSize / 2);
    ctx.translate(x, y);
    if (id === 'cepova_vez') ctx.rotate(ang + ts * ((up[1] >= 4 || up[2] >= 4) ? 0.005 : 0.002));
    else ctx.rotate(ang);
    if (LIVE[id]) drawer.turret(ctx, up, s);
    else {
        const tc = TDS.getCache(id, 'turret', [...up, s.mode || ''], cacheSize, (c) => drawer.turret(c, up, s));
        ctx.drawImage(tc, -cacheSize / 2, -cacheSize / 2);
    }
    if (s.beast) {   // proměna v běsa: pulzující růžová záře (bez filtrů a blend módů)
        ctx.globalAlpha = 0.35 + Math.sin(ts * 0.012) * 0.15;
        ctx.fillStyle = '#e879f9';
        ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    if (s.firing > 0) {
        let flashDist = r;
        if (id === 'orli_ostrostrelec') flashDist = r + 15;
        if (id === 'oblehaci_katapult') flashDist = r + 5;
        ctx.globalAlpha = s.firing;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath(); ctx.arc(flashDist, 0, 8 + s.firing * 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    ctx.restore();
};

TDS._iconCache = TDS._iconCache || {};
TDS.towerIcon = function(id, size) {
    const k = id + size;
    if (TDS._iconCache[k]) return TDS._iconCache[k];
    const cvs = TDS.createCanvas(size, size);
    const ctx = cvs.getContext('2d');
    const scale = size / 60;
    ctx.scale(scale, scale);
    ctx.translate(30, 30);
    if (TDS.drawers[id]) {
        TDS.drawers[id].base(ctx, [0,0,0]);
        TDS.drawers[id].turret(ctx, [0,0,0], {});
    }
    return (TDS._iconCache[k] = cvs);
};

TDS.hero = function(ctx, id, x, y, r, ang, ts, lvl, s) {
    if (!TDS.heroDrawers[id]) return;
    
    const cacheSize = r * 4;
    // Hrdinové nemají podstavec, kreslíme je celé natočené
    const cvs = TDS.getCache(id, 'hero', [lvl, s.crit?1:0, s.casting?1:0], cacheSize, (c) => {
        TDS.heroDrawers[id](c, lvl, s);
    });

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.drawImage(cvs, -cacheSize/2, -cacheSize/2);
    ctx.restore();
};

TDS.heroIcon = function(id, size) {
    const k = 'h' + id + size;
    if (TDS._iconCache[k]) return TDS._iconCache[k];
    const cvs = TDS.createCanvas(size, size);
    const ctx = cvs.getContext('2d');
    const scale = size / 60; 
    ctx.scale(scale, scale);
    ctx.translate(30, 30);
    if (TDS.heroDrawers[id]) {
        TDS.heroDrawers[id](ctx, 1, {});
    }
    return (TDS._iconCache[k] = cvs);
};
})();
