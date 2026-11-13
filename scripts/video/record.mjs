/**
 * Enregistre un segment HTML en vidéo (Playwright), sans son.
 *
 * Playwright n'est pas une dépendance du dépôt (150 Mo de navigateurs pour un
 * outil de soumission) : on le résout depuis NODE_PATH ou un prefixe npm dédié.
 *   npm i --prefix /tmp/placard-video playwright@1.49.0
 *   npx --prefix /tmp/placard-video playwright install chromium
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const WIDTH = 1280;
export const HEIGHT = 720;

const CANDIDATE_PATHS = [
  'playwright',
  '/tmp/placard-video/node_modules/playwright/index.js',
];

/** Résout Playwright ; message d'aide explicite s'il est absent. */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const candidate of CANDIDATE_PATHS) {
    try {
      return require(candidate);
    } catch {
      // essaie le suivant
    }
  }
  throw new Error(
    [
      'Playwright introuvable. Installez-le hors du dépôt :',
      '  npm i --prefix /tmp/placard-video playwright@1.49.0',
      '  npx --prefix /tmp/placard-video playwright install chromium',
    ].join('\n'),
  );
}

/**
 * Enregistre une page (URL ou HTML inline) pendant `seconds`.
 * Rend le chemin du fichier vidéo produit.
 */
export async function recordSegment({ name, outDir, url, html, seconds, onReady }) {
  await mkdir(outDir, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--force-prefers-reduced-motion'] });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: outDir, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();
  let recorded;
  try {
    if (html !== undefined) {
      const file = join(outDir, `${name}.html`);
      await writeFile(file, html, 'utf-8');
      await page.goto(`file://${file}`, { waitUntil: 'load' });
    } else {
      await page.goto(url, { waitUntil: 'load' });
    }
    if (onReady) await onReady(page);
    await page.waitForTimeout(Math.round(seconds * 1000));
  } finally {
    const video = page.video();
    recorded = video ? await video.path().catch(() => undefined) : undefined;
    await context.close();
    await browser.close();
  }
  if (!recorded) throw new Error(`segment ${name} : aucune vidéo produite`);
  return recorded;
}
