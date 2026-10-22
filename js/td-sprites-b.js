/**
 * Obrana království - Kreslící knihovna (Část B: věže 1–5)
 * Od Gemini; zabaleno do vlastního rozsahu, kreslíře věží se slučují s ostatními částmi.
 */
(function () {
const TDS = window.TDS || (window.TDS = {});

// --- Pomocné a stavové proměnné ---
TDS.cache = TDS.cache || {}; // Cache pro offscreen canvasy statických částí
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

// --- Základní kreslící funkce (nahrazují složité API) ---
// Vlastní roundRect (protože ctx.roundRect nesmíme použít)
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

// Kreslení cesty se stínem (bez shadowBlur) a obrysem
TDS.drawPath = function(ctx, pathFunc, fillStyle, strokeStyle = TDS.OUTLINE, lineWidth = TDS.LINE_WIDTH) {
    ctx.save();
    // 1. Měkký stín (posun vpravo dole, poloprůhledná černá)
    ctx.save();
    ctx.translate(3, 3);
    ctx.beginPath(); // každý tvar je samostatná cesta
    pathFunc(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.restore();
    
    // 2. Samotný tvar
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
        else {
            ctx.beginPath();
            ctx.rect(x, y, w, h);
        }
    };
};

// Vytvoření offscreen canvasu
TDS.createCanvas = function(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

// Získání z keše nebo vykreslení
TDS.getCache = function(id, part, up, size, drawFunc) {
    const key = `${id}_${part}_${up.join('')}`;
    if (!TDS.cache[key]) {
        const cvs = TDS.createCanvas(size, size);
        const ctx = cvs.getContext('2d');
        ctx.translate(size / 2, size / 2); // Střed je v 0,0
        drawFunc(ctx);
        TDS.cache[key] = cvs;
    }
    return TDS.cache[key];
};

// --- SPECIFICKÉ VYKRESLOVÁNÍ VĚŽÍ ---
// Rozlišíme hlavní cestu (ta co je >= 3)
TDS.getMainPath = function(up) {
    for (let i = 0; i < 3; i++) {
        if (up[i] >= 3) return { path: i + 1, level: up[i] };
    }
    return { path: 0, level: Math.max(...up) }; // Základní nebo max level 2
};

TDS.drawers = Object.assign(TDS.drawers || {}, {
    // 1. KRÁLOVSKÝ LUČIŠTNÍK
    kralovsky_lucistnik: {
        base: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            // Podstavec
            let padColor = '#8d99ae';
            if (mp.path === 3 && mp.level >= 1) padColor = '#8B5A2B'; // Dřevěný stupínek cesty 3
            if (mp.path === 3 && mp.level >= 4) padColor = '#4a4e69'; // Temný kámen

            TDS.drawPath(ctx, TDS.circlePath(0, 0, 18), padColor);
            
            // Detaily podstavce (kameny/prkna)
            TDS.seed(mp.path * 10 + mp.level);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            for(let i=0; i<4; i++) {
                ctx.beginPath();
                if (padColor === '#8B5A2B') { // prkna
                    let py = -10 + i * 6;
                    ctx.moveTo(-14, py); ctx.lineTo(14, py);
                } else { // kameny
                    let a = TDS.rand() * Math.PI * 2;
                    let r = 8 + TDS.rand() * 6;
                    ctx.arc(Math.cos(a)*r, Math.sin(a)*r, 3, 0, Math.PI*2);
                }
                ctx.stroke();
            }
        },
        turret: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            
            // Barvy a styly podle vylepšení
            let cloakColor = '#388e3c'; // Základní zelená
            let bowColor = '#d4a373'; // Dřevěný luk
            let armor = false;
            let arrows = 1;
            let crossbow = false;

            // Cesta 1: Kované hroty, Trojitá salva, Pán větrného luku
            if (up[0] >= 1) armor = true;
            if (up[0] >= 3) { cloakColor = '#1976d2'; arrows = 3; }
            if (up[0] >= 4) armor = '#b0bec5'; // Kroužková
            if (up[0] >= 5) { armor = '#ffd54f'; bowColor = '#ffffff'; } // Zlatá, bílý luk

            // Cesta 2: Hbité prsty, Blesková salva, Mistr tisíce šípů
            if (up[1] >= 3) cloakColor = '#d32f2f'; // Sokolí oko (červená)
            if (up[1] >= 4) { bowColor = '#ffb300'; arrows = 2; }
            if (up[1] >= 5) { cloakColor = '#00acc1'; arrows = 5; } // Větrný vír

            // Cesta 3: Těžká kuše, Lovec slizových králů
            if (up[2] >= 2) cloakColor = '#1b5e20'; // Sovy
            if (up[2] >= 3) { crossbow = true; bowColor = '#5d4037'; }
            if (up[2] >= 4) { bowColor = '#455a64'; } // Ocelový arbalest
            if (up[2] >= 5) { cloakColor = '#4a148c'; bowColor = '#212121'; armor = '#4a148c'; } // Fialová zbroj

            // Kreslení Těla / Pláště
            TDS.drawPath(ctx, function(c) {
                c.beginPath();
                c.arc(0, 0, 10, -Math.PI/2, Math.PI/2);
                c.lineTo(-8, 8); c.lineTo(-8, -8); c.closePath();
            }, cloakColor);

            // Zbroj
            if (armor) {
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 8), typeof armor === 'string' ? armor : '#a1887f');
            }

            // Hlava
            TDS.drawPath(ctx, TDS.circlePath(2, 0, 6), '#ffccbc');
            
            // Oči (Sovy v očích svítí)
            if (up[2] >= 2 && mp.path === 3) {
                ctx.fillStyle = '#ffb300';
                ctx.fillRect(4, -3, 2, 2); ctx.fillRect(4, 1, 2, 2);
            }

            // Zbraň (Luk nebo Kuše)
            if (crossbow) {
                // Tělo kuše
                TDS.drawPath(ctx, TDS.rectPath(6, -2, 16, 4), bowColor);
                // Lučiště
                TDS.drawPath(ctx, function(c) {
                    c.beginPath(); c.moveTo(18, -12); c.quadraticCurveTo(22, 0, 18, 12);
                }, bowColor, TDS.OUTLINE, 3);
            } else {
                // Luk
                let bowScale = (up[2] >= 1) ? 1.5 : 1; // Dlouhý luk
                TDS.drawPath(ctx, function(c) {
                    c.beginPath(); c.moveTo(10, -12 * bowScale); c.quadraticCurveTo(20, 0, 10, 12 * bowScale);
                }, bowColor, TDS.OUTLINE, 3);
            }

            // Šípy (pokud nestřílí, drží je; pokud střílí, animujeme jinde, zde jako připravené)
            ctx.strokeStyle = (up[1]>=4) ? '#ffd54f' : '#fff'; // Zlaté letky
            ctx.lineWidth = 1.5;
            for(let i=0; i<arrows; i++) {
                let offset = (i - (arrows-1)/2) * 3;
                ctx.beginPath();
                if(crossbow) {
                    ctx.moveTo(8, offset); ctx.lineTo(24, offset);
                } else {
                    ctx.moveTo(2, offset); ctx.lineTo(16, offset);
                }
                ctx.stroke();
            }
        }
    },

    // 2. ČEPOVÁ VĚŽ
    cepova_vez: {
        base: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            let baseColor = '#5d4037';
            if (mp.path === 1 && mp.level >= 4) baseColor = '#b71c1c'; // Ohnivá
            if (mp.path === 2 && mp.level >= 2) baseColor = '#455a64'; // Těžké čepy
            if (mp.path === 3 && mp.level >= 3) baseColor = '#ffb300'; // Drtič obrů (zlato-černá)
            
            // Podstavec kruh
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 20), baseColor);
            
            // Zuby nebo nýty po obvodu
            ctx.fillStyle = '#9e9e9e';
            for(let i=0; i<8; i++) {
                ctx.save();
                ctx.rotate(i * Math.PI / 4);
                TDS.drawPath(ctx, TDS.rectPath(16, -3, 6, 6, 2), '#9e9e9e');
                ctx.restore();
            }
        },
        turret: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            
            let coreColor = '#795548';
            let spikeCount = 4;
            let spikeLen = 8;
            let fire = false;
            let buzzsaw = false;
            
            if (up[0] >= 2) fire = true;
            if (up[0] >= 5) coreColor = '#212121'; // Sopečná výheň
            
            if (up[1] >= 1) spikeLen = 14; // Silnější pružiny
            if (up[1] >= 3) buzzsaw = true;
            if (up[1] >= 5) coreColor = '#ffc107'; // Královský mlýnek

            if (up[2] >= 1) spikeCount = 8; // Více střílen
            if (up[2] >= 2) spikeCount = 12; // Ježkova hradba
            if (up[2] >= 5) spikeCount = 16; // Pevnost tisíce hrotů

            // Oheň pod věží (Cesta 1)
            if (fire) {
                TDS.drawPath(ctx, function(c) {
                    for(let i=0; i<8; i++) {
                        let a = i * Math.PI/4;
                        c.moveTo(0,0);
                        c.lineTo(Math.cos(a-0.2)*18, Math.sin(a-0.2)*18);
                        c.lineTo(Math.cos(a)*26, Math.sin(a)*26);
                        c.lineTo(Math.cos(a+0.2)*18, Math.sin(a+0.2)*18);
                    }
                }, '#ff5722', null, 0); // Bez obrysu
            }

            // Hroty nebo pily
            for(let i=0; i<spikeCount; i++) {
                ctx.save();
                ctx.rotate(i * (Math.PI * 2 / spikeCount));
                if (buzzsaw) {
                    // Kotouč
                    TDS.drawPath(ctx, TDS.circlePath(16, 0, 6), '#e0e0e0');
                    ctx.fillStyle = '#616161';
                    for(let j=0; j<4; j++) {
                        ctx.beginPath(); ctx.arc(16 + Math.cos(j*Math.PI/2)*6, Math.sin(j*Math.PI/2)*6, 2, 0, Math.PI*2); ctx.fill();
                    }
                } else {
                    // Ocelový hrot
                    TDS.drawPath(ctx, function(c) {
                        c.beginPath(); c.moveTo(10, -3); c.lineTo(10+spikeLen, 0); c.lineTo(10, 3); c.closePath();
                    }, '#bdbdbd');
                }
                ctx.restore();
            }

            // Tělo věže
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 14), coreColor);
            
            // Středový detail (koruna, komín)
            if (up[2] >= 5) {
                // Koruna
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#ffd54f');
            } else if (fire) {
                // Láva / Výheň
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#ffeb3b');
            } else {
                TDS.drawPath(ctx, TDS.circlePath(0, 0, 6), '#424242');
            }
        }
    },

    // 3. MRAZIVÝ MÁG
    mrazivy_mag: {
        base: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            // Ledový hexagon
            TDS.drawPath(ctx, function(c) {
                c.beginPath();
                for(let i=0; i<6; i++) {
                    let a = i * Math.PI / 3;
                    c.lineTo(Math.cos(a)*20, Math.sin(a)*20);
                }
                c.closePath();
            }, '#b3e5fc');

            // Cesta 2: Polární aura (sníh okolo)
            if (mp.path === 2 && mp.level >= 3) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
            }
            
            // Cesta 1: Runa křehkosti
            if (mp.path === 1 && mp.level >= 3) {
                ctx.strokeStyle = '#0288d1'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke();
            }
        },
        turret: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            let robe = '#29b6f6';
            let staff = '#8d6e63';
            let crystal = '#e1f5fe';
            let aura = false;

            if (up[0] >= 4) robe = '#ffffff'; // Pán jinovatky (bílý hermelín)
            if (up[0] >= 5) { robe = '#81d4fa'; crystal = '#01579b'; } // Král věčné zimy
            
            if (up[2] >= 3) robe = '#0277bd'; // Krupobití rampouchů
            if (up[2] >= 4) { robe = '#b0bec5'; staff = '#e1f5fe'; } // Ledová zbroj, ledové kopí

            // Plášť
            TDS.drawPath(ctx, function(c) {
                c.beginPath(); c.arc(0, 0, 10, -Math.PI/1.5, Math.PI/1.5);
                c.lineTo(-12, 10); c.lineTo(-12, -10); c.closePath();
            }, robe);

            // Hlava / Kapuce
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 7), up[0]>=5 ? '#e1f5fe' : '#29b6f6');
            if (up[0] < 5) TDS.drawPath(ctx, TDS.circlePath(2, 0, 4), '#ffccbc'); // Obličej

            // Cesta 3: Rampouchy na rukávech
            if (up[2] >= 3) {
                TDS.drawPath(ctx, function(c){ c.moveTo(0,-10); c.lineTo(8,-14); c.lineTo(4,-8); }, '#e1f5fe');
                TDS.drawPath(ctx, function(c){ c.moveTo(0,10); c.lineTo(8,14); c.lineTo(4,8); }, '#e1f5fe');
            }

            // Hůl
            if (up[2] >= 4) {
                // Ledové kopí (Cesta 3 lvl 4+)
                TDS.drawPath(ctx, function(c){ c.moveTo(2, -8); c.lineTo(24, 0); c.lineTo(2, 8); c.closePath(); }, '#81d4fa');
            } else if (up[2] >= 2) {
                // Zkřížené čepele
                TDS.drawPath(ctx, TDS.rectPath(6, -1, 16, 2), staff);
                TDS.drawPath(ctx, function(c){ c.moveTo(18, -6); c.lineTo(26, 0); c.lineTo(18, 6); }, crystal);
            } else {
                // Klasická hůl
                TDS.drawPath(ctx, TDS.rectPath(6, -1.5, 14, 3), staff);
                // Krystal na konci
                let cr = (up[0] >= 1) ? 5 : 3;
                TDS.drawPath(ctx, function(c) {
                    c.moveTo(20, -cr); c.lineTo(20+cr, 0); c.lineTo(20, cr); c.lineTo(20-cr, 0); c.closePath();
                }, crystal);
            }

            // Cesta 2: Sněhový mrak / aura
            if (mp.path === 2 && mp.level >= 4) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
            }
        }
    },

    // 4. ORLÍ OSTROSTŘELEC
    orli_ostrostrelec: {
        base: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            let color = '#8d6e63'; // Dřevěná hláska
            if (mp.path === 1 && mp.level >= 3) color = '#78909c'; // Trpasličí ocel/kámen
            if (mp.path === 2 && mp.level >= 5) color = '#fff59d'; // Zlatem zdobená věž

            // Vysoká hláska = velký čtverec, perspektiva shora
            TDS.drawPath(ctx, TDS.rectPath(-16, -16, 32, 32, 4), color);
            
            // Ochoz / kříže (detaily)
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-12, -12); ctx.lineTo(12, 12);
            ctx.moveTo(12, -12); ctx.lineTo(-12, 12);
            ctx.stroke();

            // Cesta 2: Bidýlko / Odrážedlo
            if (mp.path === 2 && mp.level >= 3) {
                TDS.drawPath(ctx, TDS.rectPath(-18, -4, 4, 8), '#5d4037');
                // Orel (zjednodušený)
                TDS.drawPath(ctx, function(c){ c.moveTo(-16, -2); c.lineTo(-20, 0); c.lineTo(-16, 2); }, '#ffb300');
            }
        },
        turret: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            let hat = '#4caf50'; // Hraničářská čapka
            let gunWood = '#5d4037';
            let gunMetal = '#9e9e9e';
            let length = 18;
            let w1 = 3, w2 = 2; // tloušťky hlavně
            let isMech = false;

            if (up[0] >= 1) { gunMetal = '#ffca28'; length = 22; } // Mosaz
            if (up[0] >= 3) { gunWood = '#455a64'; gunMetal = '#424242'; w1 = 5; w2 = 4; } // Průrazná
            if (up[0] >= 5) { hat = '#b71c1c'; gunWood = '#212121'; gunMetal = '#f44336'; } // Dračí

            if (up[2] >= 3) isMech = true; // Opakovací buben
            if (up[2] >= 4) { w1 = 7; w2 = 6; } // Varhany (široká)
            if (up[2] >= 5) { gunWood = '#cfd8dc'; gunMetal = '#cfd8dc'; length = 20; isMech = true; } // Parní

            // Střelec
            TDS.drawPath(ctx, TDS.circlePath(0, 0, 7), hat);
            
            // Pažba
            TDS.drawPath(ctx, TDS.rectPath(6, -2, 6, 4), gunWood);
            
            // Buben (Cesta 3)
            if (isMech) {
                TDS.drawPath(ctx, TDS.circlePath(10, 0, 4), '#757575');
            }

            // Hlaveň
            TDS.drawPath(ctx, function(c) {
                c.beginPath(); c.moveTo(12, -w1/2); c.lineTo(12+length, -w2/2);
                c.lineTo(12+length, w2/2); c.lineTo(12, w1/2); c.closePath();
            }, gunMetal);

            // Cesta 2: Dalekohled
            if (up[1] >= 1) {
                TDS.drawPath(ctx, TDS.rectPath(12, -4, 8, 2), '#ffca28');
                ctx.fillStyle = '#64dd17'; ctx.fillRect(18, -4, 2, 2); // Zelená čočka
            }
        }
    },

    // 5. OBLÉHACÍ KATAPULT
    oblehaci_katapult: {
        base: function(ctx, up) {
            const mp = TDS.getMainPath(up);
            let frame = '#5d4037';
            if (mp.path === 1 && mp.level >= 3) frame = '#ff9800'; // Bronzový moždíř (podstava)
            if (mp.path === 1 && mp.level >= 5) frame = '#212121'; // Černo-zlaté
            if (mp.path === 2 && mp.level >= 3) frame = '#4e342e'; // Balista podstava
            if (mp.path === 2 && mp.level >= 5) frame = '#b71c1c'; // Černo-rudý pancíř

            // H-rám
            TDS.drawPath(ctx, TDS.rectPath(-12, -15, 24, 6, 2), frame);
            TDS.drawPath(ctx, TDS.rectPath(-12, 9, 24, 6, 2), frame);
            TDS.drawPath(ctx, TDS.rectPath(-6, -10, 12, 20, 2), frame);

            // Kola pro rumpál (Cesta 2 lvl 1+)
            if (up[1] >= 1 && mp.path !== 1) {
                TDS.drawPath(ctx, TDS.circlePath(-4, -12, 6), '#9e9e9e');
                TDS.drawPath(ctx, TDS.circlePath(-4, 12, 6), '#9e9e9e');
            }
        },
        turret: function(ctx, up, s) {
            const mp = TDS.getMainPath(up);
            let cock = s.cock || 0; // 0 = v klidu, 1 = nataženo
            
            // Cesta 1 Lvl 3+: Moždíř / Dělo (nekreslíme rameno, jen masivní hlaveň)
            if (mp.path === 1 && mp.level >= 3) {
                let color = mp.level >= 5 ? '#212121' : '#ff9800';
                let recoil = cock * -6; // Zpětný ráz
                
                TDS.drawPath(ctx, function(c) {
                    c.beginPath();
                    c.moveTo(-10 + recoil, -10); c.lineTo(16 + recoil, -6);
                    c.lineTo(16 + recoil, 6); c.lineTo(-10 + recoil, 10); c.closePath();
                }, color);
                // Ústí
                TDS.drawPath(ctx, TDS.rectPath(16 + recoil, -8, 6, 16, 2), mp.level>=5 ? '#ffca28' : '#e65100');
                return;
            }

            // Cesta 2 Lvl 3+: Balista
            if (mp.path === 2 && mp.level >= 3) {
                let tension = cock * -8;
                // Lučiště
                TDS.drawPath(ctx, function(c) {
                    c.beginPath(); c.moveTo(10+tension, -18); c.lineTo(14, 0); c.lineTo(10+tension, 18);
                }, '#795548', TDS.OUTLINE, 4);
                // Tětiva
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(10+tension, -18); ctx.lineTo(-4+tension, 0); ctx.lineTo(10+tension, 18); ctx.stroke();
                // Šipka / Kopí (když je nataženo nebo se nabíjí)
                if (cock > 0.1) {
                    TDS.drawPath(ctx, function(c){ c.moveTo(-4+tension, 0); c.lineTo(18, 0); }, '#fff', TDS.OUTLINE, 2);
                    TDS.drawPath(ctx, function(c){ c.moveTo(18, -3); c.lineTo(24, 0); c.lineTo(18, 3); c.closePath(); }, '#9e9e9e');
                }
                return;
            }

            // Klasický katapult (s ramenem)
            let armLen = (up[2] >= 1) ? 22 : 16;
            let px = Math.cos(-cock * 1.5) * armLen;
            let py = Math.sin(-cock * 1.5) * armLen;

            // Protizávaží
            TDS.drawPath(ctx, TDS.rectPath(-10, -6, 8, 12, 2), '#757575');

            // Rameno (střed v 0,0, natahuje se nahoru)
            // U top-down je natažení vizualizováno zkrácením / posunem
            ctx.save();
            ctx.rotate(cock * -0.5); // rotace ramene mírně dozadu
            
            TDS.drawPath(ctx, TDS.rectPath(0, -2, armLen, 4), '#795548');
            
            // Lžíce
            TDS.drawPath(ctx, TDS.circlePath(armLen, 0, 6), '#5d4037');
            
            // Soudek (pokud není plně vystřeleno)
            if (cock > 0.1) {
                let r = (up[0] >= 1) ? 5 : 3.5;
                let bColor = (up[2] >= 2) ? '#616161' : '#d84315'; // Kamenné střepiny = šedá, jinak červený soudek
                TDS.drawPath(ctx, TDS.circlePath(armLen, 0, r), bColor);
            }
            
            ctx.restore();
        }
    }
});


// --- HLAVNÍ API ---

/**
 * Vykreslí věž
 * @param {CanvasRenderingContext2D} ctx - Kontext pro kreslení
 * @param {string} id - Identifikátor věže (kralovsky_lucistnik, ...)
 * @param {number} x - X pozice na mapě
 * @param {number} y - Y pozice na mapě
 * @param {number} r - Poloměr (pro měřítko a keš, typicky kolem 20)
 * @param {number} ang - Úhel natočení v radiánech
 * @param {number} ts - Časová značka v ms
 * @param {Array} up - Pole 3 čísel [c1, c2, c3] (úrovně 0-5)
 * @param {Object} s - Stav věže (cock, mode, beast, buffed, firing)
 */
TDS.tower = function(ctx, id, x, y, r, ang, ts, up, s) {
    if (!TDS.drawers[id]) return;

    const drawer = TDS.drawers[id];
    const cacheSize = r * 4; // Dostatečně velké pro přesahy

    // 1. Podstavec (statický, rotace 0, kešovaný)
    const baseCvs = TDS.getCache(id, 'base', up, cacheSize, (c) => drawer.base(c, up));
    
    ctx.save();
    
    // Globální efekty (např. posílení lektvarem)
    if (s.buffed) {
        ctx.shadowColor = '#ff4081';
        ctx.shadowBlur = 10; // Zde výjimečně pro buff efekt? Zadání říká "Žádné shadowBlur každý snímek", tak radši uděláme auru bez bluru
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(x, y, r+4, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255, 64, 129, 0.3)'; ctx.fill();
    }
    if (s.beast) {
        ctx.filter = 'saturate(200%) hue-rotate(300deg)'; // Beast mode - zadání zakazuje filter, odstraníme a nahradíme alfou
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'hard-light';
    }

    ctx.drawImage(baseCvs, x - cacheSize/2, y - cacheSize/2);

    // 2. Věžička (rotující, částečně kešovaná/dynamická)
    ctx.translate(x, y);
    
    // Některé věže rotují kontinuálně (Čepová věž)
    if (id === 'cepova_vez') {
        let speed = (up[1] >= 4 || up[2] >= 4) ? 0.005 : 0.002;
        ctx.rotate(ang + ts * speed);
    } else {
        ctx.rotate(ang);
    }

    // Katapult se musí kreslit dynamicky kvůli 's.cock', ostatní lze kešovat
    if (id === 'oblehaci_katapult' || id === 'cepova_vez' || id === 'mrazivy_mag') {
        drawer.turret(ctx, up, s);
    } else {
        const turretCvs = TDS.getCache(id, 'turret', up, cacheSize, (c) => drawer.turret(c, up, {}));
        ctx.drawImage(turretCvs, -cacheSize/2, -cacheSize/2);
    }

    // 3. Efekt výstřelu (záblesk)
    if (s.firing > 0) {
        ctx.globalAlpha = s.firing;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        // Zjednodušený záblesk před věží
        let flashDist = r;
        if (id === 'orli_ostrostrelec') flashDist = r + 15;
        if (id === 'oblehaci_katapult') flashDist = r + 5;
        
        ctx.arc(flashDist, 0, 8 + s.firing*4, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
};

/**
 * Vykreslí ikonu věže bez vylepšení pro obchod
 */
TDS._iconCache = TDS._iconCache || {};
TDS.towerIcon = function(id, size) {
    if (TDS._iconCache[id + size]) return TDS._iconCache[id + size];
    const cvs = TDS.createCanvas(size, size);
    const ctx = cvs.getContext('2d');
    const scale = size / 60; // Základní r je cca 20, plocha cca 60x60
    ctx.scale(scale, scale);
    ctx.translate(30, 30);
    
    if (TDS.drawers[id]) {
        TDS.drawers[id].base(ctx, [0,0,0]);
        TDS.drawers[id].turret(ctx, [0,0,0], {});
    }
    TDS._iconCache[id + size] = cvs;
    return cvs;
};
})();
