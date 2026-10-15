// ═══ bggen.js — Generované obrázky pozadí a karet místností (recept → obrázek)
// Převzaté kreslicí jádro z generator.html. Obrázek se NEUKLÁDÁ — v databázi je
// jen krátký recept "gen1:<styl>:<paleta>:<seed>" (~30 B) a každý prohlížeč si
// ho podle něj nakreslí. Kreslení je deterministické: stejný recept = stejné
// pixely. Proto se v tomhle souboru nesmí měnit nic, co ovlivňuje výsledek
// receptů "gen1" — větší změnu kreslení vydat jako "gen2" a gen1 nechat žít.
(function () {
  // Hashování textového seedu na 32-bit celé číslo (xmur3)
  function xmur3(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
          h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
          h = (h << 13) | (h >>> 19);
      }
      return function() {
          h = Math.imul(h ^ (h >>> 16), 2246822507);
          h = Math.imul(h ^ (h >>> 13), 3266489909);
          return (h ^= h >>> 16) >>> 0;
      };
  }

  // Mulberry32 PRNG vracející čísla 0.0 až 1.0
  function createPRNG(seedStr) {
      const seedFunc = xmur3(String(seedStr));
      let a = seedFunc();
      return function() {
          let t = (a += 0x6D2B79F5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
  }

  // Pomocná třída pro práci s náhodou odvozenou ze seedu
  class SeededRandom {
      constructor(seedStr) {
          this.seed = String(seedStr).trim() || this.generateRandomSeedString();
          this.next = createPRNG(this.seed);
          // Permutační tabulka pro hladký 2D šum
          this.perm = new Uint8Array(512);
          for (let i = 0; i < 256; i++) this.perm[i] = i;
          for (let i = 255; i > 0; i--) {
              const j = Math.floor(this.next() * (i + 1));
              const temp = this.perm[i];
              this.perm[i] = this.perm[j];
              this.perm[j] = temp;
          }
          for (let i = 0; i < 256; i++) this.perm[i + 256] = this.perm[i];
      }

      generateRandomSeedString() {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let out = '';
          for (let i = 0; i < 6; i++) {
              out += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return out;
      }

      range(min, max) {
          return min + this.next() * (max - min);
      }

      int(min, max) {
          return Math.floor(this.range(min, max + 1));
      }

      pick(arr) {
          return arr[Math.floor(this.next() * arr.length)];
      }

      // Hladký 2D Value Noise pro vrstevnice a vlny
      noise2D(x, y) {
          const xi = Math.floor(x) & 255;
          const yi = Math.floor(y) & 255;
          const xf = x - Math.floor(x);
          const yf = y - Math.floor(y);

          const u = xf * xf * (3.0 - 2.0 * xf);
          const v = yf * yf * (3.0 - 2.0 * yf);

          const aa = this.perm[this.perm[xi] + yi] / 255;
          const ab = this.perm[this.perm[xi] + yi + 1] / 255;
          const ba = this.perm[this.perm[xi + 1] + yi] / 255;
          const bb = this.perm[this.perm[xi + 1] + yi + 1] / 255;

          const x1 = aa + u * (ba - aa);
          const x2 = ab + u * (bb - ab);
          return x1 + v * (x2 - x1);
      }

      // Fraktální šum (FBM)
      fbm(x, y, octaves = 3) {
          let value = 0;
          let amplitude = 0.5;
          let frequency = 1;
          for (let i = 0; i < octaves; i++) {
              value += amplitude * this.noise2D(x * frequency, y * frequency);
              frequency *= 2.02;
              amplitude *= 0.5;
          }
          return value;
      }
  }

  
  const STYLES = [
      { id: 'prechody', name: 'Měkké přechody (Mesh)', slug: 'prechody' },
      { id: 'zare', name: 'Polární záře', slug: 'polarni-zare' },
      { id: 'mlhovina', name: 'Hvězdná obloha s mlhovinou', slug: 'mlhovina' },
      { id: 'bokeh', name: 'Bokeh – rozmazaná světélka', slug: 'bokeh' },
      { id: 'geometrie', name: 'Geometrie (Low-poly / šestiúhelníky)', slug: 'geometrie' },
      { id: 'vrstevnice', name: 'Vlny a vrstevnice', slug: 'vrstevnice' },
      { id: 'mrizka', name: 'Jemná mřížka a tečky s vinětou', slug: 'mrizka' },
      { id: 'bloby', name: 'Abstraktní rozmazané tvary (Blob)', slug: 'bloby' }
  ];

  // 14 pečlivě vyladěných tmavých, tlumených palet s nízkým kontrastem
  const PALETTES = [
      {
          id: 'modra-noc',
          name: 'Modrá noc',
          bg: ['#060b16', '#0b1528'],
          colors: ['#162a4a', '#1e3a63', '#274c7e', '#1a2e4c', '#315b8a']
      },
      {
          id: 'hluboky-les',
          name: 'Hluboký les',
          bg: ['#05100a', '#091c13'],
          colors: ['#123122', '#1b4530', '#26593f', '#15382c', '#326b4d']
      },
      {
          id: 'fialova-mlha',
          name: 'Fialová mlha',
          bg: ['#0c0717', '#150d28'],
          colors: ['#251645', '#362061', '#482a7a', '#2c1c4d', '#583591']
      },
      {
          id: 'tmava-malina',
          name: 'Tmavá malina',
          bg: ['#14060c', '#220b16'],
          colors: ['#3b1326', '#521a35', '#692244', '#45182c', '#7d2b52']
      },
      {
          id: 'jantarovy-stin',
          name: 'Jantarový stín',
          bg: ['#120b05', '#1f1308'],
          colors: ['#38220f', '#4f3015', '#663e1c', '#452a14', '#7a4b24']
      },
      {
          id: 'tyrkysova-hlubina',
          name: 'Tyrkysová hlubina',
          bg: ['#041014', '#081d24'],
          colors: ['#0f333d', '#164754', '#1f5c6b', '#133b45', '#287082']
      },
      {
          id: 'bridlice',
          name: 'Chladná břidlice',
          bg: ['#090d14', '#111824'],
          colors: ['#1c2738', '#27354a', '#33445e', '#222e3d', '#405370']
      },
      {
          id: 'prazena-kava',
          name: 'Pražená káva',
          bg: ['#0f0a08', '#1a120e'],
          colors: ['#2b1e18', '#3d2b22', '#4f382d', '#36261e', '#614639']
      },
      {
          id: 'arokticka-polnoc',
          name: 'Arktická půlnoc',
          bg: ['#050c14', '#091724'],
          colors: ['#112a40', '#183c54', '#1f5069', '#14384a', '#28647d']
      },
      {
          id: 'smaragdovy-mech',
          name: 'Smaragdový mech',
          bg: ['#06110e', '#0b1e19'],
          colors: ['#13332b', '#1b473b', '#245c4c', '#183d33', '#2e705d']
      },
      {
          id: 'indigovy-soumrak',
          name: 'Indigový soumrak',
          bg: ['#080818', '#10112b'],
          colors: ['#1b1d47', '#262961', '#32367a', '#212454', '#404591']
      },
      {
          id: 'bordo-samet',
          name: 'Bordó samet',
          bg: ['#130608', '#210a0e'],
          colors: ['#381118', '#4f1822', '#631f2b', '#42151d', '#782735']
      },
      {
          id: 'grafitovy-monolit',
          name: 'Grafitový monolit',
          bg: ['#08090b', '#111317'],
          colors: ['#1b1e24', '#252932', '#303540', '#20232b', '#3b414f']
      },
      {
          id: 'severska-borovice',
          name: 'Severská borovice',
          bg: ['#060f11', '#0b1b1e'],
          colors: ['#132e33', '#1c4147', '#25545c', '#17373d', '#2e6670']
      }
  ];

  // Barvy palet byly tak tmavé, že výsledek vycházel téměř černý (jas ~23/255).
  // Zesvětlíme je násobkem RGB – odstín i sytost zůstanou, pozadí (bg) se nemění.
  function brightenHex(hex, f) {
      const n = parseInt(hex.slice(1), 16);
      const ch = v => Math.min(255, Math.round(v * f)).toString(16).padStart(2, '0');
      return '#' + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
  }
  PALETTES.forEach(p => { p.colors = p.colors.map(c => brightenHex(c, 1.45)); });

  
  let grainPatternCanvas = null;

  function hexToRgba(hex, alpha = 1) {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Vytvoří dlaždici 256x256 s monochromatickým šumem
  function getGrainTile() {
      if (grainPatternCanvas) return grainPatternCanvas;
      const tile = document.createElement('canvas');
      tile.width = 256;
      tile.height = 256;
      const tCtx = tile.getContext('2d');
      const imgData = tCtx.createImageData(256, 256);
      const data = imgData.data;
      let prng = createPRNG('GRAIN_TILE_STATIC_SEED');
      for (let i = 0; i < data.length; i += 4) {
          const v = prng();
          const val = v > 0.5 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
          data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255);
      }
      tCtx.putImageData(imgData, 0, 0);
      grainPatternCanvas = tile;
      return tile;
  }

  
  /**
   * Vrátí souřadnici X, Y podle pravidel režimu:
   * - Karta: hlavní detaily spíše doprava (x: 0.35 - 0.96) a do středového vodorovného pásu (y: 0.22 - 0.78).
   * - Pozadí: detaily rozprostřené rovnoměrně po celé ploše bez výrazného středu.
   */
  function samplePosition(rng, mode, W, H, index = 0, total = 1) {
      if (mode === 'karta') {
          // Posun doprava a do středního pásu
          const rx = 0.30 + Math.pow(rng.next(), 0.75) * 0.68;
          // Gaussovská tendence ke středu Y (0.5)
          const ry = 0.5 + (rng.next() + rng.next() - 1.0) * 0.36;
          return { x: rx * W, y: ry * H };
      } else {
          // Rovnoměrné rozprostření v mřížce s jitterem, mírně potlačující ostrý střed
          const cols = Math.ceil(Math.sqrt(total * (W / H)));
          const rows = Math.ceil(total / cols);
          const col = index % cols;
          const row = Math.floor(index / cols);
          const cellW = W / cols;
          const cellH = H / rows;
          let x = (col + rng.range(0.15, 0.85)) * cellW;
          let y = (row + rng.range(0.15, 0.85)) * cellH;
          return { x, y };
      }
  }

  // 1. Měkké barevné přechody (Mesh Gradient)
  function drawMeshGradient(ctx, W, H, rng, palette, mode) {
      const count = mode === 'karta' ? 7 : 12;
      ctx.save();
      for (let i = 0; i < count; i++) {
          const pos = samplePosition(rng, mode, W, H, i, count);
          const radius = (mode === 'karta' ? rng.range(0.35, 0.75) : rng.range(0.30, 0.60)) * Math.max(W, H);
          const col = rng.pick(palette.colors);
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
          grad.addColorStop(0, hexToRgba(col, mode === 'karta' ? 0.55 : 0.42));
          grad.addColorStop(0.5, hexToRgba(col, 0.18));
          grad.addColorStop(1, hexToRgba(palette.bg[0], 0));
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
  }

  // 2. Polární záře (vlnité průsvitné pásy)
  function drawAurora(ctx, W, H, rng, palette, mode) {
      ctx.save();
      const bands = mode === 'karta' ? 4 : 6;
      for (let b = 0; b < bands; b++) {
          const col = rng.pick(palette.colors);
          const baseY = mode === 'karta'
              ? H * rng.range(0.32, 0.72)
              : H * ((b + 0.5) / bands + rng.range(-0.08, 0.08));
          const amp = H * rng.range(0.06, 0.16);
          const freq = rng.range(1.5, 3.5) / W;
          const phase = rng.range(0, Math.PI * 2);
          const thickness = H * rng.range(0.18, 0.32);

          const steps = 60;
          for (let layer = 0; layer < 3; layer++) {
              ctx.beginPath();
              const layerOffset = (layer - 1) * (thickness * 0.25);
              for (let i = 0; i <= steps; i++) {
                  const x = (i / steps) * W;
                  const y = baseY + layerOffset + Math.sin(x * freq + phase) * amp + Math.cos(x * freq * 2.1 - phase) * (amp * 0.4);
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
              }
              ctx.lineTo(W, H);
              ctx.lineTo(0, H);
              ctx.closePath();

              const grad = ctx.createLinearGradient(0, baseY - thickness, 0, baseY + thickness);
              grad.addColorStop(0, hexToRgba(col, 0));
              grad.addColorStop(0.5, hexToRgba(col, mode === 'karta' ? 0.22 : 0.15));
              grad.addColorStop(1, hexToRgba(col, 0));
              ctx.fillStyle = grad;
              ctx.fill();
          }
      }
      ctx.restore();
  }

  // 3. Hvězdná obloha s mlhovinou
  function drawNebulaStars(ctx, W, H, rng, palette, mode) {
      ctx.save();
      // Mlhovina na pozadí
      const clouds = mode === 'karta' ? 6 : 10;
      for (let i = 0; i < clouds; i++) {
          const pos = samplePosition(rng, mode, W, H, i, clouds);
          const r = Math.max(W, H) * rng.range(0.18, 0.42);
          const col = rng.pick(palette.colors);
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
          grad.addColorStop(0, hexToRgba(col, 0.38));
          grad.addColorStop(0.55, hexToRgba(col, 0.12));
          grad.addColorStop(1, hexToRgba(palette.bg[0], 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fill();
      }

      // Tlumené hvězdy
      const starCount = mode === 'karta' ? 110 : 260;
      for (let s = 0; s < starCount; s++) {
          const pos = samplePosition(rng, mode, W, H, s, starCount);
          const radius = rng.range(0.6, mode === 'karta' ? 2.0 : 2.5);
          const alpha = rng.range(0.12, 0.48); // Tlumené, aby nerušily bílý text
          ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Občasná jemná aura kolem větší hvězdy
          if (rng.next() > 0.88) {
              const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 5);
              glow.addColorStop(0, hexToRgba(rng.pick(palette.colors), 0.35));
              glow.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, radius * 5, 0, Math.PI * 2);
              ctx.fill();
          }
      }
      ctx.restore();
  }

  // 4. Bokeh – rozmazaná světélka
  function drawBokeh(ctx, W, H, rng, palette, mode) {
      ctx.save();
      // Nejprve jemný podklad
      drawMeshGradient(ctx, W, H, rng, palette, mode);

      const count = mode === 'karta' ? 26 : 45;
      for (let i = 0; i < count; i++) {
          const pos = samplePosition(rng, mode, W, H, i, count);
          const r = Math.min(W, H) * rng.range(0.05, 0.24);
          const col = rng.pick(palette.colors);
          const alpha = rng.range(0.08, 0.26);

          const grad = ctx.createRadialGradient(pos.x, pos.y, r * 0.1, pos.x, pos.y, r);
          grad.addColorStop(0, hexToRgba(col, alpha * 0.4));
          grad.addColorStop(0.75, hexToRgba(col, alpha));
          grad.addColorStop(0.92, hexToRgba(col, alpha * 1.15));
          grad.addColorStop(1, hexToRgba(col, 0));

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
  }

  // 5. Geometrie – trojúhelníky / šestiúhelníky / low-poly
  function drawGeometry(ctx, W, H, rng, palette, mode) {
      ctx.save();
      drawMeshGradient(ctx, W, H, rng, palette, mode);

      const subType = rng.next() > 0.45 ? 'lowpoly' : 'hex';
      const cellSize = mode === 'karta' ? rng.range(65, 105) : rng.range(130, 200);

      if (subType === 'lowpoly') {
          const cols = Math.ceil(W / cellSize) + 2;
          const rows = Math.ceil(H / cellSize) + 2;
          const pts = [];

          for (let r = -1; r < rows; r++) {
              pts[r] = [];
              for (let c = -1; c < cols; c++) {
                  const jx = (rng.next() - 0.5) * cellSize * 0.75;
                  const jy = (rng.next() - 0.5) * cellSize * 0.75;
                  pts[r][c] = { x: c * cellSize + jx, y: r * cellSize + jy };
              }
          }

          for (let r = -1; r < rows - 1; r++) {
              for (let c = -1; c < cols - 1; c++) {
                  const p1 = pts[r][c];
                  const p2 = pts[r][c + 1];
                  const p3 = pts[r + 1][c];
                  const p4 = pts[r + 1][c + 1];

                  // V režimu karta zvýrazníme geometrii spíše vpravo a ve středu
                  const centerX = (p1.x + p2.x + p3.x) / 3;
                  const centerY = (p1.y + p2.y + p3.y) / 3;
                  let weight = 1;
                  if (mode === 'karta') {
                      const normX = Math.max(0, Math.min(1, centerX / W));
                      const bandY = 1 - Math.abs((centerY / H) - 0.5) * 1.6;
                      weight = Math.max(0.15, normX * Math.max(0.2, bandY));
                  }

                  const colA = rng.pick(palette.colors);
                  ctx.fillStyle = hexToRgba(colA, rng.range(0.05, 0.22) * weight);
                  ctx.strokeStyle = hexToRgba(colA, 0.12 * weight);
                  ctx.lineWidth = 1;

                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.lineTo(p3.x, p3.y);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();

                  const colB = rng.pick(palette.colors);
                  ctx.fillStyle = hexToRgba(colB, rng.range(0.04, 0.20) * weight);
                  ctx.beginPath();
                  ctx.moveTo(p2.x, p2.y);
                  ctx.lineTo(p4.x, p4.y);
                  ctx.lineTo(p3.x, p3.y);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
              }
          }
      } else {
          // Šestiúhelníky
          const r = cellSize * 0.55;
          const dx = r * Math.sqrt(3);
          const dy = r * 1.5;
          const cols = Math.ceil(W / dx) + 2;
          const rows = Math.ceil(H / dy) + 2;

          for (let row = -1; row < rows; row++) {
              for (let col = -1; col < cols; col++) {
                  const cx = col * dx + (row % 2 !== 0 ? dx / 2 : 0);
                  const cy = row * dy;

                  let visibility = rng.next();
                  if (mode === 'karta') {
                      visibility *= (cx / W) * (1 - Math.abs(cy / H - 0.5));
                  }
                  if (visibility < 0.22) continue;

                  const cHex = rng.pick(palette.colors);
                  ctx.beginPath();
                  for (let i = 0; i < 6; i++) {
                      const angle = (Math.PI / 180) * (60 * i - 30);
                      const vx = cx + r * Math.cos(angle);
                      const vy = cy + r * Math.sin(angle);
                      if (i === 0) ctx.moveTo(vx, vy);
                      else ctx.lineTo(vx, vy);
                  }
                  ctx.closePath();
                  ctx.fillStyle = hexToRgba(cHex, rng.range(0.05, 0.22));
                  ctx.strokeStyle = hexToRgba(cHex, rng.range(0.10, 0.28));
                  ctx.lineWidth = 1.2;
                  ctx.fill();
                  ctx.stroke();
              }
          }
      }
      ctx.restore();
  }

  // 6. Vlny a vrstevnice
  function drawWavesContours(ctx, W, H, rng, palette, mode) {
      ctx.save();
      drawMeshGradient(ctx, W, H, rng, palette, mode);

      const lineCount = mode === 'karta' ? 22 : 34;
      const freq = rng.range(1.2, 2.6) / W;
      const offsetSeed = rng.range(0, 100);

      for (let i = 0; i < lineCount; i++) {
          const t = i / (lineCount - 1);
          const baseY = mode === 'karta'
              ? H * (0.12 + t * 0.78)
              : H * (0.04 + t * 0.92);

          const col = palette.colors[i % palette.colors.length];
          ctx.strokeStyle = hexToRgba(col, mode === 'karta' ? 0.35 : 0.24);
          ctx.lineWidth = mode === 'karta' ? 1.5 : 2.0;

          ctx.beginPath();
          const steps = 90;
          for (let s = 0; s <= steps; s++) {
              const x = (s / steps) * W;
              const n = rng.fbm(x * freq + offsetSeed, t * 2.4 + offsetSeed, 3);
              const waveY = baseY + (n - 0.5) * H * (mode === 'karta' ? 0.42 : 0.28);
              if (s === 0) ctx.moveTo(x, waveY);
              else ctx.lineTo(x, waveY);
          }
          ctx.stroke();
      }
      ctx.restore();
  }

  // 7. Jemná mřížka nebo tečky s vinětou
  function drawGridDots(ctx, W, H, rng, palette, mode) {
      ctx.save();
      drawMeshGradient(ctx, W, H, rng, palette, mode);

      const isDots = rng.next() > 0.45;
      const step = mode === 'karta' ? rng.int(24, 36) : rng.int(42, 64);
      const accentCol = rng.pick(palette.colors);

      if (isDots) {
          for (let y = step / 2; y < H; y += step) {
              for (let x = step / 2; x < W; x += step) {
                  const n = rng.noise2D(x * 0.005, y * 0.005);
                  let alpha = 0.08 + n * 0.22;
                  if (mode === 'karta') {
                      alpha *= Math.min(1, (x / W) * 1.25);
                  }
                  ctx.fillStyle = hexToRgba(accentCol, alpha);
                  ctx.beginPath();
                  ctx.arc(x, y, mode === 'karta' ? 1.6 : 2.2, 0, Math.PI * 2);
                  ctx.fill();
              }
          }
      } else {
          ctx.strokeStyle = hexToRgba(accentCol, 0.14);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x <= W; x += step) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, H);
          }
          for (let y = 0; y <= H; y += step) {
              ctx.moveTo(0, y);
              ctx.lineTo(W, y);
          }
          ctx.stroke();

          // Zvýrazněné uzlové body
          for (let y = step; y < H; y += step) {
              for (let x = step; x < W; x += step) {
                  if (rng.next() > 0.82) {
                      ctx.fillStyle = hexToRgba(rng.pick(palette.colors), 0.35);
                      ctx.beginPath();
                      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                      ctx.fill();
                  }
              }
          }
      }
      ctx.restore();
  }

  // 8. Abstraktní rozmazané tvary (Blob)
  function drawBlobs(ctx, W, H, rng, palette, mode) {
      ctx.save();
      const count = mode === 'karta' ? 6 : 10;
      for (let i = 0; i < count; i++) {
          const pos = samplePosition(rng, mode, W, H, i, count);
          const baseR = Math.min(W, H) * rng.range(0.18, 0.44);
          const col = rng.pick(palette.colors);

          // Kreslení organického blobu pomocí Bezierových křivek a radiálního přechodu
          const points = 8;
          const coords = [];
          for (let p = 0; p < points; p++) {
              const angle = (p / points) * Math.PI * 2;
              const r = baseR * rng.range(0.72, 1.28);
              coords.push({
                  x: pos.x + Math.cos(angle) * r,
                  y: pos.y + Math.sin(angle) * r
              });
          }

          const grad = ctx.createRadialGradient(pos.x, pos.y, baseR * 0.1, pos.x, pos.y, baseR * 1.3);
          grad.addColorStop(0, hexToRgba(col, mode === 'karta' ? 0.45 : 0.32));
          grad.addColorStop(0.65, hexToRgba(col, 0.16));
          grad.addColorStop(1, hexToRgba(col, 0));

          ctx.fillStyle = grad;
          ctx.beginPath();
          for (let p = 0; p < points; p++) {
              const curr = coords[p];
              const next = coords[(p + 1) % points];
              const midX = (curr.x + next.x) / 2;
              const midY = (curr.y + next.y) / 2;
              if (p === 0) {
                  const prev = coords[points - 1];
                  ctx.moveTo((prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
              }
              ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
          }
          ctx.closePath();
          ctx.fill();
      }
      ctx.restore();
  }

  /**
   * HLAVNÍ FUNKCE VYKRESLENÍ JEDNÉ VARIANTY NA PLÁTNO V PŘESNÝCH PIXELECH
   */
  function renderToCanvas(canvas, config) {
      const { mode, style, palette, seed, grain } = config;
      const { width: W, height: H } = getDimensions(mode);
      // scale < 1 = zmenšený náhled: kreslí se stejné tahy ve stejném
      // souřadném systému, jen do menšího plátna (rychlé náhledy).
      const scale = config.scale || 1;

      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);

      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      const rng = new SeededRandom(`${seed}-${style.id}-${palette.id}-${mode}`);

      // 1. Základní tmavé pozadí s jemným lineárním přechodem
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, palette.bg[0]);
      bgGrad.addColorStop(1, palette.bg[1]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Vykreslení zvoleného procedurálního stylu
      switch (style.id) {
          case 'prechody':
              drawMeshGradient(ctx, W, H, rng, palette, mode);
              break;
          case 'zare':
              drawAurora(ctx, W, H, rng, palette, mode);
              break;
          case 'mlhovina':
              drawNebulaStars(ctx, W, H, rng, palette, mode);
              break;
          case 'bokeh':
              drawBokeh(ctx, W, H, rng, palette, mode);
              break;
          case 'geometrie':
              drawGeometry(ctx, W, H, rng, palette, mode);
              break;
          case 'vrstevnice':
              drawWavesContours(ctx, W, H, rng, palette, mode);
              break;
          case 'mrizka':
              drawGridDots(ctx, W, H, rng, palette, mode);
              break;
          case 'bloby':
              drawBlobs(ctx, W, H, rng, palette, mode);
              break;
      }

      // 3. DODRŽENÍ PRAVIDEL PRO REŽIMY:
      if (mode === 'karta') {
          // PRAVIDLO KARTA: Levý horní roh (cca 45 % šířky × 60 % výšky) musí být klidnější a tmavší
          ctx.save();
          ctx.translate(0, 0);
          ctx.scale(W * 0.58, H * 0.78);
          const tlGrad = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.0);
          tlGrad.addColorStop(0, hexToRgba(palette.bg[0], 0.85));
          tlGrad.addColorStop(0.55, hexToRgba(palette.bg[0], 0.55));
          tlGrad.addColorStop(1, hexToRgba(palette.bg[0], 0));
          ctx.fillStyle = tlGrad;
          ctx.fillRect(0, 0, 1.2, 1.2);
          ctx.restore();

          // Jemné ztmavení horní a spodní hrany, aby vynikla středová vodorovná pásová zóna
          const edgeGrad = ctx.createLinearGradient(0, 0, 0, H);
          edgeGrad.addColorStop(0, hexToRgba(palette.bg[0], 0.25));
          edgeGrad.addColorStop(0.22, 'rgba(0,0,0,0)');
          edgeGrad.addColorStop(0.78, 'rgba(0,0,0,0)');
          edgeGrad.addColorStop(1, hexToRgba(palette.bg[0], 0.30));
          ctx.fillStyle = edgeGrad;
          ctx.fillRect(0, 0, W, H);
      } else {
          // PRAVIDLO POZADÍ: Celkově jemné, mírně rozostřené / utlumené a rovnoměrná viněta po obvodu
          const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
          vig.addColorStop(0, hexToRgba(palette.bg[0], 0.05)); // Mírné sjednocení středu
          vig.addColorStop(1, hexToRgba(palette.bg[0], 0.38));
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, W, H);
      }

      // Celkové utlumení kontrastu (zajišťuje 100% čitelnost bílého textu a světlých lístečků)
      ctx.fillStyle = 'rgba(6, 9, 16, 0.06)';
      ctx.fillRect(0, 0, W, H);

      // 4. Volitelný jemný šum (grain 3 %) proti pruhování přechodů
      if (grain) {
          ctx.save();
          const tile = getGrainTile();
          const pattern = ctx.createPattern(tile, 'repeat');
          ctx.globalAlpha = 0.035; // cca 3.5 %, normální prolnutí = skutečný dithering
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
      }
  }

  
  const BG_SIZE = { karta: { width: 1200, height: 400 }, pozadi: { width: 2560, height: 1440 } };
  function getDimensions(mode) { return BG_SIZE[mode]; }

  const RECIPE_RE = /^gen1:([a-z-]+):([a-z-]+):([A-Za-z0-9-]{1,24})$/;
  function parse(recipe) {
    const m = RECIPE_RE.exec(String(recipe || ''));
    if (!m) return null;
    const style = STYLES.find(s => s.id === m[1]);
    const palette = PALETTES.find(p => p.id === m[2]);
    return style && palette ? { style, palette, seed: m[3] } : null;
  }
  function make(styleId, paletteId, seed) { return `gen1:${styleId}:${paletteId}:${seed}`; }
  // Random recipe; optional fixed style/palette ('' = random).
  function random(styleId, paletteId) {
    const rng = new SeededRandom('');
    const style = STYLES.find(s => s.id === styleId) || rng.pick(STYLES);
    const palette = PALETTES.find(p => p.id === paletteId) || rng.pick(PALETTES);
    return make(style.id, palette.id, rng.seed);
  }

  // Draw a recipe at full size, return a blob: URL (cached per recipe+mode).
  const urlCache = new Map();
  function toUrl(recipe, mode, scale = 1) {
    const key = mode + '|' + scale + '|' + recipe;
    if (urlCache.has(key)) return urlCache.get(key);
    const p = parse(recipe);
    if (!p) return Promise.resolve(null);
    const job = new Promise(resolve => {
      const canvas = document.createElement('canvas');
      renderToCanvas(canvas, { mode, style: p.style, palette: p.palette, seed: p.seed, grain: true, scale });
      canvas.toBlob(b => resolve(b ? URL.createObjectURL(b) : null), 'image/webp', 0.92);
    });
    urlCache.set(key, job);
    return job;
  }

  window.BgGen = { STYLES, PALETTES, parse, make, random, toUrl, isRecipe: r => !!parse(r) };
})();

// ── Oblíbené obrázky ──────────────────────────────────────────
// Každý si může uložit nejvýš BG_FAV_MAX receptů (karty i pozadí dohromady),
// i z cizí místnosti, kde se mu obrázek líbil. Leží v soukromé podkolekci
// users/{uid}/private/bg — nikdo jiný je nevidí; limit hlídají i pravidla.
const BG_FAV_MAX = 10;
const BgFav = {
  items: null, // [{ k: 'karta' | 'pozadi', r: 'gen1:…' }]
  doc() { return db.collection('users').doc(auth.currentUser.uid).collection('private').doc('bg'); },
  async load() {
    if (this.items) return this.items;
    try {
      const snap = await this.doc().get();
      this.items = (snap.exists ? snap.data().items || [] : []).filter(it => BgGen.isRecipe(it.r));
    } catch (e) { this.items = []; }
    return this.items;
  },
  has(kind, recipe) { return (this.items || []).some(it => it.k === kind && it.r === recipe); },
  // Returns '' on success, otherwise a Czech message for a toast.
  async toggle(kind, recipe) {
    await this.load();
    const had = this.has(kind, recipe);
    if (!had && this.items.length >= BG_FAV_MAX) return `Oblíbených můžeš mít nejvýš ${BG_FAV_MAX} — nějaký nejdřív odeber.`;
    const next = had ? this.items.filter(it => !(it.k === kind && it.r === recipe)) : [...this.items, { k: kind, r: recipe }];
    try {
      await this.doc().set({ items: next });
      this.items = next;
      return '';
    } catch (e) { return 'Oblíbené se nepodařilo uložit: ' + e.message; }
  },
};
