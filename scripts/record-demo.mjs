#!/usr/bin/env node
/**
 * Enregistre la démonstration web de Placard en vidéo (.webm), sans son.
 *
 * Playwright n'est volontairement PAS une dépendance du dépôt : l'installer
 * alourdirait chaque job CI de 150 Mo pour un outil qui ne sert qu'à produire la
 * vidéo de soumission. Installation hors du dépôt :
 *
 *   npm i --prefix /tmp/placard-video playwright@1.49.0
 *   npx --prefix /tmp/placard-video playwright install chromium
 *   pnpm --filter @placard/web build
 *   NODE_PATH=/tmp/placard-video/node_modules node scripts/record-demo.mjs
 *
 * La vidéo est écrite dans /tmp/placard-video (jamais dans le dépôt : un binaire
 * de 5 Mo n'a rien à faire dans un dépôt public). Aucune requête réseau n'est
 * émise pendant l'enregistrement — c'est vérifié et affiché (PLA-N-01).
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DIST = join(REPO_ROOT, 'packages/web/dist');
const OUT_DIR = process.env.PLACARD_VIDEO_DIR ?? '/tmp/placard-video';
const WIDTH = 1280;
const HEIGHT = 720;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Sert le site construit sur 127.0.0.1, port éphémère. */
function serveDist() {
  const server = createServer(async (req, res) => {
    const path = req.url === '/' ? '/index.html' : (req.url ?? '/').split('?')[0];
    try {
      const body = await readFile(join(DIST, path));
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
  });
}

/** Charge Playwright depuis NODE_PATH, avec un message d'aide explicite. */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    console.error(
      [
        'Playwright est introuvable. Installez-le HORS du dépôt puis relancez :',
        '  npm i --prefix /tmp/placard-video playwright@1.49.0',
        '  npx --prefix /tmp/placard-video playwright install chromium',
        '  NODE_PATH=/tmp/placard-video/node_modules node scripts/record-demo.mjs',
      ].join('\n'),
    );
    process.exit(2);
  }
}

/** Compte les requêtes qui quittent la machine (doit rester à zéro). */
function watchNetwork(page) {
  const escaped = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') escaped.push(request.url());
  });
  return escaped;
}

const wait = (page, ms) => page.waitForTimeout(ms);

/** Descente lente des étages puis remontée : le manoir entier à l'écran. */
async function panFloors(page) {
  const box = await page.locator('[data-doors]').first().boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, 90);
    await wait(page, 320);
  }
  await wait(page, 1500);
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, -90);
    await wait(page, 220);
  }
  await wait(page, 1200);
}

/** Parcours P1→P7 : hall, manoir, porte, fiche, registre, filtres, légende. */
async function walkthrough(page) {
  await page.waitForSelector('[data-doors]', { timeout: 15_000 });
  await wait(page, 5000); // le hall et ses compteurs, le temps de lire
  await panFloors(page);

  const doors = await page.$$('[role="button"][data-commit]');
  if (doors.length > 1) {
    await doors[1].hover();
    await wait(page, 2500);
    await doors[1].click(); // ouvre une porte : la fiche du squelette
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(page, 9000); // famille, aperçu masqué, score et ses raisons
    await page.keyboard.press('Escape');
    await wait(page, 2500);
  }

  await page.keyboard.press('Tab'); // navigation clavier dans le manoir
  await wait(page, 1200);
  await page.keyboard.press('ArrowRight');
  await wait(page, 1800);
  await page.keyboard.press('ArrowRight');
  await wait(page, 4000);

  await page.getByRole('button', { name: /Registry Table View/i }).click();
  await page.waitForSelector('table', { timeout: 5000 });
  await wait(page, 6000);

  const sortable = page.locator('th button').first();
  if (await sortable.count()) {
    await sortable.click();
    await wait(page, 4000);
  }

  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count()) {
    await checkbox.click(); // un filtre : les deux vues suivent
    await wait(page, 4500);
    await checkbox.click();
    await wait(page, 2500);
  }

  await page.getByRole('button', { name: /Haunted Manor View/i }).click();
  await wait(page, 4000);
  await page.getByRole('button', { name: /Costume Legend/i }).click();
  await wait(page, 10_000); // la table de correspondance décor ↔ donnée
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('Site non construit : lancez d’abord `pnpm --filter @placard/web build`.');
    process.exit(2);
  }
  const { chromium } = loadPlaywright();
  const { server, port } = await serveDist();
  const browser = await chromium.launch({ args: ['--force-prefers-reduced-motion'] });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: OUT_DIR, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();
  const escaped = watchNetwork(page);

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await walkthrough(page);
    await wait(page, 4000);
  } finally {
    const video = page.video();
    // `context.close()` finalise le fichier ; `saveAs` n'existe plus ensuite :
    // on relève le chemin puis on renomme, une fois le navigateur fermé.
    const recorded = video ? await video.path().catch(() => undefined) : undefined;
    await context.close();
    await browser.close();
    server.close();
    const target = join(OUT_DIR, 'placard-demo.webm');
    if (recorded) await rename(recorded, target).catch(() => undefined);
    const file = recorded ? target : '(aucune vidéo)';
    console.log(`vidéo : ${file}`);
    console.log(`requêtes sortantes (doit être 0) : ${escaped.length}`);
    if (escaped.length > 0) console.log(escaped.slice(0, 5).join('\n'));
  }
}

await main();
