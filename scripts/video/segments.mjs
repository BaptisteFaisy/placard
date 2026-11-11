/**
 * Fabrique des segments HTML pour la vidéo de soumission : cartons et terminal.
 *
 * Aucun asset tiers : polices système, palette de Placard, aucune marque, aucun
 * son. Le terminal rejoue une **vraie** sortie de l'outil (le rapport JSON du
 * dépôt de démonstration), pas une capture fabriquée.
 */

/** Palette du projet (steering `art-direction.md`). */
export const PALETTE = {
  night: '#14101f',
  stone: '#2a2140',
  bone: '#ede6d6',
  candle: '#f2a541',
  alert: '#e4572e',
};

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: ${PALETTE.night}; color: ${PALETTE.bone}; }
  body { font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; overflow: hidden; }
`;

/** Échappe le texte injecté dans le HTML. */
export function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Carton : titre, sous-titre et lignes, avec apparition progressive. */
export function cardHtml({ title, subtitle, lines = [], accent = PALETTE.candle }) {
  const items = lines
    .map((line, index) => `<li style="animation-delay:${900 + index * 320}ms">${escapeHtml(line)}</li>`)
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${BASE_CSS}
  .wrap { height: 100%; display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center; padding: 3rem; }
  h1 { font-size: 3.4rem; margin: 0 0 .6rem; color: ${accent}; letter-spacing: .02em;
       opacity: 0; animation: rise 700ms ease-out forwards; }
  p.sub { font-size: 1.5rem; margin: 0 0 2rem; opacity: 0; animation: rise 700ms 400ms ease-out forwards; }
  ul { list-style: none; padding: 0; margin: 0; font-size: 1.15rem; line-height: 1.9; }
  li { opacity: 0; animation: rise 500ms ease-out forwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
</style></head><body><div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
  <ul>${items}</ul>
</div></body></html>`;
}

/** Terminal : les lignes apparaissent à `linesPerSecond`, avec défilement auto. */
export function terminalHtml({ prompt, lines, linesPerSecond = 14 }) {
  const payload = JSON.stringify(lines.map(String));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${BASE_CSS}
  body { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 15px; }
  .term { height: 100%; padding: 14px 18px; overflow: hidden; display: flex; flex-direction: column; }
  .bar { color: ${PALETTE.candle}; font-size: 13px; margin-bottom: 10px; opacity: .9; }
  .out { flex: 1; overflow: hidden; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
  .cmd { color: ${PALETTE.candle}; }
  .dim { opacity: .78; }
</style></head><body><div class="term">
  <div class="bar">baptiste@workstation — ~/code/acme-api</div>
  <div class="out" id="out"></div>
</div><script>
  const LINES = ${payload};
  const RATE = ${linesPerSecond};
  const out = document.getElementById('out');
  const prompt = ${JSON.stringify(prompt ?? '')};
  let i = 0;
  if (prompt) {
    const p = document.createElement('div');
    p.className = 'cmd';
    p.textContent = prompt;
    out.appendChild(p);
  }
  const timer = setInterval(() => {
    if (i >= LINES.length) { clearInterval(timer); return; }
    const div = document.createElement('div');
    div.className = 'dim';
    div.textContent = LINES[i];
    i += 1;
    out.appendChild(div);
    while (out.childNodes.length > 34) out.removeChild(out.firstChild);
  }, 1000 / RATE);
</script></body></html>`;
}

/** Vue « éditeur » : un extrait de fichier, comme dans l'IDE, sans marque tierce. */
export function codeHtml({ path, lines, linesPerSecond = 6 }) {
  const payload = JSON.stringify(lines.map(String));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${BASE_CSS}
  body { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 15px; }
  .head { padding: 12px 18px; background: ${PALETTE.stone}; color: ${PALETTE.candle}; font-size: 14px; }
  .out { padding: 14px 18px; white-space: pre-wrap; line-height: 1.55; }
  .ln { opacity: 0; animation: fade 300ms ease-out forwards; }
  @keyframes fade { to { opacity: 1; } }
</style></head><body>
  <div class="head">${escapeHtml(path)}</div>
  <div class="out" id="out"></div>
<script>
  const LINES = ${payload};
  const out = document.getElementById('out');
  LINES.forEach((text, index) => {
    const div = document.createElement('div');
    div.className = 'ln';
    div.style.animationDelay = (index * ${Math.round(1000 / linesPerSecond)}) + 'ms';
    div.textContent = text;
    out.appendChild(div);
  });
</script></body></html>`;
}
