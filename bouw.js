// Voegt sjabloon, speler, speler-CSS, voorbeeldcursus en bouwerlogica samen.
// index.html is de losse pagina; artifact.html is dezelfde inhoud zonder omhulsel,
// want claude.ai zet daar bij het publiceren zelf een omhulsel omheen.
// Gebruik: node bouw.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src');
const lees = f => fs.readFileSync(path.join(dir, f), 'utf8');
const bs = String.fromCharCode(92);
const voorbeeld = JSON.stringify(JSON.parse(lees('voorbeeld.json'))).split('<').join(bs + 'u003c');
const delen = {
  '/*SPELER_CSS*/': lees('speler.css'),
  '/*VOORBEELD*/': voorbeeld,
  '/*SPELER_JS*/': lees('speler.js'),
  '/*BOUWER_JS*/': lees('bouwer.js')
};
let uit = lees('sjabloon.html');
for (const [k, v] of Object.entries(delen)) {
  if (uit.split(k).length !== 2) throw new Error('plaatshouder ' + k);
  if (/<\/script/i.test(v)) throw new Error('</script in ' + k);
  uit = uit.split(k).join(v);
}
fs.writeFileSync(path.join(__dirname, 'artifact.html'), uit);
const los = [
  '<!doctype html>',
  '<html lang="nl">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '</head>',
  '<body>',
  uit,
  '</body>',
  '</html>',
  ''
].join('\n');
fs.writeFileSync(path.join(__dirname, 'index.html'), los);
console.log('index.html', (los.length / 1024).toFixed(0) + ' kB');
