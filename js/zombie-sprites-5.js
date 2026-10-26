/**
 * ============================================================================
 * ZOMBIE SURVIVAL - SPRITE LIBRARY (DOPLNĚK Č. 5: BOSS "KRÁL HNÍZDA" A MECHANIKY)
 * ============================================================================
 * Rozšiřuje objekt window.ZS o vykreslování bosse, totemů, projektilů a pastí.
 * Styl: Top-down 2D, světlo shora zleva (-1, -1), měkké stíny, offscreen cache.
 * Nevyžaduje žádné externí obrázky (čisté HTML5 Canvas 2D API).
 *
 * PŘEHLED FUNKCÍ A PARAMETRŮ:
 * ----------------------------------------------------------------------------
 * 1) ZS.king(ctx, x, y, r, angle, ts, phase, shield, hitFlash)
 *    - Vykreslí obřího zombie bosse "Krále hnízda" s korunou a pláštěm.
 *    - ctx      : CanvasRenderingContext2D
 *    - x, y     : Střed bosse na plátně (px)
 *    - r        : Poloměr těla bosse (ve hře typicky 36 px)
 *    - angle    : Směr pohledu v radiánech (0 = doprava)
 *    - ts       : Časové razítko (performance.now()) pro animace
 *    - phase    : Fáze boje (1 = fialová aura, 2 = klidnější, 3 = zuřící červená aura + praskliny)
 *    - shield   : Boolean (true = aktivní modrá hex-energetická bublina o poloměru ~1.45 * r)
 *    - hitFlash : Number (0..1) intenzita bílého bliknutí po zásahu
 *
 * 2) ZS.totem(ctx, x, y, r, ts, hpPct)
 *    - Vykreslí fialový krystalový totem na kamenném podstavci.
 *    - ctx      : CanvasRenderingContext2D
 *    - x, y     : Střed podstavce totemu (px)
 *    - r        : Poloměr podstavce (typicky 22 px)
 *    - ts       : Časové razítko (performance.now())
 *    - hpPct    : Životy totemu (1.0 = plné HP a silná záře, 0.0 = zničený, plný prasklin, bez záře)
 *
 * 3) ZS.skull(ctx, x, y, h, ts)
 *    - Vykreslí letící prokletou lebku v plamenech a její stín na zemi.
 *    - ctx      : CanvasRenderingContext2D
 *    - x, y     : Pozice stínu na zemi (px)
 *    - h        : Výška lebky nad zemí v px (vykreslí se na [x, y - h])
 *    - ts       : Časové razítko (performance.now())
 *
 * 4) ZS.poisonPool(ctx, x, y, fade, ts, big)
 *    - Vykreslí probublávající fialovou jedovatou louži.
 *    - ctx      : CanvasRenderingContext2D
 *    - x, y     : Střed louže (px)
 *    - fade     : Number (1..0) průhlednost a postupné smršťování při mizení
 *    - ts       : Časové razítko (performance.now())
 *    - big      : Boolean (true = velká louže po lebce ~52x36 px, false = menší stopa ~36x26 px)
 *
 * 5) ZS.grave(ctx, x, y, p, ts)
 *    - Vykreslí otevírající se hrob s náhrobkem, ze kterého vylézá zombie ruka.
 *    - ctx      : CanvasRenderingContext2D
 *    - x, y     : Střed hrobu (px)
 *    - p        : Průběh animace (0..1): 0 = kypící hlína, 0.5 = prasklina a ruka, 1 = zmizení
 *    - ts       : Časové razítko (performance.now())
 * ============================================================================
 */

(function () {
    'use strict';

    window.ZS = window.ZS || {};

    // Interní úložiště pro předkreslené statické části (offscreen canvasy)
    const _cache = {};

    /**
     * Pomocná funkce pro získání nebo vytvoření předkresleného offscreen canvasu.
     */
    function getCachedCanvas(key, width, height, drawFn) {
        if (!_cache[key]) {
            const c = document.createElement('canvas');
            c.width = Math.ceil(width);
            c.height = Math.ceil(height);
            const cCtx = c.getContext('2d');
            drawFn(cCtx, c.width, c.height);
            _cache[key] = c;
        }
        return _cache[key];
    }

    /**
     * Pomocná funkce pro omezení hodnoty do rozsahu <min, max>
     */
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    // ========================================================================
    // 1) ZS.king - Obří zombie boss "Král hnízda"
    // ========================================================================

    function getKingBodyCache(r) {
        const size = Math.ceil(r * 3.2);
        return getCachedCanvas('king_body_' + r, size, size, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.translate(cx, cy);

            // 1. Roztrhaný královský plášť (vzadu za tělem, mírně vlevo)
            ctx.save();
            ctx.fillStyle = '#2d0e38';
            ctx.strokeStyle = '#180520';
            ctx.lineWidth = r * 0.05;
            ctx.beginPath();
            ctx.moveTo(-r * 0.3, -r * 0.85);
            ctx.quadraticCurveTo(-r * 1.25, -r * 0.6, -r * 1.15, -r * 0.2);
            ctx.lineTo(-r * 0.85, -r * 0.05);
            ctx.lineTo(-r * 1.25, r * 0.25);
            ctx.lineTo(-r * 0.9, r * 0.45);
            ctx.lineTo(-r * 1.15, r * 0.75);
            ctx.quadraticCurveTo(-r * 0.6, r * 0.95, -r * 0.3, r * 0.85);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Stín a špína na plášti
            const capeGrad = ctx.createRadialGradient(-r * 0.4, -r * 0.3, r * 0.1, -r * 0.7, r * 0.2, r * 1.1);
            capeGrad.addColorStop(0, 'rgba(90, 35, 110, 0.5)');
            capeGrad.addColorStop(1, 'rgba(10, 2, 15, 0.7)');
            ctx.fillStyle = capeGrad;
            ctx.fill();
            ctx.restore();

            // 2. Mohutný trup a ramena (pohled shora, světlo shora zleva)
            ctx.save();
            const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
            bodyGrad.addColorStop(0, '#6a8262');   // Nasvícená zombí kůže
            bodyGrad.addColorStop(0.55, '#465940'); // Střední tón
            bodyGrad.addColorStop(1, '#222e1f');    // Stín dole vpravo

            ctx.fillStyle = bodyGrad;
            ctx.strokeStyle = '#161f14';
            ctx.lineWidth = r * 0.06;

            // Tvar trupu (široká ramena nahoře a dole, jelikož 0 rad = doprava)
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 0.82, r * 1.02, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Svalové boule na ramenou (horní = levé rameno, dolní = pravé rameno)
            const drawShoulder = (sy, isLit) => {
                ctx.beginPath();
                ctx.ellipse(r * 0.05, sy, r * 0.48, r * 0.42, (sy < 0 ? -0.2 : 0.2), 0, Math.PI * 2);
                const sGrad = ctx.createRadialGradient(
                    -r * 0.1, sy - r * 0.15, r * 0.05,
                    r * 0.05, sy, r * 0.48
                );
                sGrad.addColorStop(0, isLit ? '#7a9470' : '#586e51');
                sGrad.addColorStop(1, '#283625');
                ctx.fillStyle = sGrad;
                ctx.fill();
                ctx.stroke();
            };
            drawShoulder(-r * 0.68, true);
            drawShoulder(r * 0.68, false);

            // 3. Královský kožešinový límec (hermelín - špinavý, zakrvácený)
            ctx.beginPath();
            ctx.ellipse(-r * 0.18, 0, r * 0.45, r * 0.78, 0, 0, Math.PI * 2);
            const furGrad = ctx.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.3, r * 0.6);
            furGrad.addColorStop(0, '#d8d2c5');
            furGrad.addColorStop(0.6, '#9e9585');
            furGrad.addColorStop(1, '#595247');
            ctx.fillStyle = furGrad;
            ctx.strokeStyle = '#332e27';
            ctx.lineWidth = r * 0.04;
            ctx.fill();
            ctx.stroke();

            // Černé skvrnky na hermelínu
            ctx.fillStyle = '#26221e';
            const spots = [
                [-0.45, -0.4], [-0.35, -0.1], [-0.48, 0.2], [-0.3, 0.45],
                [-0.2, -0.55], [-0.15, 0.6]
            ];
            spots.forEach(([sx, sy]) => {
                ctx.beginPath();
                ctx.ellipse(sx * r, sy * r, r * 0.05, r * 0.03, sx, 0, Math.PI * 2);
                ctx.fill();
            });

            // 4. Fialové vředy / mutace hnízda na zádech a ramenou
            const cysts = [
                { x: -0.05, y: -0.78, cr: 0.16 },
                { x: -0.22, y: -0.62, cr: 0.11 },
                { x: 0.08, y: 0.72, cr: 0.15 },
                { x: -0.15, y: 0.55, cr: 0.10 }
            ];
            cysts.forEach(c => {
                const cxPos = c.x * r, cyPos = c.y * r, cr = c.cr * r;
                const cGrad = ctx.createRadialGradient(cxPos - cr * 0.3, cyPos - cr * 0.3, cr * 0.1, cxPos, cyPos, cr);
                cGrad.addColorStop(0, '#e08aff');
                cGrad.addColorStop(0.5, '#8829b5');
                cGrad.addColorStop(1, '#310a45');
                ctx.fillStyle = cGrad;
                ctx.beginPath();
                ctx.arc(cxPos, cyPos, cr, 0, Math.PI * 2);
                ctx.fill();
            });

            // Zlatá spona pláště vpředu na hrudi
            ctx.beginPath();
            ctx.arc(r * 0.28, 0, r * 0.14, 0, Math.PI * 2);
            const buckleGrad = ctx.createRadialGradient(r * 0.24, -r * 0.04, r * 0.02, r * 0.28, 0, r * 0.14);
            buckleGrad.addColorStop(0, '#fff2a6');
            buckleGrad.addColorStop(0.5, '#d49b17');
            buckleGrad.addColorStop(1, '#6e4803');
            ctx.fillStyle = buckleGrad;
            ctx.fill();
            ctx.stroke();

            // Drahokam ve sponě
            ctx.fillStyle = '#a832ff';
            ctx.beginPath();
            ctx.arc(r * 0.28, 0, r * 0.07, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    function getKingHeadCache(r) {
        const size = Math.ceil(r * 1.8);
        return getCachedCanvas('king_head_' + r, size, size, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.translate(cx, cy);

            const hr = r * 0.52; // Poloměr hlavy

            // Stín pod hlavou
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.arc(hr * 0.1, hr * 0.12, hr * 1.05, 0, Math.PI * 2);
            ctx.fill();

            // Hlava (lebka / zombí kůže)
            const headGrad = ctx.createRadialGradient(-hr * 0.3, -hr * 0.3, hr * 0.1, 0, 0, hr);
            headGrad.addColorStop(0, '#7c9673');
            headGrad.addColorStop(0.65, '#4c6146');
            headGrad.addColorStop(1, '#253022');

            ctx.fillStyle = headGrad;
            ctx.strokeStyle = '#172115';
            ctx.lineWidth = r * 0.05;
            ctx.beginPath();
            ctx.arc(0, 0, hr, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Jizva přes čelo
            ctx.strokeStyle = '#2d141c';
            ctx.lineWidth = r * 0.03;
            ctx.beginPath();
            ctx.moveTo(hr * 0.1, -hr * 0.6);
            ctx.lineTo(hr * 0.45, -hr * 0.15);
            ctx.stroke();

            // Oční důlky (základ pro žhnoucí oči)
            ctx.fillStyle = '#14081c';
            ctx.beginPath();
            ctx.ellipse(hr * 0.58, -hr * 0.34, hr * 0.18, hr * 0.24, 0.25, 0, Math.PI * 2);
            ctx.ellipse(hr * 0.58, hr * 0.34, hr * 0.18, hr * 0.24, -0.25, 0, Math.PI * 2);
            ctx.fill();

            // ================================================================
            // ZLATÁ KORUNA (pohled přímo shora - výrazná, s fialovými drahokamy)
            // ================================================================
            ctx.save();
            ctx.translate(-hr * 0.08, 0); // Mírně posunutá k temeni, aby byly vidět oči vpředu

            const crOuter = hr * 0.88;
            const crInner = hr * 0.45;
            const numPoints = 8;

            // Stín pod korunou
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(hr * 0.08, hr * 0.08, crOuter * 0.95, 0, Math.PI * 2);
            ctx.fill();

            // Samotový vnitřek koruny (královská fialovo-vínová čapka uvnitř)
            const velvetGrad = ctx.createRadialGradient(-crInner * 0.3, -crInner * 0.3, crInner * 0.1, 0, 0, crInner * 1.2);
            velvetGrad.addColorStop(0, '#731963');
            velvetGrad.addColorStop(1, '#290522');
            ctx.fillStyle = velvetGrad;
            ctx.beginPath();
            ctx.arc(0, 0, crInner * 1.25, 0, Math.PI * 2);
            ctx.fill();

            // Zlatá hvězdice koruny (cípy směřující ven + obruč)
            const goldGrad = ctx.createLinearGradient(-crOuter, -crOuter, crOuter, crOuter);
            goldGrad.addColorStop(0, '#fff6b3');   // Ostrý odlesk vlevo nahoře
            goldGrad.addColorStop(0.3, '#f5c43d'); // Jasné zlato
            goldGrad.addColorStop(0.7, '#b87b12'); // Stín zlata
            goldGrad.addColorStop(1, '#694104');   // Tmavý okraj vpravo dole

            ctx.fillStyle = goldGrad;
            ctx.strokeStyle = '#3d2400';
            ctx.lineWidth = r * 0.04;

            ctx.beginPath();
            for (let i = 0; i < numPoints * 2; i++) {
                const a = (i * Math.PI) / numPoints;
                const rad = (i % 2 === 0) ? crOuter : crInner * 1.15;
                const px = Math.cos(a) * rad;
                const py = Math.sin(a) * rad;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Vnitřní zlatá obruč pro 3D hloubku
            ctx.strokeStyle = '#ffea85';
            ctx.lineWidth = r * 0.035;
            ctx.beginPath();
            ctx.arc(0, 0, crInner * 1.08, 0, Math.PI * 2);
            ctx.stroke();

            // Zlatý křížek / klenot uprostřed koruny
            ctx.fillStyle = goldGrad;
            ctx.beginPath();
            ctx.arc(0, 0, crInner * 0.38, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Fialové drahokamy na špičkách cípů a ve středu
            const drawGem = (gx, gy, gr) => {
                //Lůžko drahokamu
                ctx.fillStyle = '#240430';
                ctx.beginPath();
                ctx.arc(gx, gy, gr * 1.2, 0, Math.PI * 2);
                ctx.fill();

                // Fialový ametyst
                const gemGrad = ctx.createRadialGradient(gx - gr * 0.3, gy - gr * 0.3, gr * 0.1, gx, gy, gr);
                gemGrad.addColorStop(0, '#f6baff');
                gemGrad.addColorStop(0.45, '#b726ff');
                gemGrad.addColorStop(1, '#4a0670');
                ctx.fillStyle = gemGrad;
                ctx.beginPath();
                ctx.arc(gx, gy, gr, 0, Math.PI * 2);
                ctx.fill();

                // Bílý odlesk
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.arc(gx - gr * 0.32, gy - gr * 0.32, gr * 0.28, 0, Math.PI * 2);
                ctx.fill();
            };

            for (let i = 0; i < numPoints; i++) {
                const a = (i * Math.PI * 2) / numPoints;
                const gx = Math.cos(a) * (crOuter * 0.78);
                const gy = Math.sin(a) * (crOuter * 0.78);
                drawGem(gx, gy, r * 0.075);
            }
            // Centrální velký drahokam na vrcholu koruny
            drawGem(0, 0, r * 0.11);

            ctx.restore();
        });
    }

    function getKingShieldCache(r) {
        const sr = Math.ceil(r * 1.45);
        const size = sr * 2 + 12;
        return getCachedCanvas('king_shield_' + r, size, size, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;

            ctx.save();
            // Ořez na kruh štítu
            ctx.beginPath();
            ctx.arc(cx, cy, sr, 0, Math.PI * 2);
            ctx.clip();

            // Základní sférický přechod bubliny
            const bubGrad = ctx.createRadialGradient(cx - sr * 0.35, cy - sr * 0.35, sr * 0.1, cx, cy, sr);
            bubGrad.addColorStop(0, 'rgba(130, 225, 255, 0.08)');
            bubGrad.addColorStop(0.7, 'rgba(20, 140, 255, 0.18)');
            bubGrad.addColorStop(0.92, 'rgba(60, 190, 255, 0.45)');
            bubGrad.addColorStop(1, 'rgba(180, 245, 255, 0.75)');
            ctx.fillStyle = bubGrad;
            ctx.fillRect(0, 0, w, h);

            // Šestiúhelníková energetická mřížka (hex pattern)
            const hexR = r * 0.26;
            const hexH = hexR * Math.sqrt(3);
            ctx.strokeStyle = 'rgba(110, 220, 255, 0.32)';
            ctx.lineWidth = 1.3;

            for (let row = -8; row <= 8; row++) {
                for (let col = -8; col <= 8; col++) {
                    const hx = cx + col * hexR * 1.5;
                    const hy = cy + row * hexH + (Math.abs(col) % 2 === 1 ? hexH / 2 : 0);
                    if (Math.hypot(hx - cx, hy - cy) > sr + hexR) continue;

                    ctx.beginPath();
                    for (let side = 0; side < 6; side++) {
                        const a = (side * Math.PI) / 3;
                        const px = hx + Math.cos(a) * (hexR * 0.92);
                        const py = hy + Math.sin(a) * (hexR * 0.92);
                        if (side === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }

            // Horní levý odlesk na bublině
            const hlGrad = ctx.createRadialGradient(cx - sr * 0.45, cy - sr * 0.45, sr * 0.05, cx - sr * 0.4, cy - sr * 0.4, sr * 0.55);
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = hlGrad;
            ctx.beginPath();
            ctx.arc(cx - sr * 0.4, cy - sr * 0.4, sr * 0.55, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // Ostrý vnější prstenec
            ctx.strokeStyle = 'rgba(160, 235, 255, 0.85)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(cx, cy, sr, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    ZS.king = function (ctx, x, y, r = 36, angle = 0, ts = 0, phase = 1, shield = false, hitFlash = 0) {
        ctx.save();
        ctx.translate(x, y);

        const breath = Math.sin(ts * 0.004) * 0.035;
        const rageSpeed = (phase === 3) ? 0.012 : 0.005;
        const armSwing = Math.sin(ts * rageSpeed) * (phase === 3 ? 0.22 : 0.12);

        // 1. Měkký stín pod bossem (posunutý mírně doprava dolů kvůli světlu shora zleva)
        const shGrad = ctx.createRadialGradient(r * 0.12, r * 0.15, r * 0.2, r * 0.12, r * 0.15, r * 1.45);
        shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
        shGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
        shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shGrad;
        ctx.beginPath();
        ctx.arc(r * 0.12, r * 0.15, r * 1.45, 0, Math.PI * 2);
        ctx.fill();

        // 2. Aura podle fáze (1 = fialová, 2 = klidnější, 3 = zuřící červená pulzující)
        if (phase === 1 || phase === 2 || phase === 3) {
            const pulse = (phase === 3)
                ? 0.85 + Math.sin(ts * 0.015) * 0.25
                : (phase === 1 ? 0.85 + Math.sin(ts * 0.006) * 0.15 : 0.45 + Math.sin(ts * 0.004) * 0.08);

            const auraRadius = r * (phase === 3 ? 1.65 : (phase === 1 ? 1.45 : 1.2)) * pulse;
            const auraGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, auraRadius);

            if (phase === 3) {
                auraGrad.addColorStop(0, 'rgba(255, 30, 30, 0.55)');
                auraGrad.addColorStop(0.5, 'rgba(200, 0, 40, 0.28)');
                auraGrad.addColorStop(1, 'rgba(120, 0, 0, 0)');
            } else {
                const alphaMul = (phase === 1) ? 1.0 : 0.45;
                auraGrad.addColorStop(0, `rgba(185, 50, 255, ${0.48 * alphaMul})`);
                auraGrad.addColorStop(0.55, `rgba(120, 20, 200, ${0.22 * alphaMul})`);
                auraGrad.addColorStop(1, 'rgba(70, 0, 130, 0)');
            }

            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
            ctx.fill();

            // Energetické prstence / plamínky pro fázi 1 a 3
            if (phase === 1 || phase === 3) {
                ctx.strokeStyle = (phase === 3) ? 'rgba(255, 80, 60, 0.4)' : 'rgba(200, 100, 255, 0.35)';
                ctx.lineWidth = 2;
                const numArcs = (phase === 3) ? 5 : 3;
                for (let i = 0; i < numArcs; i++) {
                    const aOffset = ts * (phase === 3 ? 0.005 : 0.0025) * (i % 2 === 0 ? 1 : -1) + i * 2.1;
                    const arcR = r * (1.05 + ((ts * 0.03 + i * 15) % 35) / 100);
                    ctx.beginPath();
                    ctx.arc(0, 0, arcR, aOffset, aOffset + 1.2);
                    ctx.stroke();
                }
            }
        }

        // 3. Otočení bosse do směru pohledu
        ctx.save();
        ctx.rotate(angle);
        ctx.scale(1 + breath, 1 - breath * 0.6);

        // Vykreslení obřích paží s drápy (animované)
        const drawArm = (isLeft) => {
            const side = isLeft ? -1 : 1;
            const swing = isLeft ? armSwing : -armSwing;
            ctx.save();
            ctx.translate(r * 0.18, side * r * 0.72);
            ctx.rotate(side * -0.25 + swing);

            // Paže
            const armGrad = ctx.createLinearGradient(0, -r * 0.25, r * 0.85, r * 0.25);
            armGrad.addColorStop(0, isLeft ? '#688060' : '#485c42');
            armGrad.addColorStop(1, '#263323');

            ctx.fillStyle = armGrad;
            ctx.strokeStyle = '#151c13';
            ctx.lineWidth = r * 0.05;

            ctx.beginPath();
            ctx.moveTo(-r * 0.1, -r * 0.24);
            ctx.quadraticCurveTo(r * 0.45, side * r * 0.32, r * 0.82, side * r * 0.05);
            ctx.arc(r * 0.78, -side * r * 0.08, r * 0.24, side * 0.4, side * 0.4 + Math.PI, isLeft);
            ctx.quadraticCurveTo(r * 0.35, -side * r * 0.08, -r * 0.1, r * 0.22);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Kostěné drápy na konci tlap
            ctx.fillStyle = '#d9d2b8';
            ctx.strokeStyle = '#332d1f';
            ctx.lineWidth = r * 0.025;
            for (let c = -1; c <= 1; c++) {
                ctx.beginPath();
                const cy = c * r * 0.12 - side * r * 0.05;
                ctx.moveTo(r * 0.88, cy - r * 0.045);
                ctx.lineTo(r * 1.12, cy - side * r * 0.04);
                ctx.lineTo(r * 0.88, cy + r * 0.045);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            ctx.restore();
        };

        drawArm(true);  // Levá ruka
        drawArm(false); // Pravá ruka

        // Vykreslení předkresleného trupu a pláště
        const bodyCanvas = getKingBodyCache(r);
        ctx.drawImage(bodyCanvas, -bodyCanvas.width / 2, -bodyCanvas.height / 2);

        // Fáze 3: Žhnoucí praskliny na těle (zuřivost)
        if (phase === 3) {
            const crackPulse = 0.65 + Math.sin(ts * 0.018) * 0.35;
            ctx.save();
            ctx.strokeStyle = `rgba(255, 70, 20, ${crackPulse})`;
            ctx.lineWidth = r * 0.055;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            // Prasklina přes levé rameno do hrudi
            ctx.moveTo(-r * 0.05, -r * 0.35);
            ctx.lineTo(r * 0.12, -r * 0.65);
            ctx.lineTo(-r * 0.1, -r * 0.85);
            // Prasklina přes pravé rameno
            ctx.moveTo(-r * 0.05, r * 0.35);
            ctx.lineTo(r * 0.18, r * 0.62);
            ctx.lineTo(r * 0.02, r * 0.85);
            ctx.stroke();

            // Žhavý střed prasklin
            ctx.strokeStyle = `rgba(255, 230, 130, ${crackPulse})`;
            ctx.lineWidth = r * 0.022;
            ctx.stroke();
            ctx.restore();
        }

        // Vykreslení předkreslené hlavy s korunou (mírně vpředu)
        const headCanvas = getKingHeadCache(r);
        const headX = r * 0.16;
        ctx.drawImage(headCanvas, headX - headCanvas.width / 2, -headCanvas.height / 2);

        // Žhnoucí oči bosse (ve fázi 3 mnohem jasnější a červené)
        const hr = r * 0.52;
        const eyeX = headX + hr * 0.58;
        const eyeY = hr * 0.34;
        const eyeRadius = (phase === 3) ? hr * 0.22 : hr * 0.15;

        ctx.save();
        const eyeColorInner = (phase === 3) ? '#ffffff' : '#f7c6ff';
        const eyeColorMid = (phase === 3) ? '#ff1e1e' : '#c82eff';
        const eyeColorOuter = (phase === 3) ? 'rgba(255, 0, 0, 0)' : 'rgba(170, 0, 255, 0)';

        [-1, 1].forEach(dir => {
            const ey = dir * eyeY;
            const eGrad = ctx.createRadialGradient(eyeX, ey, eyeRadius * 0.1, eyeX, ey, eyeRadius * 2.2);
            eGrad.addColorStop(0, eyeColorInner);
            eGrad.addColorStop(0.35, eyeColorMid);
            eGrad.addColorStop(1, eyeColorOuter);

            ctx.fillStyle = eGrad;
            ctx.beginPath();
            ctx.arc(eyeX, ey, eyeRadius * 2.2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // Bílé bliknutí po zásahu (hitFlash 0..1)
        if (hitFlash > 0) {
            const hf = clamp(hitFlash, 0, 1);
            ctx.fillStyle = `rgba(255, 255, 255, ${hf * 0.78})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 0.95, r * 1.08, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore(); // Konec rotace těla

        // 4. Energetický štít (shield = true)
        if (shield) {
            const shieldCanvas = getKingShieldCache(r);
            ctx.save();
            const shieldPulse = 1 + Math.sin(ts * 0.007) * 0.025;
            ctx.scale(shieldPulse, shieldPulse);
            ctx.rotate(ts * 0.0004); // Velmi pomalá rotace hex mřížky
            ctx.drawImage(shieldCanvas, -shieldCanvas.width / 2, -shieldCanvas.height / 2);
            ctx.restore();
        }

        ctx.restore();
    };

    // ========================================================================
    // 2) ZS.totem - Fialový krystalový totem na kamenném podstavci
    // ========================================================================

    function getTotemBaseCache(r) {
        const size = Math.ceil(r * 2.6);
        return getCachedCanvas('totem_base_' + r, size, size, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.translate(cx, cy);

            // Stín pod podstavcem
            const shGrad = ctx.createRadialGradient(r * 0.12, r * 0.15, r * 0.2, r * 0.12, r * 0.15, r * 1.2);
            shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
            shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = shGrad;
            ctx.beginPath();
            ctx.arc(r * 0.12, r * 0.15, r * 1.2, 0, Math.PI * 2);
            ctx.fill();

            // Osmiúhelníkový kamenný podstavec (2 stupně)
            const drawOctagon = (rad, gradStops, strokeCol) => {
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = (i * Math.PI) / 4 + Math.PI / 8;
                    const px = Math.cos(a) * rad;
                    const py = Math.sin(a) * rad;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                const g = ctx.createLinearGradient(-rad, -rad, rad, rad);
                gradStops.forEach(([stop, col]) => g.addColorStop(stop, col));
                ctx.fillStyle = g;
                ctx.strokeStyle = strokeCol;
                ctx.lineWidth = r * 0.06;
                ctx.fill();
                ctx.stroke();
            };

            // Spodní širší stupeň
            drawOctagon(r * 0.98, [[0, '#7a7d82'], [0.5, '#525559'], [1, '#2b2d30']], '#1c1d1f');
            // Horní užší stupeň
            drawOctagon(r * 0.74, [[0, '#8c9096'], [0.5, '#5c6066'], [1, '#34373b']], '#222426');

            // Vyryté runové drážky na podstavci
            ctx.strokeStyle = '#3d1e54';
            ctx.lineWidth = r * 0.05;
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI) / 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
                ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
                ctx.stroke();
            }

            // Temné lůžko pro krystal uprostřed
            ctx.fillStyle = '#1b0c26';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function getTotemCrystalCache(r) {
        const size = Math.ceil(r * 2.0);
        return getCachedCanvas('totem_crystal_' + r, size, size, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.translate(cx, cy);

            const cr = r * 0.56;
            const sides = 6;
            // Posunutá špička krystalu mírně vlevo nahoru pro 3D perspektivu shora
            const tipX = -cr * 0.12;
            const tipY = -cr * 0.12;

            // Barvy jednotlivých faset krystalu podle dopadu světla shora zleva (-1, -1)
            const facetColors = [
                '#9b2de0', // Vpravo dole
                '#68129e', // Dole (nejtmavší stín)
                '#841ec4', // Vlevo dole
                '#d57aff', // Vlevo nahoře (plně nasvícená faseta)
                '#e8adff', // Nahoře (nejjasnější faseta)
                '#b84bf5'  // Vpravo nahoře
            ];

            for (let i = 0; i < sides; i++) {
                const a1 = (i * Math.PI * 2) / sides;
                const a2 = ((i + 1) * Math.PI * 2) / sides;

                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(Math.cos(a1) * cr, Math.sin(a1) * cr);
                ctx.lineTo(Math.cos(a2) * cr, Math.sin(a2) * cr);
                ctx.closePath();

                ctx.fillStyle = facetColors[i];
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 220, 255, 0.45)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }

            // Vnější obrys krystalu
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const a = (i * Math.PI * 2) / sides;
                const px = Math.cos(a) * cr;
                const py = Math.sin(a) * cr;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = '#33064f';
            ctx.lineWidth = r * 0.06;
            ctx.stroke();

            // Ostrý bílý odlesk na špičce a hraně
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(tipX, tipY, cr * 0.16, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ZS.totem = function (ctx, x, y, r = 22, ts = 0, hpPct = 1.0) {
        const hp = clamp(hpPct, 0, 1);
        const dmg = 1 - hp;

        ctx.save();
        ctx.translate(x, y);

        // 1. Kamenný podstavec z cache
        const baseCanvas = getTotemBaseCache(r);
        ctx.drawImage(baseCanvas, -baseCanvas.width / 2, -baseCanvas.height / 2);

        // 2. Pulzující světlo pod krystalem a v runách (slábne s klesajícím HP)
        const pulse = 0.75 + Math.sin(ts * 0.006) * 0.25;
        const glowIntensity = hp * pulse;

        if (glowIntensity > 0.02) {
            const glowR = r * (1.1 + glowIntensity * 0.65);
            const glowGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, glowR);
            glowGrad.addColorStop(0, `rgba(235, 140, 255, ${0.75 * glowIntensity})`);
            glowGrad.addColorStop(0.45, `rgba(170, 40, 255, ${0.4 * glowIntensity})`);
            glowGrad.addColorStop(1, 'rgba(90, 0, 160, 0)');

            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(0, 0, glowR, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Samotný fialový krystal z cache
        const crystalCanvas = getTotemCrystalCache(r);
        ctx.drawImage(crystalCanvas, -crystalCanvas.width / 2, -crystalCanvas.height / 2);

        // Ztmavení krystalu při nízkém HP
        if (dmg > 0.05) {
            ctx.fillStyle = `rgba(20, 8, 28, ${dmg * 0.55})`;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4. Praskliny na krystalu a podstavci podle poškození (čím méně HP, tím víc prasklin)
        if (dmg > 0.05) {
            ctx.save();
            ctx.strokeStyle = '#160321';
            ctx.lineWidth = r * 0.065;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const cr = r * 0.52;
            ctx.beginPath();

            // 1. stupeň prasklin (pod 95 % HP)
            ctx.moveTo(-cr * 0.1, -cr * 0.1);
            ctx.lineTo(cr * 0.45, -cr * 0.35);
            ctx.lineTo(cr * 0.75, -cr * 0.2);

            // 2. stupeň prasklin (pod 70 % HP)
            if (dmg > 0.3) {
                ctx.moveTo(-cr * 0.1, -cr * 0.1);
                ctx.lineTo(-cr * 0.55, cr * 0.4);
                ctx.lineTo(-cr * 0.35, cr * 0.85);

                ctx.moveTo(cr * 0.45, -cr * 0.35);
                ctx.lineTo(cr * 0.3, cr * 0.2);
            }

            // 3. stupeň prasklin (pod 40 % HP - zasahují i kamenný podstavec)
            if (dmg > 0.6) {
                ctx.moveTo(-cr * 0.1, -cr * 0.1);
                ctx.lineTo(cr * 0.25, cr * 0.75);
                ctx.lineTo(r * 0.55, r * 0.78);

                ctx.moveTo(-cr * 0.2, -cr * 0.15);
                ctx.lineTo(-r * 0.65, -r * 0.55);
            }

            ctx.stroke();

            // Světlejší hrana prasklin pro ostrost
            ctx.strokeStyle = 'rgba(220, 160, 255, 0.35)';
            ctx.lineWidth = r * 0.02;
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    };

    // ========================================================================
    // 3) ZS.skull - Letící prokletá lebka s fialovým plamenem
    // ========================================================================

    function getSkullCache(size) {
        const cSize = Math.ceil(size * 1.8);
        return getCachedCanvas('skull_' + size, cSize, cSize, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.translate(cx, cy);

            const sr = size * 0.46;

            // Tvar lebky (mozkovna nahoře + čelist dole)
            const boneGrad = ctx.createRadialGradient(-sr * 0.3, -sr * 0.35, sr * 0.1, 0, 0, sr * 1.2);
            boneGrad.addColorStop(0, '#f5f0e6');
            boneGrad.addColorStop(0.55, '#cbbba8');
            boneGrad.addColorStop(1, '#6e5c53');

            ctx.fillStyle = boneGrad;
            ctx.strokeStyle = '#2b192e';
            ctx.lineWidth = size * 0.06;

            ctx.beginPath();
            ctx.arc(0, -sr * 0.12, sr * 0.88, Math.PI * 0.82, Math.PI * 0.18, false);
            // Lícní kosti a čelist
            ctx.lineTo(sr * 0.62, sr * 0.42);
            ctx.quadraticCurveTo(sr * 0.45, sr * 0.88, 0, sr * 0.88);
            ctx.quadraticCurveTo(-sr * 0.45, sr * 0.88, -sr * 0.62, sr * 0.42);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Zuby / rýhy na čelisti
            ctx.strokeStyle = '#3d2838';
            ctx.lineWidth = size * 0.04;
            for (let t = -1; t <= 1; t++) {
                ctx.beginPath();
                ctx.moveTo(t * sr * 0.22, sr * 0.58);
                ctx.lineTo(t * sr * 0.22, sr * 0.84);
                ctx.stroke();
            }

            // Oční důlky
            ctx.fillStyle = '#1f0726';
            ctx.beginPath();
            ctx.ellipse(-sr * 0.34, sr * 0.08, sr * 0.24, sr * 0.28, -0.15, 0, Math.PI * 2);
            ctx.ellipse(sr * 0.34, sr * 0.08, sr * 0.24, sr * 0.28, 0.15, 0, Math.PI * 2);
            ctx.fill();

            // Nosní dutina
            ctx.beginPath();
            ctx.moveTo(0, sr * 0.22);
            ctx.lineTo(-sr * 0.14, sr * 0.48);
            ctx.lineTo(sr * 0.14, sr * 0.48);
            ctx.closePath();
            ctx.fill();
        });
    }

    ZS.skull = function (ctx, x, y, h = 0, ts = 0) {
        const size = 22;
        const heightOffset = Math.max(0, h);

        ctx.save();

        // 1. Stín na zemi v [x, y] (zmenšuje se a slábne s rostoucí výškou h)
        const shadowScale = clamp(1 - heightOffset / 180, 0.35, 1);
        const shadowAlpha = clamp(0.55 - heightOffset / 220, 0.12, 0.55);
        const shadowR = size * 0.65 * shadowScale;

        const shGrad = ctx.createRadialGradient(x, y, shadowR * 0.1, x, y, shadowR);
        shGrad.addColorStop(0, `rgba(15, 2, 25, ${shadowAlpha})`);
        shGrad.addColorStop(1, 'rgba(15, 2, 25, 0)');
        ctx.fillStyle = shGrad;
        ctx.beginPath();
        ctx.ellipse(x, y, shadowR * 1.15, shadowR * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Samotná lebka o h px výš
        const sy = y - heightOffset;
        const wobble = Math.sin(ts * 0.015) * 0.12;

        ctx.translate(x, sy);
        ctx.rotate(wobble);

        // Vnější fialová záře kolem lebky
        const flamePulse = 0.85 + Math.sin(ts * 0.025) * 0.15;
        const auraR = size * 1.25 * flamePulse;
        const auraGrad = ctx.createRadialGradient(0, -size * 0.1, size * 0.15, 0, -size * 0.15, auraR);
        auraGrad.addColorStop(0, 'rgba(245, 180, 255, 0.9)');
        auraGrad.addColorStop(0.4, 'rgba(180, 40, 255, 0.65)');
        auraGrad.addColorStop(0.75, 'rgba(100, 10, 170, 0.25)');
        auraGrad.addColorStop(1, 'rgba(60, 0, 100, 0)');

        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, -size * 0.1, auraR, 0, Math.PI * 2);
        ctx.fill();

        // Dynamické plamenné jazyky šlehající kolem lebky
        const numFlames = 5;
        for (let i = 0; i < numFlames; i++) {
            const phase = ts * 0.018 + i * 1.35;
            const fx = Math.sin(phase) * (size * 0.35);
            const fy = -size * 0.25 - ((ts * 0.08 + i * 12) % (size * 0.75));
            const fr = size * 0.32 * (1 - Math.abs(fy) / (size * 1.1));

            if (fr > 0.5) {
                ctx.fillStyle = (i % 2 === 0) ? 'rgba(210, 90, 255, 0.65)' : 'rgba(255, 170, 255, 0.7)';
                ctx.beginPath();
                ctx.arc(fx, fy, fr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Vykreslení lebky z cache
        const skullCanvas = getSkullCache(size);
        ctx.drawImage(skullCanvas, -skullCanvas.width / 2, -skullCanvas.height / 2);

        // Žhnoucí fialovo-růžové oči v důlcích
        const sr = size * 0.46;
        ctx.fillStyle = '#ff94ff';
        ctx.beginPath();
        ctx.arc(-sr * 0.34, sr * 0.08, sr * 0.14 * flamePulse, 0, Math.PI * 2);
        ctx.arc(sr * 0.34, sr * 0.08, sr * 0.14 * flamePulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    };

    // ========================================================================
    // 4) ZS.poisonPool - Probublávající fialová jedovatá louže
    // ========================================================================

    function getPoisonPoolCache(big) {
        const w = big ? 52 : 36;
        const h = big ? 36 : 26;
        const pad = 12;
        return getCachedCanvas('poison_pool_' + (big ? 'big' : 'small'), w + pad * 2, h + pad * 2, (ctx, cw, ch) => {
            const cx = cw / 2;
            const cy = ch / 2;
            const rx = w / 2;
            const ry = h / 2;

            ctx.translate(cx, cy);

            // Organický nepravidelný tvar louže
            const drawBlob = (scale, fillStyle, strokeStyle, lineWidth) => {
                ctx.beginPath();
                const steps = 24;
                for (let i = 0; i <= steps; i++) {
                    const a = (i * Math.PI * 2) / steps;
                    // Deterministické zvlnění okraje
                    const wave = 1 + Math.sin(a * 3 + 0.5) * 0.08 + Math.cos(a * 5 - 0.3) * 0.05;
                    const px = Math.cos(a) * rx * scale * wave;
                    const py = Math.sin(a) * ry * scale * wave;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                if (fillStyle) {
                    ctx.fillStyle = fillStyle;
                    ctx.fill();
                }
                if (strokeStyle) {
                    ctx.strokeStyle = strokeStyle;
                    ctx.lineWidth = lineWidth || 1.5;
                    ctx.stroke();
                }
            };

            // Vnější tmavý okraj
            const outerGrad = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, rx * 0.1, 0, 0, rx * 1.1);
            outerGrad.addColorStop(0, 'rgba(165, 45, 225, 0.85)');
            outerGrad.addColorStop(0.7, 'rgba(95, 18, 145, 0.85)');
            outerGrad.addColorStop(1, 'rgba(45, 5, 75, 0.75)');
            drawBlob(1.0, outerGrad, 'rgba(30, 2, 50, 0.6)', 1.8);

            // Světlejší toxické jádro uvnitř
            const innerGrad = ctx.createRadialGradient(-rx * 0.25, -ry * 0.25, rx * 0.05, 0, 0, rx * 0.75);
            innerGrad.addColorStop(0, 'rgba(225, 115, 255, 0.75)');
            innerGrad.addColorStop(1, 'rgba(140, 30, 200, 0.2)');
            drawBlob(0.72, innerGrad, null);

            // Lesklý odlesk hladiny vlevo nahoře
            ctx.fillStyle = 'rgba(255, 220, 255, 0.35)';
            ctx.beginPath();
            ctx.ellipse(-rx * 0.32, -ry * 0.32, rx * 0.26, ry * 0.14, -0.35, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ZS.poisonPool = function (ctx, x, y, fade = 1.0, ts = 0, big = false) {
        const f = clamp(fade, 0, 1);
        if (f <= 0.01) return;

        const poolCanvas = getPoisonPoolCache(big);
        const rx = (big ? 52 : 36) / 2;
        const ry = (big ? 36 : 26) / 2;

        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = f;

        // Postupné zmenšování při mizení + jemné pulzování
        const scale = (0.45 + 0.55 * f) * (1 + Math.sin(ts * 0.004) * 0.02);
        ctx.scale(scale, scale);

        // Základ louže z cache
        ctx.drawImage(poolCanvas, -poolCanvas.width / 2, -poolCanvas.height / 2);

        // Animované bubliny na hladině
        const numBubbles = big ? 6 : 4;
        for (let i = 0; i < numBubbles; i++) {
            // Cyklus života bubliny 0..1
            const cycle = ((ts * 0.0012 + i * 0.37) % 1);
            // Rozmístění bublin uvnitř elipsy
            const angle = i * 2.15 + 0.4;
            const dist = 0.25 + (i % 3) * 0.2;
            const bx = Math.cos(angle) * rx * dist;
            const by = Math.sin(angle) * ry * dist;
            const maxBr = (big ? 4.2 : 3.2) * (i % 2 === 0 ? 1 : 0.75);

            if (cycle < 0.82) {
                // Rostoucí bublina
                const br = maxBr * (cycle / 0.82);
                ctx.fillStyle = 'rgba(215, 105, 255, 0.65)';
                ctx.strokeStyle = 'rgba(250, 200, 255, 0.85)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Odlesk na bublině
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Prasknutí bubliny (rozšiřující se kroužek)
                const popProgress = (cycle - 0.82) / 0.18;
                const br = maxBr * (1 + popProgress * 0.6);
                ctx.strokeStyle = `rgba(245, 190, 255, ${1 - popProgress})`;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        ctx.restore();
    };

    // ========================================================================
    // 5) ZS.grave - Otevírající se hrob se zombie rukou (velikost ~60 px)
    // ========================================================================

    function getGraveBaseCache() {
        const size = 76;
        return getCachedCanvas('grave_base_60', size, size, (ctx, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.translate(cx, cy);

            // 1. Stín pod hrobem a náhrobkem
            const shGrad = ctx.createRadialGradient(2, 4, 5, 2, 4, 34);
            shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
            shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = shGrad;
            ctx.beginPath();
            ctx.ellipse(2, 4, 32, 26, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. Hromada vykopané hlíny (základní vrstva)
            const dirtGrad = ctx.createRadialGradient(-8, -6, 4, 0, 4, 28);
            dirtGrad.addColorStop(0, '#634832');
            dirtGrad.addColorStop(0.65, '#422f20');
            dirtGrad.addColorStop(1, '#261a11');

            ctx.fillStyle = dirtGrad;
            ctx.strokeStyle = '#1a110a';
            ctx.lineWidth = 1.8;

            ctx.beginPath();
            const rx = 26, ry = 19;
            for (let i = 0; i <= 20; i++) {
                const a = (i * Math.PI * 2) / 20;
                const bump = 1 + Math.sin(a * 4) * 0.06 + Math.cos(a * 6) * 0.04;
                const px = Math.cos(a) * rx * bump;
                const py = 5 + Math.sin(a) * ry * bump;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Kamínky a hroudy hlíny po obvodu
            const pebbles = [
                [-18, -2, 3.2, '#755840'], [16, -4, 2.8, '#543d2b'],
                [-14, 15, 3.5, '#4f3928'], [19, 12, 3.0, '#38271b'],
                [6, 18, 2.5, '#614732'], [-6, -8, 2.6, '#785a42']
            ];
            pebbles.forEach(([px, py, pr, col]) => {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(px, py, pr, 0, Math.PI * 2);
                ctx.fill();
            });

            // 3. Kamenný náhrobek v horní části hrobu (pohled shora)
            ctx.save();
            ctx.translate(0, -16);

            // Stín náhrobku vržený na hlínu doprava dolů
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.roundRect(-13, -4, 30, 12, 4);
            ctx.fill();

            // Tělo náhrobku
            const stoneGrad = ctx.createLinearGradient(-15, -8, 15, 6);
            stoneGrad.addColorStop(0, '#9ea3a8');
            stoneGrad.addColorStop(0.5, '#6d7278');
            stoneGrad.addColorStop(1, '#3e4247');

            ctx.fillStyle = stoneGrad;
            ctx.strokeStyle = '#232629';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-15, -7, 30, 11, 3.5);
            ctx.fill();
            ctx.stroke();

            // Vyrytý kříž na horní hraně náhrobku
            ctx.strokeStyle = '#2d3033';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(0, -4.5);
            ctx.lineTo(0, 1.5);
            ctx.moveTo(-3.5, -2);
            ctx.lineTo(3.5, -2);
            ctx.stroke();

            ctx.restore();
        });
    }

    ZS.grave = function (ctx, x, y, p = 0, ts = 0) {
        const prog = clamp(p, 0, 1);
        if (prog >= 0.995) return; // p = 1 -> zmizí

        // Plynulé zobrazení na začátku a zmizení na konci (p > 0.8)
        let alpha = 1.0;
        if (prog < 0.08) alpha = prog / 0.08;
        else if (prog > 0.78) alpha = (1 - prog) / 0.22;

        // Kypění a otřesy země vrcholí kolem p = 0.2..0.6
        const rumble = Math.sin(prog * Math.PI);
        const shakeX = Math.sin(ts * 0.045) * 1.6 * rumble;
        const shakeY = Math.cos(ts * 0.055) * 1.2 * rumble;

        ctx.save();
        ctx.translate(x + shakeX, y + shakeY);
        ctx.globalAlpha = clamp(alpha, 0, 1);

        // Mírné nafouknutí zvedající se hlíny
        const moundScale = 0.88 + 0.16 * Math.sin(prog * Math.PI * 0.85);
        ctx.scale(moundScale, moundScale);

        // 1. Základ hrobu z cache (náhrobek + hlína)
        const baseCanvas = getGraveBaseCache();
        ctx.drawImage(baseCanvas, -baseCanvas.width / 2, -baseCanvas.height / 2);

        // 2. Otevírající se prasklina uprostřed hlíny (roste od p = 0.15)
        const crackOpen = clamp((prog - 0.1) / 0.4, 0, 1);
        if (crackOpen > 0.02) {
            ctx.save();
            ctx.translate(0, 5);

            // Tmavá propast uvnitř hrobu
            ctx.fillStyle = '#0d0608';
            ctx.strokeStyle = '#2e1c10';
            ctx.lineWidth = 2;

            const cw = 18 * crackOpen;
            const ch = 10 * crackOpen;

            ctx.beginPath();
            ctx.moveTo(-cw, 0);
            ctx.lineTo(-cw * 0.5, -ch * 0.8);
            ctx.lineTo(0, -ch);
            ctx.lineTo(cw * 0.6, -ch * 0.7);
            ctx.lineTo(cw, 0);
            ctx.lineTo(cw * 0.5, ch * 0.85);
            ctx.lineTo(-cw * 0.1, ch);
            ctx.lineTo(-cw * 0.6, ch * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Zelenkavá / fialová nekrotická mlha stoupající z jámy
            const mistGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, cw * 1.2);
            mistGrad.addColorStop(0, `rgba(145, 60, 210, ${0.45 * crackOpen})`);
            mistGrad.addColorStop(1, 'rgba(60, 20, 90, 0)');
            ctx.fillStyle = mistGrad;
            ctx.beginPath();
            ctx.arc(0, 0, cw * 1.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // 3. Zombie ruka vylézající z praskliny (nejvíc vidět kolem p = 0.5)
        if (prog > 0.22 && prog < 0.92) {
            // Průběh samotné ruky 0..1..0
            const handPhase = (prog - 0.22) / 0.7;
            const handReach = Math.sin(handPhase * Math.PI); // Vrchol v p ~ 0.57
            const twitch = Math.sin(ts * 0.025) * 0.14;

            ctx.save();
            ctx.translate(0, 6);
            ctx.rotate(twitch);
            ctx.scale(handReach, handReach);

            // Předloktí
            const armGrad = ctx.createLinearGradient(-5, -12, 6, 8);
            armGrad.addColorStop(0, '#728f68');
            armGrad.addColorStop(1, '#33422e');

            ctx.fillStyle = armGrad;
            ctx.strokeStyle = '#182115';
            ctx.lineWidth = 1.6;

            ctx.beginPath();
            ctx.roundRect(-4.5, -10, 9, 14, 4);
            ctx.fill();
            ctx.stroke();

            // Dlaň
            ctx.beginPath();
            ctx.arc(0, -10, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Roztažené prsty škrábající do hlíny
            const fingers = [
                { a: -0.9, len: 8.5 },
                { a: -0.35, len: 10.5 },
                { a: 0.15, len: 10.0 },
                { a: 0.65, len: 8.5 },
                { a: 1.25, len: 6.5 } // Palec
            ];

            fingers.forEach(f => {
                const fx = Math.sin(f.a) * f.len;
                const fy = -11 - Math.cos(f.a) * f.len;

                ctx.strokeStyle = '#182115';
                ctx.lineWidth = 3.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(Math.sin(f.a) * 3.5, -10 - Math.cos(f.a) * 3.5);
                ctx.lineTo(fx, fy);
                ctx.stroke();

                ctx.strokeStyle = '#68855e';
                ctx.lineWidth = 2.0;
                ctx.stroke();

                // Špinavý dráp na špičce prstu
                ctx.fillStyle = '#d4ccb8';
                ctx.beginPath();
                ctx.arc(fx + Math.sin(f.a) * 1.2, fy - Math.cos(f.a) * 1.2, 1.1, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        }

        // 4. Odlétávající hroudy hlíny při hrabání
        if (rumble > 0.25) {
            ctx.fillStyle = '#4a3423';
            for (let i = 0; i < 5; i++) {
                const pCycle = ((ts * 0.003 + i * 0.21) % 1);
                const pAngle = i * 1.25 + 0.5;
                const dist = 6 + pCycle * 18;
                const px = Math.cos(pAngle) * dist;
                const py = 5 + Math.sin(pAngle) * (dist * 0.7);
                const pr = (1 - pCycle) * 2.8 * rumble;

                ctx.beginPath();
                ctx.arc(px, py, pr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    };

})();
