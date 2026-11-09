// Turns dist-artifact/index.html (a full single-file document) into page content for
// a hosted artifact: the host supplies the doctype, <head> and <body> wrapper.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);

const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Agent Field Atlas</title>';
const styles = pick(/<style[\s\S]*?<\/style>/g);
const scripts = pick(/<script[\s\S]*?<\/script>/g);
const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap">';

const page = [title, '<meta name="theme-color" content="#F3EDDE">', fonts, ...styles, '<div id="root"></div>', ...scripts].join('\n');
writeFileSync('dist-artifact/agent-field-atlas.html', page);
console.log(`dist-artifact/agent-field-atlas.html  ${(page.length / 1024).toFixed(1)} kB`);
