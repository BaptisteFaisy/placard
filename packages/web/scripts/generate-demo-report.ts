import { generate } from '../../demo-repo/src/index.js';
import { cli } from '../../cli/src/index.js';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

async function main() {
  // Le nom du dépôt affiché dans le manoir est celui du dossier : on lui donne
  // un nom lisible à l'écran plutôt qu'un chemin de build.
  const tmpDemo = resolve(tmpdir(), 'placard-demo', 'acme-api');
  console.log('Generating synthetic haunted repository in', tmpDemo);
  await generate({ targetDir: tmpDemo, seed: 'kiroween-2026-demo-manor' });

  console.log('Scanning generated repository...');
  const res = await cli.scan({ repoDir: tmpDemo });
  if (!res.reportPath) throw new Error('No report generated');

  // Chemin résolu depuis CE fichier : le script doit pouvoir être lancé depuis
  // n'importe quel dossier de travail (pnpm --filter change le cwd).
  const packageRoot = fileURLToPath(new URL('..', import.meta.url));
  const pubDir = resolve(packageRoot, 'public');
  await mkdir(pubDir, { recursive: true });
  const dest = resolve(pubDir, 'demo-report.json');
  await copyFile(res.reportPath, dest);
  console.log('Demo report successfully generated and copied to', dest);
}

await main();
