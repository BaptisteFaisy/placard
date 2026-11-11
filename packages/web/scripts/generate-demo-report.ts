import { generate } from '../../demo-repo/src/index.js';
import { cli } from '../../cli/src/index.js';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const tmpDemo = resolve('/tmp/placard-web-demo-build');
  console.log('Generating synthetic haunted repository in', tmpDemo);
  await generate({ targetDir: tmpDemo, seed: 'kiroween-2026-demo-manor' });

  console.log('Scanning generated repository...');
  const res = await cli.scan({ repoDir: tmpDemo });
  if (!res.reportPath) throw new Error('No report generated');

  const pubDir = resolve('packages/web/public');
  await mkdir(pubDir, { recursive: true });
  const dest = resolve(pubDir, 'demo-report.json');
  await copyFile(res.reportPath, dest);
  console.log('Demo report successfully generated and copied to', dest);
}

await main();
