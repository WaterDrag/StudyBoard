# Mapy pro Dobyvatele

`build.mjs` vyrobí `data/dobyvatel/{svet,evropa,usa,nemecko,cesko}.json`:
předpočítané SVG cesty, sousedy (sdílené hranice + ručně doplněné ostrovy)
a příznak `e` = území na okraji mapy (smí na něm stát hrad).

```
mkdir mapbuild && cd mapbuild
npm init -y
npm install world-atlas@2.0.2 us-atlas@3.0.1 world-countries@5.1.0 d3-geo@3.1.1 topojson-client@3.1.0 topojson-server@3.0.1 topojson-simplify@3.0.3
curl -sL -o de.json https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main/2_bundeslaender/4_niedrig.geo.json
curl -sL -o cz.json https://raw.githubusercontent.com/siwekm/czech-geojson/master/kraje.json
cp <StudyBoard>/tools/dobyvatel-maps/build.mjs .
node build.mjs <StudyBoard>/data/dobyvatel
```
