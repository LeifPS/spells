// Eigener Icon-Satz (statt Emojis): ein SVG-Sprite, das beim Import in die Seite eingefügt wird.
// ico('coin') -> <svg class="ico"><use href="#i-coin"/></svg>;  rich('+30 {coin}') ersetzt {name} durch Icons.

const P = {
  // Navigation
  wands: '<path d="M5 20L17 8M19 20L7 8"/><path d="M18 3v4M16 5h4M6 3v4M4 5h4"/>',
  book: '<path d="M3.5 5.5C3.5 4.7 4.2 4 5 4h6.5v15H5c-.8 0-1.5.7-1.5 1.500z M20.5 5.5c0-.8-.7-1.500-1.500-1.500H12.500v15H19c.8 0 1.500.7 1.500 1.500z"/><path d="M7 8h2.500M7 11h2.500M15 8h2M15 11h2"/>',
  gem: '<path d="M6.500 4h11L22 9.500 12 21 2 9.500z"/><path d="M2 9.500h20M9 4L7 9.500 12 21l5-11.500L15 4"/>',
  scroll: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4"/><path d="M5 4a1 1 0 0 1 1-1M9 12.500l2.200 2.200L15.500 10"/>',
  sliders: '<path d="M4 7h9M19 7h1M4 12h3M13 12h7M4 17h11M21 17h-1"/><circle cx="16" cy="7" r="2.200"/><circle cx="10" cy="12" r="2.200"/><circle cx="18" cy="17" r="2.200"/>',
  // Währungen & Werte (farbig)
  coin: '<circle cx="12" cy="12" r="10" fill="url(#gCoin)" stroke="#7a4408" stroke-width="1.300"/><circle cx="12" cy="12" r="7.600" fill="none" stroke="#fff3b8" stroke-opacity=".75" stroke-width="1"/><path d="M12 6.200l1.700 4 4.100.4-3.100 2.700 1 4.100L12 15.300 8.300 17.400l1-4.100-3.100-2.700 4.100-.4z" fill="#b8620c" stroke="none" opacity=".85"/><path d="M5.500 8.500A8 8 0 0 1 12 4" stroke="#fff" stroke-opacity=".7" stroke-width="1.500" fill="none"/>',
  trophy: '<path d="M7.500 4h9v5.500a4.500 4.500 0 0 1-9 0z" fill="currentColor" fill-opacity=".25"/><path d="M7.500 6H4.500v1a3.200 3.200 0 0 0 3.200 3.200M16.500 6h3v1a3.200 3.200 0 0 1-3.200 3.200M12 14v3M8.500 20.500h7M9.500 17h5v3.500h-5z"/>',
  star: '<path d="M12 3l2.700 5.600 6.100.8-4.500 4.200 1.100 6.100L12 16.800 6.600 19.700l1.100-6.100L3.200 9.400l6.100-.8z" fill="currentColor"/>',
  drop: '<path d="M12 3c3.200 4.200 6 7.200 6 11a6 6 0 0 1-12 0c0-3.800 2.800-6.800 6-11z" fill="currentColor"/><path d="M9.200 14.500a3 3 0 0 0 2 2.700" stroke="#fff" stroke-opacity=".7" fill="none"/>',
  heart: '<path d="M12 20S3.800 14.500 3.800 9A4.200 4.200 0 0 1 12 7.600 4.200 4.200 0 0 1 20.200 9C20.200 14.500 12 20 12 20z" fill="currentColor" fill-opacity=".25"/>',
  bolt: '<path d="M13.500 2L5 14h6l-1 8 9-12.500h-6.200z" fill="currentColor" fill-opacity=".3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.200l3.200 2"/>',
  // Aktionen
  lock: '<rect x="5.500" y="10.500" width="13" height="10" rx="2" fill="currentColor" fill-opacity=".2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4.500 19.500l1-4L16 5l3 3L8.500 18.500z"/><path d="M14 7l3 3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.600v.4"/>',
  sound: '<path d="M4 9.500v5h3.500L12.500 19V5L7.500 9.500z" fill="currentColor" fill-opacity=".25"/><path d="M16 9.200a4 4 0 0 1 0 5.600M18.800 6.500a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9.500v5h3.500L12.500 19V5L7.500 9.500z" fill="currentColor" fill-opacity=".25"/><path d="M16.500 9.500l5 5M21.500 9.500l-5 5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.500 14a4.200 4.200 0 0 0 7 0M9 9.500v.5M15 9.500v.5"/>',
  flag: '<path d="M6 21V4M6 5h11l-2.500 3.500L17 12H6"/>',
  trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13M10.500 11v5.500M13.500 11v5.500"/>',
  graduation: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.500V16c3 2.500 9 2.500 12 0v-4.500M22 9v5"/>',
  gift: '<rect x="4" y="10" width="16" height="10.500" rx="1.500" fill="currentColor" fill-opacity=".2"/><path d="M3 7h18v3H3zM12 7v13.500M12 7C9 7 8 3.500 10.500 3.500S12 7 12 7zM12 7c3 0 4-3.500 1.500-3.500S12 7 12 7z"/>',
  pack: '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" fill-opacity=".2"/><path d="M12 8l1.300 2.700 2.900.4-2.100 2 .5 2.900-2.600-1.400-2.600 1.400.5-2.900-2.100-2 2.900-.4z"/>',
  crown: '<path d="M3 8.500l4.500 4L12 5l4.500 7.500 4.500-4L19 19H5z" fill="currentColor" fill-opacity=".25"/><path d="M5 19.500h14"/>',
  sparkle: '<path d="M12 3l2 6.500 6.500 2.500-6.500 2.500L12 21l-2-6.500L3.500 12 10 9.500z" fill="currentColor" fill-opacity=".25"/>',
  people: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 20c0-3.500 2.700-5.800 6-5.800s6 2.300 6 5.800M16 5.600a3.200 3.200 0 0 1 0 5.800M18 14.500c2 .7 3.500 2.500 3.500 5"/>',
  tower: '<path d="M8 21V10L6.500 8V4h2v1.500h2V4h3v1.500h2V4h2v4L16 10v11z" fill="currentColor" fill-opacity=".2"/><path d="M11 21v-4a1 1 0 0 1 2 0v4M12 12v1"/>',
  // Training & Status
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/>',
  sprout: '<path d="M12 21v-8M12 13c0-4.500-3.500-7-8-7 0 4.500 3 7 8 7zM12 11c0-4 3-6 8-6 0 4.500-3 7-8 7z" />',
  flame: '<path d="M12 2.500c.8 4 5.500 6 5.500 11.500a5.500 5.500 0 0 1-11 0c0-2.200 1-3.500 2.200-4.600.2 1.800 1 2.800 2 2.800C10 8.500 10.200 5.500 12 2.500z" fill="currentColor" fill-opacity=".3"/>',
  skull: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.500 4.700 3 5.700V20h10v-3.300c1.500-1 3-2.700 3-5.700a8 8 0 0 0-8-8z" fill="currentColor" fill-opacity=".15"/><circle cx="9" cy="11.500" r="1.600"/><circle cx="15" cy="11.500" r="1.600"/><path d="M10.500 20v-2.500M13.500 20v-2.500"/>',
  sword: '<path d="M5 19L19 5M14.500 5H19v4.500M7.500 12.500l4 4M4 20l3.200-3.200"/>',
  snow: '<path d="M12 3v18M4.500 7.500l15 9M19.500 7.500l-15 9"/><path d="M9.500 4.500L12 6.500l2.500-2M9.500 19.500L12 17.500l2.500 2"/>',
  wind: '<path d="M3 8.500h10.500a2.800 2.800 0 1 0-2.800-2.800M3 12.500h15.500a2.800 2.800 0 1 1-2.800 2.800M3 16.500h7"/>',
  shield: '<path d="M12 3l8 3v6c0 4.800-3.400 8-8 9-4.600-1-8-4.200-8-9V6z" fill="currentColor" fill-opacity=".2"/>',
  mirror: '<ellipse cx="12" cy="10.500" rx="5.800" ry="7.500" fill="currentColor" fill-opacity=".15"/><path d="M12 18v3.500M8.500 21.500h7M9 8l2-2.200"/>',
  ghost: '<path d="M5 21V11a7 7 0 0 1 14 0v10l-2.300-2-2.300 2-2.400-2-2.400 2-2.300-2z" fill="currentColor" fill-opacity=".15"/><path d="M9.500 11v.5M14.500 11v.5"/>',
  crack: '<path d="M13 2.500l-3 6.500 4 3-4.500 4 3.500 5.500"/><path d="M5 12h3M17 10h3"/>',
  curse: '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor" fill-opacity=".2"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l8-8"/>',
  // Emotes & Zeichen (selbst gezeichnet)
  thumb: '<path d="M7 11v9H4v-9z" fill="currentColor" fill-opacity=".25"/><path d="M7 11l4-7c1.600 0 2.700 1.100 2.400 2.700L12.800 10H19a1.800 1.800 0 0 1 1.700 2.200l-1.500 6.500A2 2 0 0 1 17.300 20H7"/>',
  laugh: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity=".2"/><path d="M7.200 10.200q1.600-2.200 3.200 0M13.600 10.200q1.600-2.200 3.200 0M7 13.500h10a5 5 0 0 1-10 0z" fill="currentColor" fill-opacity=".35"/>',
  wow: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity=".2"/><path d="M8.600 9.500v1M15.400 9.500v1M7 7.500l2.200-1M17 7.500l-2.200-1"/><ellipse cx="12" cy="15.800" rx="2" ry="2.700" fill="currentColor" fill-opacity=".35"/>',
  angry: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity=".2"/><path d="M6.800 8.200l3.800 1.800M17.200 8.200L13.400 10M9 11.800v.5M15 11.800v.5M8.500 17c2-2 5-2 7 0"/>',
  quest: '<path d="M8.500 8.800a3.500 3.500 0 1 1 5.400 2.900c-1.200.8-1.900 1.500-1.900 3M12 18.800v.4"/>',
  exclam: '<path d="M12 4.500v9M12 18.600v.4"/>',
  clover: '<circle cx="9" cy="9" r="3.600" fill="currentColor" fill-opacity=".3"/><circle cx="15" cy="9" r="3.600" fill="currentColor" fill-opacity=".3"/><circle cx="9" cy="14.500" r="3.600" fill="currentColor" fill-opacity=".3"/><circle cx="15" cy="14.500" r="3.600" fill="currentColor" fill-opacity=".3"/><path d="M12 12l4 8"/>',
  flower: '<circle cx="12" cy="6.500" r="3" fill="currentColor" fill-opacity=".3"/><circle cx="17.200" cy="10.300" r="3" fill="currentColor" fill-opacity=".3"/><circle cx="15.200" cy="16.400" r="3" fill="currentColor" fill-opacity=".3"/><circle cx="8.800" cy="16.400" r="3" fill="currentColor" fill-opacity=".3"/><circle cx="6.800" cy="10.300" r="3" fill="currentColor" fill-opacity=".3"/><circle cx="12" cy="12" r="1.600" fill="currentColor"/>',
  bot: '<rect x="5" y="8" width="14" height="11" rx="3" fill="currentColor" fill-opacity=".2"/><path d="M12 8V5M9.500 13v1M14.500 13v1M9.500 16.500h5"/><circle cx="12" cy="4" r="1.200" fill="currentColor"/>',
  ring: '<circle cx="12" cy="12" r="8"/>',
};

const GRADIENTS = '<defs><linearGradient id="gCoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".45" stop-color="#ffc93a"/><stop offset="1" stop-color="#d9800f"/></linearGradient></defs>';

let ready = false;
function ensure() {
  if (ready || typeof document === 'undefined') return; ready = true;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = GRADIENTS + Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('');
  (document.body || document.documentElement).prepend(s);
}

export function icoHTML(name, cls = '') { ensure(); return `<svg class="ico i-${name} ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
export function ico(name, cls = '') {
  ensure(); const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', `ico i-${name} ${cls}`.trim()); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + name); s.append(u); return s;
}
// '+30 {coin}' -> Fragment mit Text und Icons
export function rich(str) {
  const f = document.createDocumentFragment();
  String(str).split(/(\{[a-z]+\})/).forEach((part) => { const m = part.match(/^\{([a-z]+)\}$/); if (m && P[m[1]]) f.append(ico(m[1])); else if (part) f.append(document.createTextNode(part)); });
  return f;
}
// Icon-Name -> DOM-Icon (Zauberbeschreibung); unbekannte Namen werden ignoriert
export function nameIco(n) { return P[n] ? ico(n, 'e-' + n) : document.createTextNode(''); }

// Dieselben Zeichnungen auf dem Canvas (Effekte, Sprechblasen): drawIcon(g, 'heart', x, y, size, '#ff6fa5')
const cache = {};
function parts(name) {
  if (cache[name]) return cache[name];
  const out = [], src = P[name] || '', re = /<(path|circle|ellipse|rect)\b([^>]*)>/g; let m;
  const at = (a, k) => { const r = a.match(new RegExp('(?:^|\\s)' + k + '="([^"]*)"')); return r ? r[1] : null; };
  while ((m = re.exec(src))) {
    const a = m[2], p = new Path2D(), n = (k, d = 0) => (at(a, k) == null ? d : parseFloat(at(a, k)));
    if (m[1] === 'path') p.addPath ? p.addPath(new Path2D(at(a, 'd'))) : 0;
    else if (m[1] === 'circle') p.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
    else if (m[1] === 'ellipse') p.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, Math.PI * 2);
    else p.roundRect ? p.roundRect(n('x'), n('y'), n('width'), n('height'), n('rx')) : p.rect(n('x'), n('y'), n('width'), n('height'));
    const fill = at(a, 'fill'); out.push({ p, fill: fill && fill !== 'none' ? (fill.indexOf('url(') === 0 ? 'cur' : fill === 'currentColor' ? 'cur' : fill) : null, fo: at(a, 'fill-opacity') == null ? 1 : parseFloat(at(a, 'fill-opacity')), noStroke: at(a, 'stroke') === 'none' });
  }
  return (cache[name] = out);
}
export function drawIcon(g, name, x, y, size, color = '#fff', o = {}) {
  const ps = parts(name); if (!ps.length) return;
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24);
  g.lineWidth = o.lw || 1.9; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = o.blur || 8; }
  const base = g.globalAlpha;
  for (const q of ps) {
    if (q.fill) { g.fillStyle = q.fill === 'cur' ? color : q.fill; g.globalAlpha = base * (o.solid ? Math.max(q.fo, 0.6) : q.fo); g.fill(q.p); g.globalAlpha = base; }
    if (!q.noStroke) g.stroke(q.p);
  }
  g.restore();
}
export const hasIcon = (n) => !!P[n];

// Rang-Wappen: Schild mit n Winkeln
export function rankBadge(idx, color, size = 44) {
  ensure(); const n = idx + 1, y0 = 12.5 - (n - 1) * 1.15;
  let chev = ''; for (let i = 0; i < n; i++) { const y = y0 + i * 2.3; chev += `<path d="M7.500 ${y.toFixed(2)}l4.500 3 4.500-3" />`; }
  const d = document.createElement('span'); d.className = 'rbadge'; d.style.cssText = `--c:${color};width:${size}px;height:${size}px`;
  d.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1.500l9 3v7.500c0 5.200-3.800 8.800-9 10.500-5.200-1.700-9-5.300-9-10.500V4.500z" class="rb-bg"/><path d="M12 3.500l7 2.300V12c0 4-2.800 7-7 8.500-4.200-1.500-7-4.500-7-8.500V5.800z" class="rb-in"/>${chev}</svg>`;
  return d;
}
export const ICON_NAMES = Object.keys(P);

