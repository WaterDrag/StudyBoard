// Builds compact, pre-projected map files for the Dobyvatel game:
//   data/dobyvatel/{svet,evropa,usa,nemecko,cesko}.json
// Each: { id, name, w, h, groups:{key:label}, t:[{id,name,d,c:[x,y],n:[ids],g,small}] }
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as d3 from 'd3-geo';
import * as topo from 'topojson-client';
import * as topoServer from 'topojson-server';
import * as topoSimp from 'topojson-simplify';
const require = createRequire(import.meta.url);
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const wc = require('world-countries');
const byNum = new Map(wc.filter(c => c.ccn3).map(c => [String(+c.ccn3), c]));
const csName = c => c.translations?.ces?.common || c.name.common;

// GeoJSON (RFC 7946) rings are counter-clockwise; d3 wants the opposite and
// otherwise treats a region as 'the whole globe except it'. Rewind if needed.
function rewind(fc) {
  fc.features.forEach(f => {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    polys.forEach(rings => {
      if (d3.geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) rings.forEach(r => r.reverse());
    });
  });
  return fc;
}
const r1 = n => Math.round(n * 10) / 10;
// SVG path with 1 decimal → compact
function pathOf(feature, proj) {
  const p = d3.geoPath(proj);
  const d = p(feature);
  return d ? d.replace(/-?\d+\.\d+/g, m => String(r1(+m))) : '';
}

// Neighbours from shared arcs, then make sure every territory has at least one
// neighbour and the whole map is ONE connected graph (islands → nearest).
function addLinks(ts, pairs) {
  const by = new Map(ts.map(t => [t.id, t]));
  pairs.forEach(([a, b]) => { const A = by.get(a), B = by.get(b); if (!A || !B) return; if (!A.n.includes(b)) A.n.push(b); if (!B.n.includes(a)) B.n.push(a); });
  return ts;
}
// Two regions whose (projected) borders come within eps px are neighbours —
// for GeoJSON sources where shared borders don't line up exactly.
function proximityLinks(ts, feats, proj, eps) {
  const pts = feats.map(f => { const out = []; const walk = c => { if (typeof c[0] === 'number') { const p = proj(c); if (p) out.push(p); } else c.forEach(walk); }; walk(f.geometry.coordinates); return out; });
  const bb = pts.map(P => P.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]));
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const a = bb[i], b = bb[j];
    if (a[0] > b[2] + eps || b[0] > a[2] + eps || a[1] > b[3] + eps || b[1] > a[3] + eps) continue;
    let near = false;
    for (const p of pts[i]) { if (p[0] < b[0] - eps || p[0] > b[2] + eps || p[1] < b[1] - eps || p[1] > b[3] + eps) continue; for (const q of pts[j]) if (Math.abs(p[0] - q[0]) < eps && Math.abs(p[1] - q[1]) < eps) { near = true; break; } if (near) break; }
    if (near) addLinks(ts, [[ts[i].id, ts[j].id]]);
  }
  return ts;
}
function ringsOf(feature, proj) {
  const out = [];
  const g = feature.geometry; if (!g) return out;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  polys.forEach(p => p.forEach(r => out.push(r.map(c => proj(c)).filter(Boolean))));
  return out;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function markEdges(ts, featById, proj, eps) {
  const rings = new Map(ts.map(t => [t.id, ringsOf(featById.get(t.id), proj)]));
  for (const t of ts) {
    const own = rings.get(t.id), nb = t.n.flatMap(id => rings.get(id) || []);
    let free = 0, total = 0;
    for (const r of own) for (let i = 0; i < r.length; i += 1) {
      const p = r[i]; total++;
      let near = false;
      for (const q of nb) { for (let j = 1; j < q.length; j++) { if (Math.abs(q[j][0] - p[0]) > 40 && Math.abs(q[j - 1][0] - p[0]) > 40) continue; if (segDist(p, q[j - 1], q[j]) < eps) { near = true; break; } } if (near) break; }
      if (!near) free++;
    }
    // at least ~4 % of the outline (and 2 points) not shared → on the edge
    t.e = free >= 2 && free / Math.max(1, total) > 0.02 ? 1 : 0;
  }
}
function finishGraph(ts) {
  const idx = new Map(ts.map((t, i) => [t.id, i]));
  const link = (a, b) => { if (a === b) return; if (!a.n.includes(b.id)) a.n.push(b.id); if (!b.n.includes(a.id)) b.n.push(a.id); };
  const dist = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]);
  for (const t of ts) if (!t.n.length) {
    t._auto = 1;
    const near = ts.filter(o => o !== t).sort((a, b) => dist(t, a) - dist(t, b)).slice(0, 2);
    near.forEach(o => link(t, o));
  }
  for (;;) {
    const comp = new Map(); let k = 0;
    for (const t of ts) if (!comp.has(t.id)) { const q = [t]; comp.set(t.id, k); while (q.length) { const x = q.pop(); for (const nid of x.n) if (!comp.has(nid)) { comp.set(nid, k); q.push(ts[idx.get(nid)]); } } k++; }
    if (k <= 1) break;
    // join component 0 with its nearest other territory
    let best = null;
    for (const a of ts) if (comp.get(a.id) === 0) for (const b of ts) if (comp.get(b.id) !== 0) { const d = dist(a, b); if (!best || d < best.d) best = { a, b, d }; }
    link(best.a, best.b);
  }
  return ts;
}

function write(id, name, w, h, groups, ts) {
  if (ts.some(t => t._arcEdge !== undefined)) ts.forEach(t => { t.e = t._arcEdge; delete t._arcEdge; });
  else if (ts._feat) markEdges(ts, ts._feat, ts._proj, 3);
  ts.forEach(t => { t.n.sort(); delete t._auto; });
  const out = { id, name, w, h, groups, t: ts };
  const s = JSON.stringify(out);
  fs.writeFileSync(`${OUT}/${id}.json`, s);
  console.log(id, ts.length, 'territories', (s.length / 1024).toFixed(0) + ' KB', 'isolated-fixed', ts.filter(t => t.n.length === 0).length);
}

function fromTopo(topology, objName, opts) {
  const geoms = topology.objects[objName].geometries.filter(opts.keep);
  const neigh = topo.neighbors(geoms);
  const proj = opts.proj;
  const ts = geoms.map((g, i) => {
    const f = topo.feature(topology, g);
    const info = opts.info(g);
    const c = info.anchor ? proj(info.anchor) : d3.geoPath(proj).centroid(f);
    const area = d3.geoPath(proj).area(f);
    return { id: info.id, name: info.name, g: info.g || '', d: pathOf(f, proj), c: [r1(c[0]), r1(c[1])], n: neigh[i].map(j => opts.info(geoms[j]).id), small: area < (opts.smallArea || 60) ? 1 : 0, _area: area };
  });
  // merge duplicates (e.g. N. Cyprus into Cyprus) were handled via keep/info; drop empty paths
  const feats = geoms.map(g => topo.feature(topology, g));
  // Map edge from topology: an arc used by only ONE kept geometry is coast or
  // the outer border → whoever owns it lies on the edge of the map.
  if (opts.arcEdges) {
    const arcsOf = g => { const out = []; const walk = a => { if (typeof a === 'number') out.push(a < 0 ? ~a : a); else a.forEach(walk); }; walk(g.arcs || []); return out; };
    const use = new Map();
    const counted = opts.edgeAlso ? [...geoms, ...topology.objects[objName].geometries.filter(g => !geoms.includes(g) && opts.edgeAlso(g))] : geoms;
    counted.forEach(g => new Set(arcsOf(g)).forEach(a => use.set(a, (use.get(a) || 0) + 1)));
    ts.forEach((t, i) => { t._arcEdge = arcsOf(geoms[i]).some(a => use.get(a) === 1) ? 1 : 0; });
  }
  if (opts.proximity) proximityLinks(ts, feats, proj, opts.proximity);
  ts._feat = new Map(ts.map((t, i) => [t.id, feats[i]]));
  ts._proj = proj;
  const kept = ts.filter(t => t.d); kept._feat = ts._feat; kept._proj = proj;
  return kept;
}

/* ═══ SVĚT ═══ */
{
  const w = require('world-atlas/countries-110m.json');
  // Northern Cyprus → Cyprus, Somaliland → Somalia (merged geometry)
  const gs = w.objects.countries.geometries;
  const mergeInto = (childName, parentId) => {
    const child = gs.find(g => g.properties.name === childName), parent = gs.find(g => g.id === parentId);
    if (!child || !parent) return;
    const merged = topo.mergeArcs(w, [child, parent]);
    Object.assign(parent, merged, { id: parentId, properties: parent.properties });
    gs.splice(gs.indexOf(child), 1);
  };
  mergeInto('N. Cyprus', '196'); mergeInto('Somaliland', '706');
  const W = 1000, H = 500;
  const land = topo.feature(w, w.objects.countries);
  land.features = land.features.filter(f => f.id !== '010');
  const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], land);
  const groupOf = c => {
    if (!c) return '';
    if (c.region === 'Africa') return 'afrika';
    if (c.region === 'Asia') return 'asie';
    if (c.region === 'Europe') return 'evropa';
    if (c.region === 'Oceania') return 'oceanie';
    if (c.region === 'Americas') return c.subregion === 'South America' ? 'jamerika' : 'samerika';
    return '';
  };
  const ts = fromTopo(w, 'countries', {
    proj,
    keep: g => g.id !== '010' && g.id !== '260', // bez Antarktidy a Fr. jižních území
    info: g => {
      if (!g.id) return { id: 'XK', name: 'Kosovo', g: 'evropa' };
      const c = byNum.get(String(+g.id));
      return { id: c ? c.cca2 : 'N' + g.id, name: c ? csName(c) : g.properties.name, g: groupOf(c) };
    },
    smallArea: 40, arcEdges: true,
  });
  // label anchors for countries whose centroid falls oddly
  const anchors = { RU: [95, 62], US: [-98, 39], CA: [-105, 58], FR: [2.5, 46.5], NO: [9, 61], CL: [-71, -33], ID: [114, -1], GB: [-2, 53.5] };
  ts.forEach(t => { if (anchors[t.id]) { const p = proj(anchors[t.id]); t.c = [r1(p[0]), r1(p[1])]; } delete t._area; });
  addLinks(ts, [['GB','FR'],['GB','IS'],['IS','GL'],['GL','CA'],['JP','KR'],['JP','RU'],['TW','CN'],['TW','PH'],['LK','IN'],['MG','MZ'],['AU','ID'],['AU','PG'],['AU','NZ'],['NZ','FJ'],['FJ','VU'],['SB','PG'],['SB','VU'],['CY','TR'],['CY','SY'],['CU','US'],['CU','MX'],['CU','BS'],['CU','JM'],['BS','US'],['PR','DO'],['TT','VE'],['FK','AR'],['NC','VU'],['PH','MY'],['PH','ID'],['LK','MV']]);
  write('svet', 'Svět', W, H, { afrika: 'Afrika', asie: 'Asie', evropa: 'Evropa', samerika: 'Severní a Střední Amerika', jamerika: 'Jižní Amerika', oceanie: 'Oceánie' }, finishGraph(ts));
}

/* ═══ EVROPA ═══ */
{
  const w = topoSimp.simplify(topoSimp.presimplify(require('world-atlas/countries-50m.json')), 0.004);
  const gs = w.objects.countries.geometries;
  const child = gs.find(g => g.properties.name === 'N. Cyprus'), parent = gs.find(g => g.id === '196');
  if (child && parent) { const m = topo.mergeArcs(w, [child, parent]); Object.assign(parent, m, { id: '196', properties: parent.properties }); gs.splice(gs.indexOf(child), 1); }
  const tiny = new Set(['VA', 'MC', 'SM', 'LI', 'AD', 'GG', 'JE', 'IM', 'FO', 'AX', 'GI', 'SJ']);
  const isEurope = g => {
    if (!g.id) return g.properties.name === 'Kosovo';
    const c = byNum.get(String(+g.id));
    if (!c) return false;
    if (tiny.has(c.cca2)) return false;
    return c.region === 'Europe' || c.cca2 === 'CY' || c.cca2 === 'TR';
  };
  const W = 1000, H = 820;
  const box = { type: 'MultiPoint', coordinates: [[-24, 35], [44, 35], [-12, 71], [40, 70], [30, 34]] };
  const proj = d3.geoConicConformal().rotate([-12, 0]).center([0, 52]).parallels([40, 65]).fitExtent([[10, 10], [W - 10, H - 10]], box);
  const groupOf = c => {
    if (!c) return 'jv';
    if (c.cca2 === 'TR' || c.cca2 === 'CY') return 'jv';
    return ({ 'Northern Europe': 'sever', 'Western Europe': 'zapad', 'Central Europe': 'stred', 'Eastern Europe': 'vychod', 'Southern Europe': 'jih', 'Southeast Europe': 'jv' })[c.subregion] || 'stred';
  };
  const ts = fromTopo(w, 'countries', {
    proj, keep: isEurope,
    info: g => {
      if (!g.id) return { id: 'XK', name: 'Kosovo', g: 'jv' };
      const c = byNum.get(String(+g.id));
      return { id: c.cca2, name: csName(c), g: groupOf(c) };
    },
    smallArea: 120, arcEdges: true,
    // vynechané státečky (Lichtenštejnsko, Monako…) nedělají ze sousedů okraj mapy
    edgeAlso: g => { const c = g.id && byNum.get(String(+g.id)); return !!(c && tiny.has(c.cca2)); },
  });
  const anchors = { RU: [38, 56], NO: [9, 61], FR: [2.5, 46.6], SE: [15, 62.5], FI: [26, 63], GB: [-1.8, 53], TR: [33, 39.3], DK: [9.3, 56], GR: [22, 39.5], HR: [16, 45.3], IT: [12.5, 43] };
  ts.forEach(t => { if (anchors[t.id]) { const p = proj(anchors[t.id]); t.c = [r1(p[0]), r1(p[1])]; } delete t._area; });
  addLinks(ts, [['MT','IT'],['IS','GB'],['IS','NO'],['CY','TR'],['CY','GR'],['GB','FR'],['GB','NL'],['DK','SE'],['EE','FI']]);
  write('evropa', 'Evropa', W, H, { sever: 'Severní Evropa', zapad: 'Západní Evropa', stred: 'Střední Evropa', vychod: 'Východní Evropa', jih: 'Jižní Evropa', jv: 'Jihovýchodní Evropa' }, finishGraph(ts));
}

/* ═══ USA ═══ */
{
  const us = topoSimp.simplify(topoSimp.presimplify(require('us-atlas/states-albers-10m.json')), 1.2);
  const CS = { 'California': 'Kalifornie', 'Florida': 'Florida', 'New Mexico': 'Nové Mexiko', 'New York': 'New York', 'North Carolina': 'Severní Karolína', 'South Carolina': 'Jižní Karolína', 'North Dakota': 'Severní Dakota', 'South Dakota': 'Jižní Dakota', 'West Virginia': 'Západní Virginie', 'Virginia': 'Virginie', 'Pennsylvania': 'Pensylvánie', 'Georgia': 'Georgie', 'Hawaii': 'Havaj', 'Louisiana': 'Louisiana', 'New Hampshire': 'New Hampshire', 'New Jersey': 'New Jersey' };
  const REG = {
  sv: ['Maine', 'New Hampshire', 'Vermont', 'Massachusetts', 'Rhode Island', 'Connecticut', 'New York', 'New Jersey', 'Pennsylvania'],
  sz: ['Ohio', 'Michigan', 'Indiana', 'Illinois', 'Wisconsin', 'Minnesota', 'Iowa', 'Missouri', 'North Dakota', 'South Dakota', 'Nebraska', 'Kansas'],
  jih: ['Delaware', 'Maryland', 'Virginia', 'West Virginia', 'Kentucky', 'Tennessee', 'North Carolina', 'South Carolina', 'Georgia', 'Florida', 'Alabama', 'Mississippi', 'Arkansas', 'Louisiana', 'Oklahoma', 'Texas'],
  zapad: ['Montana', 'Idaho', 'Wyoming', 'Colorado', 'New Mexico', 'Arizona', 'Utah', 'Nevada', 'California', 'Oregon', 'Washington', 'Alaska', 'Hawaii'] };
  const regOf = n => Object.keys(REG).find(k => REG[k].includes(n)) || 'jih';
  const ABBR = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY' };
  const proj = d3.geoIdentity(); // already Albers-projected (975×610)
  const ts = fromTopo(us, 'states', {
    proj, keep: g => g.properties.name !== 'District of Columbia',
    info: g => ({ id: ABBR[g.properties.name], name: CS[g.properties.name] || g.properties.name, g: regOf(g.properties.name) }),
    smallArea: 90, arcEdges: true,
  });
  ts.forEach(t => { delete t._area; });
  const anchors = { FL: [818, 520], MI: [655, 205], LA: [575, 495], MD: [815, 268], VA: [795, 300] };
  ts.forEach(t => { if (anchors[t.id]) t.c = anchors[t.id]; });
  addLinks(ts, [['AK','WA'],['HI','CA']]);
  write('usa', 'USA', 975, 610, { sv: 'Severovýchod', sz: 'Středozápad', jih: 'Jih', zapad: 'Západ' }, finishGraph(ts));
}

/* ═══ NĚMECKO ═══ */
{
  const de = rewind(JSON.parse(fs.readFileSync('de.json', 'utf8')));
  const CS = { 'Baden-Württemberg': 'Bádensko-Württembersko', 'Bayern': 'Bavorsko', 'Berlin': 'Berlín', 'Brandenburg': 'Braniborsko', 'Bremen': 'Brémy', 'Hamburg': 'Hamburk', 'Hessen': 'Hesensko', 'Mecklenburg-Vorpommern': 'Meklenbursko-Přední Pomořansko', 'Niedersachsen': 'Dolní Sasko', 'Nordrhein-Westfalen': 'Severní Porýní-Vestfálsko', 'Rheinland-Pfalz': 'Porýní-Falc', 'Saarland': 'Sársko', 'Sachsen': 'Sasko', 'Sachsen-Anhalt': 'Sasko-Anhaltsko', 'Schleswig-Holstein': 'Šlesvicko-Holštýnsko', 'Thüringen': 'Durynsko' };
  const topology = topoServer.topology({ s: de }, 1e5);
  const W = 640, H = 860;
  const proj = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], de);
  const ts = fromTopo(topology, 's', {
    proj, keep: () => true,
    info: g => ({ id: g.properties.id, name: CS[g.properties.name] || g.properties.name, g: '' }),
    smallArea: 200, proximity: 2.5,
  });
  ts.forEach(t => { delete t._area; });
  write('nemecko', 'Německo', W, H, {}, finishGraph(ts));
}

/* ═══ ČESKO ═══ */
{
  const cz = rewind(JSON.parse(fs.readFileSync('cz.json', 'utf8')));
  const SEATS = [['PHA', 'Hlavní město Praha', [14.4378, 50.0755]], ['STC', 'Středočeský kraj', [14.103, 50.147]], ['JHC', 'Jihočeský kraj', [14.474, 48.975]], ['PLK', 'Plzeňský kraj', [13.373, 49.738]], ['KVK', 'Karlovarský kraj', [12.871, 50.231]], ['ULK', 'Ústecký kraj', [14.032, 50.661]], ['LBK', 'Liberecký kraj', [15.056, 50.767]], ['HKK', 'Královéhradecký kraj', [15.832, 50.209]], ['PAK', 'Pardubický kraj', [15.781, 50.034]], ['VYS', 'Kraj Vysočina', [15.591, 49.396]], ['JHM', 'Jihomoravský kraj', [16.606, 49.195]], ['OLK', 'Olomoucký kraj', [17.251, 49.594]], ['ZLK', 'Zlínský kraj', [17.667, 49.226]], ['MSK', 'Moravskoslezský kraj', [18.262, 49.82]]];
  cz.features.forEach(f => {
    const s = SEATS.find(([, , p]) => d3.geoContains(f, p));
    if (!s) throw new Error('kraj bez sídla');
    f.properties = { id: s[0], name: s[1] };
  });
  if (new Set(cz.features.map(f => f.properties.id)).size !== 14) throw new Error('kraje se nepřiřadily jednoznačně');
  const topology = topoSimp.simplify(topoSimp.presimplify(topoServer.topology({ k: cz }, 1e5)), 2e-5);
  const W = 1000, H = 600;
  const proj = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], cz);
  const ts = fromTopo(topology, 'k', {
    proj, keep: () => true,
    info: g => ({ id: g.properties.id, name: g.properties.name, g: '' }),
    smallArea: 400, proximity: 2.5,
  });
  ts.forEach(t => { delete t._area; });
  // Praha leží uvnitř Středočeského — label/centroid OK; Středočeský posunout mimo Prahu
  const stc = ts.find(t => t.id === 'STC'); const p = proj([14.75, 49.85]); stc.c = [r1(p[0]), r1(p[1])];
  write('cesko', 'Česko', W, H, {}, finishGraph(ts));
}
