const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '../../');
for (const d of ['assets/icons', 'assets/tab']) {
  const full = path.join(root, d);
  for (const f of fs.readdirSync(full).filter(x => x.endsWith('.svg'))) {
    let svg = fs.readFileSync(path.join(full, f), 'utf8');
    svg = svg.replace(/<text[\s\S]*?<\/text>/g, '');           // 去文字
    const resvg = new Resvg(svg, { fitTo:{mode:'zoom',value:4}, font:{loadSystemFonts:true}, background:'rgba(0,0,0,0)' });
    let bbox; try { bbox = resvg.getBBox(); } catch(e){}
    if (!bbox) { try { bbox = resvg.innerBBox(); } catch(e){} }
    if (bbox) resvg.cropByBBox(bbox);
    const png = resvg.render().asPng();
    const out = path.join(full, f.replace(/\.svg$/, '.png'));
    fs.writeFileSync(out, png);
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    console.log((d+'/'+f.replace('.svg','.png')).padEnd(30), `${w}x${h}`.padEnd(12), Math.round(png.length/1024)+'KB');
  }
}
