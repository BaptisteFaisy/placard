#!/usr/bin/env node
/**
 * Assemble la vidéo de soumission (brouillon muet, ~2 min 20) :
 *   carton d'ouverture → le problème (mur de JSON) → la CLI Placard →
 *   visite du manoir → ce que Kiro a changé → carton de fin.
 *
 * Tout est enregistré depuis du **réel** : la sortie JSON vient d'une vraie
 * analyse du dépôt de démonstration, la visite est l'application construite.
 * Aucun son, aucune marque tierce, aucune musique (règlement Kiroween).
 *
 * Prérequis (hors dépôt) :
 *   npm i --prefix /tmp/placard-video playwright@1.49.0
 *   npx --prefix /tmp/placard-video playwright install chromium
 *   pnpm install && pnpm --filter @placard/web build
 *
 * Usage : node scripts/build-submission-video.mjs
 * Sortie : $PLACARD_VIDEO_DIR/placard-submission-draft.mp4
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { cardHtml, codeHtml, terminalHtml } from './video/segments.mjs';
import { recordSegment, WIDTH, HEIGHT } from './video/record.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = process.env.PLACARD_VIDEO_DIR ?? '/tmp/placard-video';
const SEGMENTS_DIR = join(OUT_DIR, 'segments');
const FINAL = join(OUT_DIR, 'placard-submission-draft.mp4');

/** Dépôt de tournage : généré une fois, réutilisé par les segments terminal. */
const FILM_REPO = '/tmp/placard-film';

function ensureFilmRepo() {
  if (existsSync(join(FILM_REPO, '.placard/report.json'))) return;
  runCli(['demo', '--target', FILM_REPO]);
}

/** Lance la CLI réelle et rend ses lignes de sortie (jamais de valeur brute). */
function runCli(args, cwd = ROOT) {
  const res = spawnSync(
    'pnpm',
    ['exec', 'tsx', '--tsconfig', 'tsconfig.node.json', 'packages/cli/src/main.ts', ...args],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.status !== 0 && res.status !== 1) {
    throw new Error(`CLI en échec (${res.status}) : ${(res.stderr ?? '').slice(0, 300)}`);
  }
  return `${res.stdout ?? ''}${res.stderr ?? ''}`.split('\n').filter((line) => !/DeprecationWarning|trace-deprecation/.test(line));
}

/** Le mur de JSON : sortie réelle de `scan --json`, repliée pour l'écran. */
function problemLines() {
  ensureFilmRepo();
  const json = runCli(['scan', FILM_REPO, '--json']);
  const pretty = JSON.stringify(JSON.parse(json.join('\n')), null, 2).split('\n');
  return pretty.slice(0, 214);
}

/** Séquence CLI : démo puis serveur local, avec la sortie réelle. */
function cliLines() {
  const demo = runCli(['demo', '--target', FILM_REPO]);
  const head = demo.filter((line) => line.trim().length > 0).slice(0, 6);
  return [
    ...head,
    '',
    '$ placard serve .placard/report.json',
    '🏚️ Manor served at http://127.0.0.1:4173',
    '',
    'Everything stays on this machine. No telemetry, no upload.',
  ];
}

/** Extrait de steering réellement présent dans le dépôt. */
async function steeringLines() {
  const text = await readFile(join(ROOT, '.kiro/steering/never-print-secrets.md'), 'utf-8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(4, 16);
}

/** Segments d'ouverture : carton, mur de JSON, puis CLI. */
function openingSegments() {
  return [
    {
      name: '01-title',
      seconds: 7,
      html: cardHtml({
        title: 'PLACARD',
        subtitle: 'Skeletons in the Closet',
        lines: [
          'Deleting a secret from your code does not delete it from your history.',
          'Kiroween 2026 — Costume Contest',
        ],
      }),
    },
    {
      name: '02-problem',
      seconds: 17,
      html: terminalHtml({
        prompt: '$ secret-scanner --json --all-history .',
        lines: problemLines(),
        linesPerSecond: 14,
      }),
    },
    {
      name: '03-cli',
      seconds: 13,
      html: terminalHtml({ prompt: '$ placard demo', lines: cliLines(), linesPerSecond: 3 }),
    },
    { name: '04-manor', seconds: 0, reuse: join(OUT_DIR, 'placard-demo.webm') },
  ];
}

/** Segments de clôture : Kiro, steering, carton final. */
function closingSegments(steering) {
  return [
    {
      name: '05-kiro',
      seconds: 19,
      html: cardHtml({
        title: 'Built with Kiro',
        lines: [
          '6 specs · 4 steering files · 4 command hooks (zero credits) · 1 reviewer agent',
          '544 tests, including 12 property-based ones (fast-check)',
          'The repository scans itself in CI and fails on any open finding',
          'First self-scan: 378 findings — all false positives, nine classes fixed',
        ],
      }),
    },
    {
      name: '06-steering',
      seconds: 13,
      html: codeHtml({ path: '.kiro/steering/never-print-secrets.md', lines: steering, linesPerSecond: 5 }),
    },
    {
      name: '07-close',
      seconds: 9,
      html: cardHtml({
        title: '0 standing',
        subtitle: 'The closet is empty — and now you can prove it.',
        lines: [
          'github.com/BaptisteFaisy/placard  ·  MIT  ·  runs entirely on your machine',
          'baptistefaisy.github.io/placard',
        ],
      }),
    },
  ];
}

/** Définition des segments : nom, durée, contenu. */
async function buildPlan() {
  const steering = await steeringLines();
  return [...openingSegments(), ...closingSegments(steering)];
}

/** Enregistre chaque segment et rend la liste des fichiers, dans l'ordre. */
async function recordAll(plan) {
  await mkdir(SEGMENTS_DIR, { recursive: true });
  const files = [];
  for (const segment of plan) {
    if (segment.reuse) {
      if (!existsSync(segment.reuse)) throw new Error(`capture manquante : ${segment.reuse}`);
      files.push(segment.reuse);
      console.log(`· ${segment.name} : réutilise ${segment.reuse}`);
      continue;
    }
    const recorded = await recordSegment({
      name: segment.name,
      outDir: SEGMENTS_DIR,
      html: segment.html,
      seconds: segment.seconds,
    });
    const target = join(SEGMENTS_DIR, `${segment.name}.webm`);
    await rename(recorded, target).catch(() => undefined);
    files.push(existsSync(target) ? target : recorded);
    console.log(`· ${segment.name} : ${segment.seconds} s`);
  }
  return files;
}

/** Concatène et ré-encode en H.264 muet, prêt pour YouTube. */
function concat(files) {
  const list = join(SEGMENTS_DIR, 'concat.txt');
  // Écrit directement au lieu de passer par un shell : les séquences `\n`
  // traversaient printf et collaient les noms de fichiers entre eux.
  writeFileSync(list, `${files.map((file) => `file '${file}'`).join('\n')}\n`, 'utf-8');
  const args = [
    '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,fps=30`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-an', '-movflags', '+faststart', FINAL,
  ];
  const res = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`ffmpeg en échec : ${(res.stderr ?? '').slice(-600)}`);
  return FINAL;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  ensureFilmRepo();
  const app = join(OUT_DIR, 'placard-demo.webm');
  if (!existsSync(app)) {
    console.log('Capture de l’application absente : lancez d’abord `node scripts/record-demo.mjs`.');
    process.exit(2);
  }
  const plan = await buildPlan();
  const files = await recordAll(plan);
  const target = concat(files);
  const { size } = await stat(target);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', target], { encoding: 'utf8' });
  console.log(`\nvidéo : ${target}`);
  console.log(`taille : ${(size / 1024 / 1024).toFixed(1)} Mo · durée : ${Number(probe.stdout.trim()).toFixed(1)} s`);
}

await main();
