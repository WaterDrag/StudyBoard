/**
 * zombie-sprites-4.js — Doplněk č. 4 ke kreslicí knihovně Zombie Survival (2D Top-Down)
 * Rozšiřuje objekt window.ZS o nové nepřátele, mapu "Lom", písečného červa, kyselinu a elektrický plot.
 *
 * Přehled funkcí a jejich volání:
 * 1) ZS.zombieExtra(ctx, type, x, y, r, angle, ts, hitFlash) -> boolean
 *    Kreslí nové typy zombií ('spitter', 'shield', 'leaper', 'splitter', 'mini', 'screamer', 'healer').
 *    Vrací true, pokud typ existuje a byl vykreslen, jinak false.
 *
 * 2) ZS.floorQuarry(ctx, x, y, w, h)
 *    Vyplní zadaný obdélník bezešvou dlaždicí (256×256 px) pískového lomu.
 *
 * 3) ZS.wallQuarry(ctx, x, y, w, h)
 *    Vykreslí skalní překážku (1–4 balvany podle poměru stran) přesně lícující s kolizním obdélníkem.
 *
 * 4) ZS.worm(ctx, phase, x, y, R, p, ts)
 *    Písečný červ v bodě (x, y) o poloměru zóny R (např. 85).
 *    phase: 'warn' (varování/otřesy), 'strike' (vynoření tlamy), 'dive' (zanoření). p = 0..1.
 *
 * 5) ZS.spit(ctx, x, y, h, ts)
 *    Letící kapka kyseliny se stínem na [x, y] a samotnou kapkou vykreslenou o h px výše.
 *
 * 6) ZS.acidPool(ctx, x, y, fade, ts)
 *    Probublávající louže kyseliny (cca 44×30 px) na zemi, fade = 1..0 (průhlednost a zmenšení).
 *
 * 7) ZS.fenceLinked(ctx, cx, cy, size, powered, links, ts)
 *    Elektrický plot na mřížce se středem [cx, cy], velikostí dlaždice size (50 px),
 *    stavem proudu powered (boolean) a napojením links = { n, e, s, w }.
 */
(function () {
    'use strict';

    const ZS = window.ZS = window.ZS || {};
    const OUTLINE = '#141814';
    const TWO_PI = Math.PI * 2;

    // Interní úložiště pro předkreslené offscreen canvasy
    const cache = new Map();

    // Deterministický pseudonáhodný generátor (Mulberry32) pro konzistentní textury a skály
    function createRNG(seed) {
        let s = seed >>> 0;
        return function () {
            s += 0x6D2B79F5;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Vytvoření offscreen canvasu
    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w));
        c.height = Math.max(1, Math.ceil(h));
        return c;
    }

    // Vytvoří čistě bílou siluetu ze zadaného canvasu pro efekt hitFlash
    function makeSilhouette(srcCanvas) {
        const c = makeCanvas(srcCanvas.width, srcCanvas.height);
        const ctx = c.getContext('2d');
        ctx.drawImage(srcCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        return c;
    }

    // Pomocná funkce pro kreslení vyplněného útvaru s obrysem
    function fillAndStroke(ctx, fill, stroke, lineWidth) {
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke && lineWidth > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    // ============================================================================
    // 1) NOVÉ TYPY ZOMBIE — ZS.zombieExtra
    // ============================================================================

    const ZOMBIE_TYPES = {
        spitter: true,
        shield: true,
        leaper: true,
        splitter: true,
        mini: true,
        screamer: true,
        healer: true
    };

    function getZombieSprite(type, r) {
        const qR = Math.max(4, Math.round(r));
        const key = 'z_' + type + '_' + qR;
        if (cache.has(key)) return cache.get(key);

        // Dostatečný padding okolo poloměru r (kvůli nohám skokana, štítu, tlamě atd.)
        const pad = Math.ceil(qR * 2.4);
        const size = pad * 2;
        const canvas = makeCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const lw = Math.max(1.4, qR * 0.12);

        ctx.save();
        ctx.translate(pad, pad);

        switch (type) {
            case 'spitter':
                drawSpitter(ctx, qR, lw);
                break;
            case 'shield':
                drawShield(ctx, qR, lw);
                break;
            case 'leaper':
                drawLeaper(ctx, qR, lw);
                break;
            case 'splitter':
                drawSplitter(ctx, qR, lw);
                break;
            case 'mini':
                drawMini(ctx, qR, lw);
                break;
            case 'screamer':
                drawScreamer(ctx, qR, lw);
                break;
            case 'healer':
                drawHealer(ctx, qR, lw);
                break;
        }

        ctx.restore();

        const entry = {
            canvas: canvas,
            flash: makeSilhouette(canvas),
            half: pad
        };
        cache.set(key, entry);
        return entry;
    }

    // --- Kreslicí rutiny jednotlivých zombií (orientace čelem doprava = +X) ---

    function drawSpitter(ctx, r, lw) {
        // Krátké ruce vpředu
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(r * 0.45, s * r * 0.72, r * 0.32, r * 0.16, s * 0.35, 0, TWO_PI);
            fillAndStroke(ctx, '#466e38', OUTLINE, lw * 0.9);
        }

        // Nafouklé zelené tělo
        ctx.beginPath();
        ctx.ellipse(-r * 0.1, 0, r * 0.98, r * 0.92, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#3e6833', OUTLINE, lw);

        // Stínování zadní části těla
        ctx.beginPath();
        ctx.arc(-r * 0.2, 0, r * 0.75, Math.PI * 0.55, Math.PI * 1.45);
        ctx.fillStyle = '#2d4d24';
        ctx.fill();

        // Jedové vaky na bocích a zádech
        const sacs = [
            { x: -r * 0.35, y: -r * 0.68, rx: r * 0.38, ry: r * 0.28, a: -0.3 },
            { x: -r * 0.35, y: r * 0.68, rx: r * 0.38, ry: r * 0.28, a: 0.3 },
            { x: -r * 0.78, y: -r * 0.28, rx: r * 0.28, ry: r * 0.24, a: -0.2 },
            { x: -r * 0.75, y: r * 0.32, rx: r * 0.30, ry: r * 0.25, a: 0.2 }
        ];
        for (let i = 0; i < sacs.length; i++) {
            const sc = sacs[i];
            ctx.beginPath();
            ctx.ellipse(sc.x, sc.y, sc.rx, sc.ry, sc.a, 0, TWO_PI);
            fillAndStroke(ctx, '#8be02b', OUTLINE, lw * 0.85);
            // Odlesk na vaku
            ctx.beginPath();
            ctx.ellipse(sc.x - sc.rx * 0.2, sc.y - sc.ry * 0.2, sc.rx * 0.35, sc.ry * 0.25, sc.a, 0, TWO_PI);
            ctx.fillStyle = '#c8ff70';
            ctx.fill();
        }

        // Hlava přecházející do obří otevřené tlamy
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.58, 0, TWO_PI);
        fillAndStroke(ctx, '#528240', OUTLINE, lw);

        // Velká otevřená tlama dopředu
        ctx.beginPath();
        ctx.ellipse(r * 0.68, 0, r * 0.36, r * 0.44, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#1b2e13', OUTLINE, lw * 0.9);

        // Kyselina uvnitř tlamy
        ctx.beginPath();
        ctx.ellipse(r * 0.64, 0, r * 0.22, r * 0.30, 0, 0, TWO_PI);
        ctx.fillStyle = '#7cd91e';
        ctx.fill();

        // Oči vytlačené do stran
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.32, s * r * 0.42, r * 0.14, 0, TWO_PI);
            fillAndStroke(ctx, '#d9ff66', OUTLINE, lw * 0.6);
        }

        // Kapka slin u tlamy
        ctx.beginPath();
        ctx.moveTo(r * 0.95, r * 0.08);
        ctx.quadraticCurveTo(r * 1.28, -r * 0.08, r * 1.25, r * 0.16);
        ctx.quadraticCurveTo(r * 1.22, r * 0.36, r * 1.0, r * 0.22);
        ctx.closePath();
        fillAndStroke(ctx, '#a4ff3d', OUTLINE, lw * 0.7);
    }

    function drawShield(ctx, r, lw) {
        // Ramena v policejní/taktické uniformě
        ctx.beginPath();
        ctx.ellipse(-r * 0.12, 0, r * 0.72, r * 0.92, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#2c3847', OUTLINE, lw);

        // Stín na zádech
        ctx.beginPath();
        ctx.ellipse(-r * 0.28, 0, r * 0.48, r * 0.75, 0, 0, TWO_PI);
        ctx.fillStyle = '#1f2833';
        ctx.fill();

        // Paže držící štít
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(0, s * r * 0.72);
            ctx.lineTo(r * 0.55, s * r * 0.65);
            ctx.lineWidth = r * 0.34;
            ctx.strokeStyle = OUTLINE;
            ctx.stroke();

            ctx.lineWidth = r * 0.22;
            ctx.strokeStyle = '#364659';
            ctx.stroke();

            // Zelené zombie ruce svírající madla štítu
            ctx.beginPath();
            ctx.arc(r * 0.56, s * r * 0.62, r * 0.16, 0, TWO_PI);
            fillAndStroke(ctx, '#5c7853', OUTLINE, lw * 0.75);
        }

        // Hlava v šedomodré přilbě / čepici
        ctx.beginPath();
        ctx.arc(-r * 0.02, 0, r * 0.52, 0, TWO_PI);
        fillAndStroke(ctx, '#587350', OUTLINE, lw);

        // Taktická helma na hlavě
        ctx.beginPath();
        ctx.arc(-r * 0.08, 0, r * 0.50, Math.PI * 0.35, Math.PI * 1.65);
        ctx.closePath();
        fillAndStroke(ctx, '#232f3d', OUTLINE, lw * 0.85);

        // Naštvané oči vykukující za štítem
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.24, s * r * 0.22, r * 0.11, 0, TWO_PI);
            fillAndStroke(ctx, '#e64545', OUTLINE, lw * 0.5);
        }

        // Velký policejní štít vepředu (šedomodrý, zaoblený, s průzorem a nýty)
        const sx = r * 0.62;
        const sy = r * 1.08;
        ctx.beginPath();
        ctx.moveTo(sx, -sy);
        ctx.quadraticCurveTo(sx + r * 0.38, -sy * 0.6, sx + r * 0.38, 0);
        ctx.quadraticCurveTo(sx + r * 0.38, sy * 0.6, sx, sy);
        ctx.lineTo(sx - r * 0.16, sy * 0.92);
        ctx.quadraticCurveTo(sx + r * 0.14, 0, sx - r * 0.16, -sy * 0.92);
        ctx.closePath();
        fillAndStroke(ctx, '#4a607a', OUTLINE, lw * 1.05);

        // Světlejší horní hrana štítu pro 3D čitelnost
        ctx.beginPath();
        ctx.moveTo(sx + r * 0.02, -sy * 0.88);
        ctx.quadraticCurveTo(sx + r * 0.28, 0, sx + r * 0.02, sy * 0.88);
        ctx.strokeStyle = '#6e8bad';
        ctx.lineWidth = r * 0.12;
        ctx.stroke();

        // Průzor uprostřed štítu (světlemodré sklo s mřížkou)
        ctx.beginPath();
        ctx.moveTo(sx + r * 0.10, -r * 0.45);
        ctx.quadraticCurveTo(sx + r * 0.26, 0, sx + r * 0.10, r * 0.45);
        ctx.lineTo(sx + r * 0.26, r * 0.42);
        ctx.quadraticCurveTo(sx + r * 0.38, 0, sx + r * 0.26, -r * 0.42);
        ctx.closePath();
        fillAndStroke(ctx, '#9ad1ed', OUTLINE, lw * 0.7);

        // Nýty po obvodu štítu
        ctx.fillStyle = '#c7d6e6';
        for (let ny of [-0.82, -0.58, 0.58, 0.82]) {
            ctx.beginPath();
            ctx.arc(sx + r * 0.05, sy * ny, r * 0.07, 0, TWO_PI);
            ctx.fill();
            ctx.lineWidth = lw * 0.45;
            ctx.strokeStyle = OUTLINE;
            ctx.stroke();
        }
    }

    function drawLeaper(ctx, r, lw) {
        // Dlouhé zalomené zadní nohy (jako žába/kudlanka)
        for (let s of [-1, 1]) {
            ctx.beginPath();
            // Stehno dozadu do strany
            ctx.moveTo(-r * 0.35, s * r * 0.32);
            ctx.lineTo(-r * 0.95, s * r * 1.15);
            // Lýtko dopředu
            ctx.lineTo(-r * 0.10, s * r * 1.25);
            ctx.lineWidth = r * 0.36;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = OUTLINE;
            ctx.stroke();

            ctx.lineWidth = r * 0.20;
            ctx.strokeStyle = '#3d6342';
            ctx.stroke();

            // Chodidlo s drápy
            ctx.beginPath();
            ctx.moveTo(-r * 0.10, s * r * 1.25);
            ctx.lineTo(r * 0.22, s * r * 1.18);
            ctx.lineWidth = r * 0.18;
            ctx.strokeStyle = OUTLINE;
            ctx.stroke();
            ctx.lineWidth = r * 0.10;
            ctx.strokeStyle = '#528057';
            ctx.stroke();
        }

        // Přední pařáty připravené ke skoku
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(r * 0.25, s * r * 0.38);
            ctx.lineTo(r * 0.85, s * r * 0.65);
            ctx.lineTo(r * 1.12, s * r * 0.35);
            ctx.lineWidth = r * 0.32;
            ctx.strokeStyle = OUTLINE;
            ctx.stroke();

            ctx.lineWidth = r * 0.18;
            ctx.strokeStyle = '#4c7851';
            ctx.stroke();

            // Ostré světlé drápy vpředu
            for (let c = -1; c <= 1; c++) {
                ctx.beginPath();
                ctx.moveTo(r * 1.08, s * r * 0.35 + c * r * 0.09);
                ctx.lineTo(r * 1.32, s * r * 0.26 + c * r * 0.12);
                ctx.lineWidth = lw * 0.7;
                ctx.strokeStyle = '#d8e0c5';
                ctx.stroke();
            }
        }

        // Přikrčené šlachovité tělo
        ctx.beginPath();
        ctx.ellipse(-r * 0.12, 0, r * 0.82, r * 0.54, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#3b5e3f', OUTLINE, lw);

        // Hlava vysunutá dopředu
        ctx.beginPath();
        ctx.ellipse(r * 0.45, 0, r * 0.48, r * 0.44, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#4c7851', OUTLINE, lw);

        // Ostny na zádech (od hlavy dozadu)
        for (let ox of [0.15, -0.22, -0.58]) {
            ctx.beginPath();
            ctx.moveTo(r * (ox + 0.16), 0);
            ctx.lineTo(r * (ox - 0.18), -r * 0.15);
            ctx.lineTo(r * (ox - 0.26), 0);
            ctx.lineTo(r * (ox - 0.18), r * 0.15);
            ctx.closePath();
            fillAndStroke(ctx, '#c7d1a7', OUTLINE, lw * 0.65);
        }

        // Výrazné žluté dravčí oči
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(r * 0.65, s * r * 0.22, r * 0.16, r * 0.11, s * 0.3, 0, TWO_PI);
            fillAndStroke(ctx, '#ffea2e', OUTLINE, lw * 0.6);
            // Zornička
            ctx.beginPath();
            ctx.arc(r * 0.70, s * r * 0.22, r * 0.05, 0, TWO_PI);
            ctx.fillStyle = '#141814';
            ctx.fill();
        }
    }

    function drawSplitter(ctx, r, lw) {
        // Krátké zavalité ruce
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(r * 0.48, s * r * 0.78, r * 0.28, r * 0.18, s * 0.4, 0, TWO_PI);
            fillAndStroke(ctx, '#5e346e', OUTLINE, lw * 0.85);
        }

        // Nafouklé fialové tělo (nepravidelně baňaté)
        ctx.beginPath();
        ctx.arc(-r * 0.08, 0, r * 0.96, 0, TWO_PI);
        fillAndStroke(ctx, '#683a7a', OUTLINE, lw);

        // Stínování těla
        ctx.beginPath();
        ctx.arc(-r * 0.22, 0, r * 0.76, 0, TWO_PI);
        ctx.fillStyle = '#532c63';
        ctx.fill();

        // Tři viditelné zárodky pod kůží (růžovo-fialové boule s očičkama)
        const embryos = [
            { x: -r * 0.25, y: -r * 0.48, rad: r * 0.34, a: -0.6 },
            { x: -r * 0.25, y: r * 0.48, rad: r * 0.34, a: 0.6 },
            { x: -r * 0.58, y: 0, rad: r * 0.32, a: Math.PI }
        ];
        for (let e of embryos) {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.a);
            ctx.beginPath();
            ctx.arc(0, 0, e.rad, 0, TWO_PI);
            fillAndStroke(ctx, '#b856a1', OUTLINE, lw * 0.7);
            // Světlý odlesk zárodku pod napnutou kůží
            ctx.beginPath();
            ctx.arc(-e.rad * 0.2, -e.rad * 0.2, e.rad * 0.5, 0, TWO_PI);
            ctx.fillStyle = '#d97ac3';
            ctx.fill();
            // Dvě malá žlutá očička zárodku
            for (let s of [-1, 1]) {
                ctx.beginPath();
                ctx.arc(e.rad * 0.45, s * e.rad * 0.35, e.rad * 0.18, 0, TWO_PI);
                ctx.fillStyle = '#ffd952';
                ctx.fill();
            }
            ctx.restore();
        }

        // Výrazné žilky přes tělo
        ctx.strokeStyle = '#a83c86';
        ctx.lineWidth = lw * 0.55;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-r * 0.25, -r * 0.45);
        ctx.moveTo(0, 0);
        ctx.lineTo(-r * 0.25, r * 0.45);
        ctx.moveTo(0, 0);
        ctx.lineTo(-r * 0.55, 0);
        ctx.stroke();

        // Hlava vpředu
        ctx.beginPath();
        ctx.arc(r * 0.42, 0, r * 0.46, 0, TWO_PI);
        fillAndStroke(ctx, '#7a468f', OUTLINE, lw * 0.9);

        // Oči Děliče
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.64, s * r * 0.20, r * 0.12, 0, TWO_PI);
            fillAndStroke(ctx, '#ff66b5', OUTLINE, lw * 0.55);
        }
    }

    function drawMini(ctx, r, lw) {
        // Malý ocásek / úponek vzadu
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, 0);
        ctx.quadraticCurveTo(-r * 1.25, -r * 0.35, -r * 1.35, r * 0.15);
        ctx.lineWidth = r * 0.35;
        ctx.lineCap = 'round';
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        ctx.lineWidth = r * 0.18;
        ctx.strokeStyle = '#b54ca0';
        ctx.stroke();

        // Fialovo-růžové tělíčko zárodku
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.95, r * 0.82, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#d463b8', OUTLINE, Math.max(1.5, lw * 1.1));

        // Zoubky vpředu
        ctx.beginPath();
        ctx.arc(r * 0.55, 0, r * 0.38, -0.8, 0.8);
        fillAndStroke(ctx, '#38122e', OUTLINE, lw * 0.7);

        ctx.fillStyle = '#ffffff';
        for (let ty of [-0.22, 0, 0.22]) {
            ctx.beginPath();
            ctx.arc(r * 0.75, r * ty, r * 0.11, 0, TWO_PI);
            ctx.fill();
        }

        // Velké vykulené oči
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.28, s * r * 0.46, r * 0.30, 0, TWO_PI);
            fillAndStroke(ctx, '#fff275', OUTLINE, lw * 0.75);

            ctx.beginPath();
            ctx.arc(r * 0.36, s * r * 0.46, r * 0.11, 0, TWO_PI);
            ctx.fillStyle = OUTLINE;
            ctx.fill();
        }
    }

    function drawScreamer(ctx, r, lw) {
        // Kostnaté bledé ruce chytající se za hlavu
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(-r * 0.1, s * r * 0.65);
            ctx.lineTo(r * 0.35, s * r * 0.95);
            ctx.lineTo(r * 0.55, s * r * 0.52);
            ctx.lineWidth = r * 0.28;
            ctx.strokeStyle = OUTLINE;
            ctx.stroke();

            ctx.lineWidth = r * 0.15;
            ctx.strokeStyle = '#b8c4bc';
            ctx.stroke();
        }

        // Vyhublé bledé tělo s viditelnými žebry
        ctx.beginPath();
        ctx.ellipse(-r * 0.18, 0, r * 0.68, r * 0.74, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#9eae9f', OUTLINE, lw);

        // Naznačená žebra
        ctx.strokeStyle = '#6e7d70';
        ctx.lineWidth = lw * 0.65;
        for (let rx of [-0.42, -0.22]) {
            ctx.beginPath();
            ctx.moveTo(r * rx, -r * 0.45);
            ctx.lineTo(r * rx, r * 0.45);
            ctx.stroke();
        }

        // Bledá hlava s obří dokořán otevřenou tlamou
        ctx.beginPath();
        ctx.ellipse(r * 0.28, 0, r * 0.56, r * 0.54, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#c7d6c9', OUTLINE, lw);

        // Obří černorudá tlama plná zubů
        ctx.beginPath();
        ctx.ellipse(r * 0.52, 0, r * 0.38, r * 0.44, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#2b0f14', OUTLINE, lw * 0.9);

        // Řada ostrých bílých zubů po obvodu tlamy
        ctx.fillStyle = '#f0f5f1';
        for (let a = -1.2; a <= 1.2; a += 0.48) {
            const tx = r * 0.52 + Math.cos(a) * r * 0.32;
            const ty = Math.sin(a) * r * 0.36;
            ctx.beginPath();
            ctx.arc(tx, ty, r * 0.08, 0, TWO_PI);
            ctx.fill();
        }

        // Bílé oči v transu
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.15, s * r * 0.34, r * 0.11, 0, TWO_PI);
            fillAndStroke(ctx, '#ffffff', OUTLINE, lw * 0.55);
        }

        // Zvukové vlny před tlamou (součást spritu pro okamžitou čitelnost)
        ctx.lineCap = 'round';
        for (let i = 1; i <= 2; i++) {
            const wr = r * (0.75 + i * 0.30);
            ctx.beginPath();
            ctx.arc(r * 0.35, 0, wr, -0.58, 0.58);
            ctx.strokeStyle = i === 1 ? 'rgba(220, 255, 245, 0.85)' : 'rgba(160, 235, 220, 0.55)';
            ctx.lineWidth = lw * (1.0 - i * 0.2);
            ctx.stroke();
        }
    }

    function drawHealer(ctx, r, lw) {
        // Batoh na zádech se třemi svítícími zelenými lahvičkami
        ctx.beginPath();
        ctx.roundRect(-r * 1.08, -r * 0.62, r * 0.62, r * 1.24, r * 0.15);
        fillAndStroke(ctx, '#3b423e', OUTLINE, lw * 0.9);

        // Tři zelené lahvičky na batohu
        for (let vy of [-0.36, 0, 0.36]) {
            ctx.beginPath();
            ctx.ellipse(-r * 0.88, r * vy, r * 0.24, r * 0.13, 0, 0, TWO_PI);
            fillAndStroke(ctx, '#2dff57', OUTLINE, lw * 0.65);

            // Svítící střed lahvičky
            ctx.beginPath();
            ctx.ellipse(-r * 0.88, r * vy, r * 0.14, r * 0.06, 0, 0, TWO_PI);
            ctx.fillStyle = '#c8ffd4';
            ctx.fill();
        }

        // Ruce v bílých rukávech
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(r * 0.42, s * r * 0.72, r * 0.34, r * 0.18, s * 0.25, 0, TWO_PI);
            fillAndStroke(ctx, '#cfd9d1', OUTLINE, lw * 0.85);
            // Zelená ruka
            ctx.beginPath();
            ctx.arc(r * 0.70, s * r * 0.76, r * 0.14, 0, TWO_PI);
            fillAndStroke(ctx, '#5c8058', OUTLINE, lw * 0.7);
        }

        // Tělo v potrhaném bílém lékařském plášti
        ctx.beginPath();
        ctx.ellipse(-r * 0.08, 0, r * 0.78, r * 0.88, 0, 0, TWO_PI);
        fillAndStroke(ctx, '#dce6de', OUTLINE, lw);

        // Stín na plášti
        ctx.beginPath();
        ctx.arc(-r * 0.15, 0, r * 0.68, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#b8c7bc';
        ctx.fill();

        // Výrazný zelený zdravotnický kříž na plášti/zádech
        const cx = -r * 0.22;
        const cw = r * 0.48;
        const ct = r * 0.18;
        ctx.beginPath();
        ctx.rect(cx - cw * 0.5, -ct * 0.5, cw, ct);
        ctx.rect(cx - ct * 0.5, -cw * 0.5, ct, cw);
        ctx.fillStyle = '#20c945';
        ctx.fill();
        ctx.lineWidth = lw * 0.5;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();

        // Hlava uzdravovače
        ctx.beginPath();
        ctx.arc(r * 0.34, 0, r * 0.48, 0, TWO_PI);
        fillAndStroke(ctx, '#688f64', OUTLINE, lw);

        // Lékařské čelní zrcátko na hlavě
        ctx.beginPath();
        ctx.arc(r * 0.78, 0, r * 0.16, 0, TWO_PI);
        fillAndStroke(ctx, '#a8e6cf', OUTLINE, lw * 0.6);

        // Svítící zelené oči
        for (let s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.52, s * r * 0.22, r * 0.10, 0, TWO_PI);
            fillAndStroke(ctx, '#5eff7e', OUTLINE, lw * 0.5);
        }
    }

    ZS.zombieExtra = function (ctx, type, x, y, r, angle, ts, hitFlash) {
        if (!ctx || !ZOMBIE_TYPES[type]) return false;
        const rad = r || 16;
        const time = ts || 0;
        const sprite = getZombieSprite(type, rad);

        ctx.save();
        try {
            // Měkký stín pod zombie (elipsa posunutá doprava dolů)
            ctx.beginPath();
            ctx.ellipse(x + rad * 0.18, y + rad * 0.24, rad * 0.95, rad * 0.78, 0, 0, TWO_PI);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
            ctx.fill();

            // Jemné kývání při chůzi a specifické animace podle typu
            let swayFreq = 0.009;
            let swayAmp = 0.11;
            let scaleX = rad / Math.max(4, Math.round(rad));
            let scaleY = scaleX;

            if (type === 'mini') {
                // Drobek se rychle kroutí
                swayFreq = 0.024;
                swayAmp = 0.26;
            } else if (type === 'spitter') {
                // Plivač se mírně nafukuje a vyfukuje
                const pulse = Math.sin(time * 0.007) * 0.06;
                scaleX *= (1 + pulse);
                scaleY *= (1 - pulse * 0.6);
            } else if (type === 'splitter') {
                // Dělič těžce pulzuje
                const pulse = Math.sin(time * 0.006) * 0.045;
                scaleX *= (1 + pulse);
                scaleY *= (1 + pulse);
                swayFreq = 0.006;
                swayAmp = 0.08;
            } else if (type === 'shield') {
                swayFreq = 0.007;
                swayAmp = 0.06;
            }

            const sway = Math.sin(time * swayFreq + (x + y) * 0.03) * swayAmp;

            ctx.translate(x, y);
            ctx.rotate((angle || 0) + sway);
            ctx.scale(scaleX, scaleY);

            ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half);

            // HitFlash — překrytí bílou siluetou
            if (hitFlash && hitFlash > 0) {
                ctx.globalAlpha = Math.min(1, Math.max(0, hitFlash));
                ctx.drawImage(sprite.flash, -sprite.half, -sprite.half);
            }
        } finally {
            ctx.restore();
        }
        return true;
    };

    // ============================================================================
    // 2) MAPA 3 „LOM" (písečný lom) — ZS.floorQuarry & ZS.wallQuarry
    // ============================================================================

    function getQuarryFloorTile() {
        const key = 'quarry_floor_256';
        if (cache.has(key)) return cache.get(key);

        const S = 256;
        const canvas = makeCanvas(S, S);
        const ctx = canvas.getContext('2d');
        const rng = createRNG(40921);

        // Základní tmavší teplý písek (aby ladil s tmavým UI)
        ctx.fillStyle = '#473929';
        ctx.fillRect(0, 0, S, S);

        // Pomocná funkce pro kreslení s navazováním přes okraje dlaždice (9 kopií)
        function drawSeamless(fn) {
            for (let ox = -S; ox <= S; ox += S) {
                for (let oy = -S; oy <= S; oy += S) {
                    ctx.save();
                    ctx.translate(ox, oy);
                    fn();
                    ctx.restore();
                }
            }
        }

        // 2-3 tóny teplého písku (větší nepravidelné skvrny)
        for (let i = 0; i < 24; i++) {
            const px = rng() * S;
            const py = rng() * S;
            const rx = 22 + rng() * 42;
            const ry = 16 + rng() * 34;
            const rot = rng() * Math.PI;
            const col = i % 2 === 0 ? '#52422f' : '#3d3022';
            drawSeamless(function () {
                ctx.beginPath();
                ctx.ellipse(px, py, rx, ry, rot, 0, TWO_PI);
                ctx.fillStyle = col;
                ctx.fill();
            });
        }

        // Místa šedého štěrku
        for (let i = 0; i < 10; i++) {
            const gx = rng() * S;
            const gy = rng() * S;
            const grx = 14 + rng() * 24;
            const gry = 10 + rng() * 18;
            const grot = rng() * Math.PI;
            drawSeamless(function () {
                ctx.beginPath();
                ctx.ellipse(gx, gy, grx, gry, grot, 0, TWO_PI);
                ctx.fillStyle = '#3f3d38';
                ctx.fill();
            });
        }

        // Vyschlé praskliny v zemi
        ctx.strokeStyle = '#261e15';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < 9; i++) {
            const cx = rng() * S;
            const cy = rng() * S;
            const segs = 3 + Math.floor(rng() * 3);
            const pts = [{ x: cx, y: cy }];
            let curA = rng() * TWO_PI;
            for (let s = 0; s < segs; s++) {
                curA += (rng() - 0.5) * 1.1;
                const len = 10 + rng() * 16;
                const last = pts[pts.length - 1];
                pts.push({ x: last.x + Math.cos(curA) * len, y: last.y + Math.sin(curA) * len });
            }
            drawSeamless(function () {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
                ctx.stroke();
                // Boční větvička praskliny
                if (pts.length > 2) {
                    ctx.beginPath();
                    ctx.moveTo(pts[1].x, pts[1].y);
                    ctx.lineTo(pts[1].x + 8, pts[1].y - 7);
                    ctx.stroke();
                }
            });
        }

        // Drobné kamínky
        for (let i = 0; i < 48; i++) {
            const kx = rng() * S;
            const ky = rng() * S;
            const kr = 1.8 + rng() * 3.0;
            const col = rng() > 0.5 ? '#5c554c' : '#332b22';
            drawSeamless(function () {
                ctx.beginPath();
                ctx.arc(kx, ky, kr, 0, TWO_PI);
                ctx.fillStyle = col;
                ctx.fill();
            });
        }

        // Suché keříky (větvičky s malým stínem)
        for (let i = 0; i < 6; i++) {
            const bx = rng() * S;
            const by = rng() * S;
            const br = 7 + rng() * 5;
            drawSeamless(function () {
                ctx.beginPath();
                ctx.arc(bx + 2, by + 2, br * 0.85, 0, TWO_PI);
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fill();

                ctx.strokeStyle = '#141814';
                ctx.lineWidth = 3.0;
                for (let b = 0; b < 5; b++) {
                    const a = (b / 5) * TWO_PI + 0.3;
                    ctx.beginPath();
                    ctx.moveTo(bx, by);
                    ctx.lineTo(bx + Math.cos(a) * br, by + Math.sin(a) * br);
                    ctx.stroke();
                }
                ctx.strokeStyle = '#635338';
                ctx.lineWidth = 1.5;
                for (let b = 0; b < 5; b++) {
                    const a = (b / 5) * TWO_PI + 0.3;
                    ctx.beginPath();
                    ctx.moveTo(bx, by);
                    ctx.lineTo(bx + Math.cos(a) * br, by + Math.sin(a) * br);
                    ctx.stroke();
                }
            });
        }

        cache.set(key, canvas);
        return canvas;
    }

    ZS.floorQuarry = function (ctx, x, y, w, h) {
        if (!ctx || w <= 0 || h <= 0) return;
        ctx.save();
        try {
            const tile = getQuarryFloorTile();
            if (!cache.has('quarry_pattern')) {
                cache.set('quarry_pattern', ctx.createPattern(tile, 'repeat'));
            }
            const pat = cache.get('quarry_pattern');
            if (pat) {
                ctx.fillStyle = pat;
                ctx.fillRect(x, y, w, h);
            } else {
                ctx.fillStyle = '#473929';
                ctx.fillRect(x, y, w, h);
            }
        } finally {
            ctx.restore();
        }
    };

    function getQuarryWallSprite(w, h) {
        const qw = Math.max(8, Math.round(w));
        const qh = Math.max(8, Math.round(h));
        const key = 'wall_q_' + qw + 'x' + qh;
        if (cache.has(key)) return cache.get(key);

        const pad = 10; // Pro přesah stínu vpravo dole
        const canvas = makeCanvas(qw + pad * 2, qh + pad * 2);
        const ctx = canvas.getContext('2d');
        const rng = createRNG((qw * 73856093) ^ (qh * 19349663));

        ctx.save();
        ctx.translate(pad, pad);

        // Rozdělení obdélníku w × h na 1–4 balvany podle poměru stran
        const cells = [];
        const ratio = qw / qh;
        if (ratio >= 1.5) {
            const n = Math.min(4, Math.max(2, Math.round(ratio)));
            const cw = qw / n;
            for (let i = 0; i < n; i++) cells.push({ x: i * cw, y: 0, w: cw, h: qh });
        } else if (ratio <= 1 / 1.5) {
            const n = Math.min(4, Math.max(2, Math.round(1 / ratio)));
            const ch = qh / n;
            for (let i = 0; i < n; i++) cells.push({ x: 0, y: i * ch, w: qw, h: ch });
        } else if (qw >= 85 && qh >= 85) {
            const cw = qw / 2, ch = qh / 2;
            cells.push(
                { x: 0, y: 0, w: cw, h: ch },
                { x: cw, y: 0, w: cw, h: ch },
                { x: 0, y: ch, w: cw, h: ch },
                { x: cw, y: ch, w: cw, h: ch }
            );
        } else {
            cells.push({ x: 0, y: 0, w: qw, h: qh });
        }

        // Pomocná funkce pro vygenerování polygonu balvanu, který vyplní téměř celý svůj díl
        function makeBoulderPoly(c) {
            const m = 1.5;
            const x0 = c.x + m, y0 = c.y + m;
            const x1 = c.x + c.w - m, y1 = c.y + c.h - m;
            const bw = x1 - x0, bh = y1 - y0;
            const chX = Math.min(bw * 0.17, 10);
            const chY = Math.min(bh * 0.17, 10);
            const j = function () { return (rng() - 0.5) * 3.2; };

            return [
                { x: x0 + chX + j(), y: y0 + Math.abs(j()) },
                { x: x0 + bw * 0.5 + j(), y: y0 + Math.abs(j()) * 0.8 },
                { x: x1 - chX + j(), y: y0 + Math.abs(j()) },
                { x: x1 - Math.abs(j()), y: y0 + chY + j() },
                { x: x1 - Math.abs(j()) * 0.8, y: y0 + bh * 0.5 + j() },
                { x: x1 - Math.abs(j()), y: y1 - chY + j() },
                { x: x1 - chX + j(), y: y1 - Math.abs(j()) },
                { x: x0 + bw * 0.5 + j(), y: y1 - Math.abs(j()) * 0.8 },
                { x: x0 + chX + j(), y: y1 - Math.abs(j()) },
                { x: x0 + Math.abs(j()), y: y1 - chY + j() },
                { x: x0 + Math.abs(j()) * 0.8, y: y0 + bh * 0.5 + j() },
                { x: x0 + Math.abs(j()), y: y0 + chY + j() }
            ];
        }

        const boulders = cells.map(function (c) {
            return { cell: c, pts: makeBoulderPoly(c) };
        });

        // 1. Vrstva: stíny pod všemi balvany
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        for (let b of boulders) {
            ctx.beginPath();
            ctx.moveTo(b.pts[0].x + 5, b.pts[0].y + 6);
            for (let i = 1; i < b.pts.length; i++) {
                ctx.lineTo(b.pts[i].x + 5, b.pts[i].y + 6);
            }
            ctx.closePath();
            ctx.fill();
        }

        // 2. Vrstva: samotné balvany se stínováním, ploškami a prasklinami
        for (let b of boulders) {
            const pts = b.pts;
            const c = b.cell;
            const cx = c.x + c.w * (0.44 + (rng() - 0.5) * 0.1);
            const cy = c.y + c.h * (0.44 + (rng() - 0.5) * 0.1);

            // Základní pískovcová barva balvanu
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStyle = '#786146';
            ctx.fill();

            // Osvětlená ploška vlevo nahoře
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for (let i = 9; i < 12; i++) ctx.lineTo(pts[i].x, pts[i].y);
            for (let i = 0; i <= 3; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStyle = '#917657';
            ctx.fill();

            // Stinná ploška vpravo dole
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for (let i = 3; i <= 9; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStyle = '#574531';
            ctx.fill();

            // Horní plochý vršek skály
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const px = cx + (pts[i].x - cx) * 0.56;
                const py = cy + (pts[i].y - cy) * 0.56;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = '#856c4f';
            ctx.fill();

            // Prasklina na balvanu
            ctx.beginPath();
            ctx.moveTo(cx - c.w * 0.18, cy - c.h * 0.08);
            ctx.lineTo(cx + c.w * 0.04, cy + c.h * 0.05);
            ctx.lineTo(cx + c.w * 0.22, cy - c.h * 0.12);
            ctx.moveTo(cx + c.w * 0.04, cy + c.h * 0.05);
            ctx.lineTo(cx + c.w * 0.10, cy + c.h * 0.24);
            ctx.strokeStyle = '#292017';
            ctx.lineWidth = 2.0;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Tlustý tmavý obrys balvanu
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 3.4;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        ctx.restore();
        const entry = { canvas: canvas, pad: pad };
        cache.set(key, entry);
        return entry;
    }

    ZS.wallQuarry = function (ctx, x, y, w, h) {
        if (!ctx || w <= 0 || h <= 0) return;
        ctx.save();
        try {
            const spr = getQuarryWallSprite(w, h);
            ctx.drawImage(spr.canvas, x - spr.pad, y - spr.pad);
        } finally {
            ctx.restore();
        }
    };

    // ============================================================================
    // 3) PÍSEČNÝ ČERV — ZS.worm(ctx, phase, x, y, R, p, ts)
    // ============================================================================

    function getWormMouthSprite(R) {
        const qR = Math.max(20, Math.round(R));
        const key = 'worm_mouth_' + qR;
        if (cache.has(key)) return cache.get(key);

        const pad = 10;
        const size = (qR + pad) * 2;
        const canvas = makeCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const lw = Math.max(2.2, qR * 0.045);

        ctx.save();
        ctx.translate(qR + pad, qR + pad);

        // Vnější temný podklad tlamy
        ctx.beginPath();
        ctx.arc(0, 0, qR * 0.92, 0, TWO_PI);
        fillAndStroke(ctx, '#1b140e', OUTLINE, lw * 1.2);

        // Článkovaný okraj těla (béžovo-hnědé segmenty s obrysem)
        const segCount = 16;
        for (let i = 0; i < segCount; i++) {
            const a0 = (i / segCount) * TWO_PI;
            const a1 = ((i + 1) / segCount) * TWO_PI;
            const rOuter = qR * 0.95;
            const rInner = qR * 0.66;

            ctx.beginPath();
            ctx.arc(0, 0, rOuter, a0, a1);
            ctx.arc(0, 0, rInner, a1, a0, true);
            ctx.closePath();
            fillAndStroke(ctx, i % 2 === 0 ? '#9c7a54' : '#856542', OUTLINE, lw * 0.85);

            // Světlejší béžový pruh na každém segmentu
            ctx.beginPath();
            ctx.arc(0, 0, rOuter - qR * 0.06, a0 + 0.04, a1 - 0.04);
            ctx.strokeStyle = '#ba966d';
            ctx.lineWidth = qR * 0.05;
            ctx.stroke();
        }

        // Temný jícen uvnitř
        ctx.beginPath();
        ctx.arc(0, 0, qR * 0.67, 0, TWO_PI);
        fillAndStroke(ctx, '#291512', OUTLINE, lw);

        ctx.beginPath();
        ctx.arc(0, 0, qR * 0.44, 0, TWO_PI);
        ctx.fillStyle = '#120807';
        ctx.fill();

        // 1. (vnější) soustředná řada bílých zubů směřujících do středu
        const outerTeeth = 18;
        for (let i = 0; i < outerTeeth; i++) {
            const a = (i / outerTeeth) * TWO_PI;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(qR * 0.66, -qR * 0.065);
            ctx.lineTo(qR * 0.43, 0);
            ctx.lineTo(qR * 0.66, qR * 0.065);
            ctx.closePath();
            fillAndStroke(ctx, '#ebe3d5', OUTLINE, lw * 0.55);
            ctx.restore();
        }

        // 2. (vnitřní) soustředná řada bílých zubů
        const innerTeeth = 12;
        for (let i = 0; i < innerTeeth; i++) {
            const a = ((i + 0.5) / innerTeeth) * TWO_PI;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(qR * 0.42, -qR * 0.055);
            ctx.lineTo(qR * 0.22, 0);
            ctx.lineTo(qR * 0.42, qR * 0.055);
            ctx.closePath();
            fillAndStroke(ctx, '#d9ceb8', OUTLINE, lw * 0.5);
            ctx.restore();
        }

        // Nejhlubší propast jícnu
        ctx.beginPath();
        ctx.arc(0, 0, qR * 0.20, 0, TWO_PI);
        ctx.fillStyle = '#070303';
        ctx.fill();

        ctx.restore();
        const entry = { canvas: canvas, half: qR + pad };
        cache.set(key, entry);
        return entry;
    }

    ZS.worm = function (ctx, phase, x, y, R, p, ts) {
        if (!ctx) return;
        const rad = R || 85;
        const prog = Math.max(0, Math.min(1, p || 0));
        const time = ts || 0;

        ctx.save();
        try {
            ctx.translate(x, y);

            if (phase === 'warn') {
                // Kroužek praskající a propadající se země rostoucí s p
                const sinkR = rad * (0.25 + 0.72 * prog);
                ctx.beginPath();
                ctx.arc(0, 0, sinkR, 0, TWO_PI);
                ctx.fillStyle = 'rgba(32, 24, 15, 0.55)';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(0, 0, sinkR * 0.65, 0, TWO_PI);
                ctx.fillStyle = 'rgba(18, 13, 8, 0.55)';
                ctx.fill();

                // Praskliny šířící se od středu
                ctx.strokeStyle = '#141814';
                ctx.lineWidth = 2.4;
                ctx.lineCap = 'round';
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * TWO_PI + 0.2;
                    const len = sinkR * (0.75 + (i % 2) * 0.22);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a + 0.12) * len * 0.5, Math.sin(a + 0.12) * len * 0.5);
                    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
                    ctx.stroke();
                }

                // Poskakující kamínky uvnitř zóny
                for (let i = 0; i < 10; i++) {
                    const a = i * 2.39996;
                    const dist = (0.18 + (i / 10) * 0.72) * sinkR;
                    const bounce = Math.abs(Math.sin(time * 0.018 + i * 1.7)) * (6 + prog * 8);
                    const px = Math.cos(a) * dist;
                    const py = Math.sin(a) * dist;

                    // Stín kamínku
                    ctx.beginPath();
                    ctx.arc(px, py + 2, 3.2, 0, TWO_PI);
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.fill();

                    // Poskakující kamínek
                    ctx.beginPath();
                    ctx.arc(px, py - bounce, 3.5 + (i % 2), 0, TWO_PI);
                    fillAndStroke(ctx, '#786146', OUTLINE, 1.4);
                }

                // Výrazný červeně čárkovaný obvod nebezpečné zóny
                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, TWO_PI);
                ctx.fillStyle = 'rgba(220, 40, 30, ' + (0.08 + 0.12 * Math.sin(time * 0.015)) + ')';
                ctx.fill();
                ctx.setLineDash([12, 8]);
                ctx.lineDashOffset = -time * 0.04;
                ctx.strokeStyle = '#ff3322';
                ctx.lineWidth = 3.2;
                ctx.stroke();
                ctx.setLineDash([]);

            } else if (phase === 'strike' || phase === 'dive') {
                // Rozhrabaný písek po obvodu díry
                const moundR = phase === 'dive' ? rad * (1 - prog * 0.18) : rad;
                ctx.beginPath();
                ctx.arc(0, 0, moundR * 1.04, 0, TWO_PI);
                fillAndStroke(ctx, '#362a1d', OUTLINE, 2.5);

                // Hrroudy rozhrabaného písku po obvodu
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TWO_PI;
                    const mx = Math.cos(a) * moundR * 0.92;
                    const my = Math.sin(a) * moundR * 0.92;
                    ctx.beginPath();
                    ctx.arc(mx, my, rad * 0.16, 0, TWO_PI);
                    fillAndStroke(ctx, '#594631', OUTLINE, 1.8);
                }

                // Výpočet měřítka tlamy
                let mouthScale = 1;
                if (phase === 'strike') {
                    // Na začátku (p < 0.3) rychle naroste s lehkým překmitem
                    if (prog < 0.3) {
                        const t = prog / 0.3;
                        mouthScale = 0.15 + Math.sin(t * Math.PI * 0.5) * 0.92;
                    } else {
                        mouthScale = 1.07 - ((prog - 0.3) / 0.7) * 0.07;
                    }
                } else {
                    // 'dive': tlama se zmenšuje a zalézá zpět
                    mouthScale = Math.max(0, 1 - prog);
                }

                if (mouthScale > 0.04) {
                    const mouth = getWormMouthSprite(rad);
                    ctx.save();
                    ctx.rotate(prog * (phase === 'strike' ? 0.45 : -0.6));
                    ctx.scale(mouthScale, mouthScale);
                    ctx.drawImage(mouth.canvas, -mouth.half, -mouth.half);
                    ctx.restore();
                }

                // Do stran odletující písek a kamení při vynoření
                if (phase === 'strike' && prog < 0.75) {
                    const burst = prog / 0.75;
                    ctx.globalAlpha = 1 - burst;
                    for (let i = 0; i < 14; i++) {
                        const a = i * (TWO_PI / 14) + 0.15;
                        const dist = rad * (0.55 + burst * (0.65 + (i % 3) * 0.18));
                        const dx = Math.cos(a) * dist;
                        const dy = Math.sin(a) * dist;
                        ctx.beginPath();
                        ctx.arc(dx, dy, 4 + (i % 3) * 2, 0, TWO_PI);
                        fillAndStroke(ctx, i % 2 === 0 ? '#856c4f' : '#574531', OUTLINE, 1.6);
                    }
                    ctx.globalAlpha = 1;
                }
            }
        } finally {
            ctx.restore();
        }
    };

    // ============================================================================
    // 4) KYSELINA OD PLIVAČE — ZS.spit & ZS.acidPool
    // ============================================================================

    function getSpitDropSprite() {
        const key = 'spit_drop';
        if (cache.has(key)) return cache.get(key);

        const canvas = makeCanvas(28, 28);
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(14, 14);

        // Zelená kapka s obrysem
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, TWO_PI);
        fillAndStroke(ctx, '#7ce81c', OUTLINE, 2.2);

        // Vnitřní jasnější vrstva
        ctx.beginPath();
        ctx.arc(-1, -1, 4.8, 0, TWO_PI);
        ctx.fillStyle = '#adff47';
        ctx.fill();

        // Lesklý bílý odlesk
        ctx.beginPath();
        ctx.arc(-2.5, -2.5, 2.0, 0, TWO_PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
        cache.set(key, canvas);
        return canvas;
    }

    ZS.spit = function (ctx, x, y, h, ts) {
        if (!ctx) return;
        const height = Math.max(0, h || 0);
        const time = ts || 0;

        ctx.save();
        try {
            // Malý stín na zemi (x, y)
            const shadowScale = Math.max(0.45, 1 - height * 0.006);
            ctx.beginPath();
            ctx.ellipse(x, y, 7 * shadowScale, 4.5 * shadowScale, 0, 0, TWO_PI);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
            ctx.fill();

            // Kapka nakreslená o h px výš
            const drop = getSpitDropSprite();
            const wobble = 1 + Math.sin(time * 0.025) * 0.08;
            ctx.translate(x, y - height);
            ctx.scale(wobble, 2 - wobble);
            ctx.drawImage(drop, -14, -14);
        } finally {
            ctx.restore();
        }
    };

    function getAcidPoolBase() {
        const key = 'acid_pool_base';
        if (cache.has(key)) return cache.get(key);

        const W = 56, H = 42;
        const canvas = makeCanvas(W, H);
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(W / 2, H / 2);

        // Nepravidelná louže kyseliny (cca 44 × 30 px)
        ctx.beginPath();
        const lobes = 12;
        for (let i = 0; i <= lobes; i++) {
            const a = (i / lobes) * TWO_PI;
            const mod = 1 + 0.10 * Math.sin(i * 3) + 0.07 * Math.cos(i * 2);
            const px = Math.cos(a) * 22 * mod;
            const py = Math.sin(a) * 15 * mod;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        fillAndStroke(ctx, '#4ea819', OUTLINE, 2.4);

        // Světlejší toxický střed louže
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 9.5, 0.1, 0, TWO_PI);
        ctx.fillStyle = '#85eb26';
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(-3, -1, 8, 4.5, -0.1, 0, TWO_PI);
        ctx.fillStyle = '#b9ff57';
        ctx.fill();

        ctx.restore();
        cache.set(key, canvas);
        return canvas;
    }

    ZS.acidPool = function (ctx, x, y, fade, ts) {
        if (!ctx) return;
        const f = fade === undefined ? 1 : Math.max(0, Math.min(1, fade));
        if (f <= 0.01) return;
        const time = ts || 0;

        ctx.save();
        try {
            ctx.globalAlpha = f;
            ctx.translate(x, y);
            const scale = 0.65 + 0.35 * f;
            ctx.scale(scale, scale);

            const base = getAcidPoolBase();
            ctx.drawImage(base, -28, -21);

            // Probublávání kyseliny podle ts
            const bubbles = [
                { x: -9, y: -3, speed: 0.0035, phase: 0.0 },
                { x: 7, y: 2, speed: 0.0042, phase: 1.3 },
                { x: -1, y: 5, speed: 0.0038, phase: 2.7 },
                { x: 4, y: -5, speed: 0.0048, phase: 4.1 }
            ];
            for (let b of bubbles) {
                const cycle = (time * b.speed + b.phase) % 1;
                const br = 1.2 + cycle * 3.4;
                ctx.beginPath();
                ctx.arc(b.x, b.y - cycle * 2.5, br, 0, TWO_PI);
                fillAndStroke(ctx, '#d4ff80', OUTLINE, 1.2);
            }
        } finally {
            ctx.restore();
        }
    };

    // ============================================================================
    // 5) ELEKTRICKÝ PLOT S DRÁTY — ZS.fenceLinked(ctx, cx, cy, size, powered, links, ts)
    // ============================================================================

    function getFencePostSprite(powered) {
        const key = 'fence_post_' + (powered ? 'on' : 'off');
        if (cache.has(key)) return cache.get(key);

        const S = 36;
        const canvas = makeCanvas(S, S);
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(S / 2, S / 2);

        // Stín sloupku
        ctx.beginPath();
        ctx.ellipse(2.5, 3, 10, 9, 0, 0, TWO_PI);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();

        // Kovová základna sloupku
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, TWO_PI);
        fillAndStroke(ctx, '#47525c', OUTLINE, 2.4);

        // Keramický/skleněný izolátor uprostřed
        ctx.beginPath();
        ctx.arc(0, 0, 6.2, 0, TWO_PI);
        fillAndStroke(ctx, powered ? '#ffe033' : '#7c8b99', OUTLINE, 1.8);

        // Středový vršek izolátoru
        ctx.beginPath();
        ctx.arc(-1.2, -1.2, 2.6, 0, TWO_PI);
        ctx.fillStyle = powered ? '#ffffff' : '#b0becc';
        ctx.fill();

        ctx.restore();
        cache.set(key, canvas);
        return canvas;
    }

    ZS.fenceLinked = function (ctx, cx, cy, size, powered, links, ts) {
        if (!ctx) return;
        const s = size || 50;
        const half = s * 0.5;
        const time = ts || 0;
        const lnk = links || {};
        const hasAny = !!(lnk.n || lnk.e || lnk.s || lnk.w);

        ctx.save();
        try {
            ctx.translate(cx, cy);

            // Pomocná funkce pro vykreslení dvou rovnoběžných drátů v daném směru
            function drawWires(dx, dy, len) {
                const px = -dy;
                const py = dx;
                const sep = 3.2; // Rozestup dvou rovnoběžných drátů

                // Stín drátů na zemi
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
                ctx.lineWidth = 2.6;
                for (let side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(px * sep * side + 2, py * sep * side + 3);
                    ctx.lineTo(dx * len + px * sep * side + 2, dy * len + py * sep * side + 3);
                    ctx.stroke();
                }

                // Tmavý obrys drátů
                ctx.strokeStyle = OUTLINE;
                ctx.lineWidth = 4.2;
                ctx.lineCap = 'butt';
                for (let side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(px * sep * side, py * sep * side);
                    ctx.lineTo(dx * len + px * sep * side, dy * len + py * sep * side);
                    ctx.stroke();
                }

                // Vnitřní barva drátů (žlutě svítící pod proudem, šedá bez proudu)
                ctx.strokeStyle = powered ? '#ffea38' : '#8b969e';
                ctx.lineWidth = 2.0;
                for (let side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(px * sep * side, py * sep * side);
                    ctx.lineTo(dx * len + px * sep * side, dy * len + py * sep * side);
                    ctx.stroke();
                }

                // Elektrický výboj podél drátu, pokud je pod proudem
                if (powered && len > 12) {
                    const phase = Math.floor(time * 0.025 + cx * 0.1 + cy * 0.1);
                    const side = (phase % 2 === 0) ? 1 : -1;
                    ctx.beginPath();
                    ctx.moveTo(px * sep * side, py * sep * side);
                    const mid1 = len * 0.35;
                    const mid2 = len * 0.70;
                    const jitter = ((phase % 3) - 1) * 3.2;
                    ctx.lineTo(dx * mid1 + px * (sep * side + jitter), dy * mid1 + py * (sep * side + jitter));
                    ctx.lineTo(dx * mid2 + px * (sep * side - jitter), dy * mid2 + py * (sep * side - jitter));
                    ctx.lineTo(dx * len + px * sep * side, dy * len + py * sep * side);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.1;
                    ctx.stroke();
                }
            }

            if (hasAny) {
                if (lnk.n) drawWires(0, -1, half);
                if (lnk.e) drawWires(1, 0, half);
                if (lnk.s) drawWires(0, 1, half);
                if (lnk.w) drawWires(-1, 0, half);
            } else {
                // Osamělý plot = krátký kus vodorovně na obě strany
                drawWires(-1, 0, s * 0.28);
                drawWires(1, 0, s * 0.28);
            }

            // Kovový sloupek s izolátorem uprostřed
            const post = getFencePostSprite(!!powered);
            ctx.drawImage(post, -18, -18);

            // Přeskakující jiskry kolem sloupku pod proudem (mění se podle ts)
            if (powered) {
                const sparkSeed = Math.floor(time / 55) + Math.round(cx * 7 + cy * 13);
                for (let i = 0; i < 3; i++) {
                    const a = ((sparkSeed * 1.9 + i * 2.1) % TWO_PI);
                    const r1 = 6;
                    const r2 = 11 + ((sparkSeed + i) % 5);
                    const mx = Math.cos(a + 0.28) * ((r1 + r2) * 0.55);
                    const my = Math.sin(a + 0.28) * ((r1 + r2) * 0.55);

                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
                    ctx.lineTo(mx, my);
                    ctx.lineTo(Math.cos(a - 0.15) * r2, Math.sin(a - 0.15) * r2);
                    ctx.strokeStyle = i === 0 ? '#ffffff' : '#ffe83b';
                    ctx.lineWidth = 1.6;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                }
            }
        } finally {
            ctx.restore();
        }
    };

})();