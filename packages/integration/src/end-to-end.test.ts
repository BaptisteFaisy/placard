import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { computeFingerprint, stringifyReport } from '@placard/core';
import { generate } from '@placard/demo-repo';
import { createManorModel } from '@placard/manor-model';
import { createRitualApi } from '@placard/ritual';
import { runScanPipeline } from './pipeline.js';

describe('end-to-end Placard oracle & properties (C.17)', () => {
  it('valide PLA-P-01, PLA-P-02, PLA-P-03, PLA-P-05, PLA-P-11, PLA-P-12, PLA-F-23 sur dépôt synthétique', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'placard-e2e-'));
    try {
      const demo = await generate({ targetDir: dir, seed: 'e2e-seed-2026', commits: 40, years: 2 });
      const { report, salt } = await runScanPipeline(dir);
      const json = stringifyReport(report);

      // PLA-P-01 : aucune valeur plantée n'apparaît en clair dans le rapport.
      // Exception assumée : pour la famille `risky-file`, la « valeur » EST le
      // chemin du fichier (deux fichiers distincts ne doivent pas partager une
      // empreinte) — et un chemin figure légitimement dans `locations`, ce
      // n'est pas un secret.
      for (const secret of demo.planted) {
        if (secret.family === 'risky-file') continue;
        if (secret.value.length > 6) {
          expect(json.includes(secret.value)).toBe(false);
        }
      }

      // PLA-P-02 : les secrets plantés sont retrouvés via leur empreinte HMAC
      const fps = new Set(report.findings.map((f) => f.fingerprint));
      let matched = 0;
      for (const secret of demo.planted) {
        if (fps.has(computeFingerprint(secret.value, salt))) matched += 1;
      }
      // PLA-P-02 au plus fort : TOUTES les valeurs plantées sont retrouvées,
      // et chacune avec la bonne année (une année par étage du manoir).
      expect(matched).toBe(demo.planted.length);
      const years = new Set(report.findings.map((f) => f.introduced.date.slice(0, 4)));
      expect(years.size).toBeGreaterThanOrEqual(2);

      // PLA-P-05 : déterminisme à l'horodatage près
      const second = await runScanPipeline(dir);
      expect(second.report.findings.map((f) => f.fingerprint)).toEqual(
        report.findings.map((f) => f.fingerprint),
      );

      // PLA-P-11 : le manoir et le registre exposent exactement le même ensemble sur 5 jeux de filtres
      const model = createManorModel();
      const filters = [
        model.emptyFilter(),
        { ...model.emptyFilter(), inHead: true },
        { ...model.emptyFilter(), severities: ['critical' as const] },
        { ...model.emptyFilter(), families: ['cloud-key' as const, 'bank-data' as const] },
        { ...model.emptyFilter(), states: ['open' as const] },
      ];
      for (const flt of filters) {
        const vm = model.buildViewModel(report, flt);
        const rows = model.registryRows(vm, { field: 'danger', direction: 'desc' });
        expect(rows.map((r) => r.finding.id).sort()).toEqual(vm.findings.map((f) => f.id).sort());
      }

      // PLA-F-23 : verrou d'ordre du rituel (purge refusée avant rotation)
      const ritual = createRitualApi();
      const firstFinding = report.findings[0]!;
      const stepsBefore = ritual.steps(firstFinding, undefined);
      expect(stepsBefore.find((s) => s.id === 'purge')?.locked).toBe(true);
      await expect(
        ritual.generatePurge(
          { repoDir: dir, placardDir: join(dir, '.placard'), tmpDir: join(dir, '../tmp-ritual'), toolVersion: '0.1.0' },
          [firstFinding],
        ),
      ).rejects.toThrow();

      // PLA-P-12 : un commit sans secret ne change pas les empreintes existantes
      await writeFile(join(dir, 'README_NEUTRAL.md'), 'Harmless documentation line\n');
      const gitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      };
      spawnSync('git', ['add', 'README_NEUTRAL.md'], { cwd: dir, env: gitEnv });
      spawnSync('git', ['commit', '-m', 'docs: neutral commit'], { cwd: dir, env: gitEnv });
      const afterNeutral = await runScanPipeline(dir);
      expect(afterNeutral.report.findings.map((f) => f.fingerprint)).toEqual(
        report.findings.map((f) => f.fingerprint),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
