import type { AnalysisProgress, HistoryEvent } from '@placard/core';

/**
 * Affichage de progression sur stderr (PLA-F-12) : commits scannés, trouvailles,
 * temps écoulé. Utilise un retour chariot pour écraser la ligne sur un terminal
 * interactif, et reste lisible dans un tuyau ou un journal de CI.
 */

export interface ProgressState {
  commits: number;
  totalCommits: number;
  lines: number;
  findings: number;
  phase: string;
}

export class ProgressDisplay {
  private readonly isTty: boolean;
  private readonly out: NodeJS.WriteStream;
  private readonly startedAt: number;
  private lastRender = 0;
  private state: ProgressState = {
    commits: 0,
    totalCommits: 0,
    lines: 0,
    findings: 0,
    phase: 'initializing',
  };

  constructor(out: NodeJS.WriteStream = process.stderr) {
    this.out = out;
    this.isTty = Boolean(out.isTTY);
    this.startedAt = Date.now();
  }

  /** Met à jour depuis un événement d'historique. */
  onHistory(event: HistoryEvent): void {
    if (event.kind === 'repo') {
      this.state.totalCommits = event.repo.totalCommits;
      this.state.phase = 'scanning';
    } else if (event.kind === 'commit') {
      this.state.commits = event.commit.index + 1;
    } else if (event.kind === 'line') {
      this.state.lines += 1;
    } else if (event.kind === 'progress') {
      this.state.commits = event.scanned;
      if (event.total > 0) this.state.totalCommits = event.total;
    } else if (event.kind === 'end') {
      this.state.phase = 'analyzing';
    }
    this.render();
  }

  /** Met à jour depuis la progression du moteur d'analyse. */
  onAnalysis(progress: AnalysisProgress): void {
    if (progress.kind === 'scanning') {
      this.state.phase = 'grouping';
      this.state.findings = progress.findings;
    } else if (progress.kind === 'grouping') {
      this.state.phase = 'grouping';
    } else if (progress.kind === 'scoring') {
      this.state.phase = `scoring ${progress.done}/${progress.total}`;
    } else if (progress.kind === 'report') {
      this.state.findings = progress.findings;
      this.state.phase = 'complete';
    }
    this.render(true);
  }

  /** Termine l'affichage et saute une ligne pour laisser le terminal propre. */
  done(): void {
    if (this.isTty) {
      this.out.write('\r\x1b[K');
    }
  }

  private render(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastRender < 80) return;
    this.lastRender = now;
    const elapsed = ((now - this.startedAt) / 1000).toFixed(1);
    const total = this.state.totalCommits > 0 ? `/${this.state.totalCommits}` : '';
    const line =
      `Scanning: ${this.state.commits}${total} commits, ` +
      `${this.state.findings} findings, ${elapsed}s (${this.state.phase})`;
    if (this.isTty) {
      this.out.write(`\r${line}`);
    }
  }
}
