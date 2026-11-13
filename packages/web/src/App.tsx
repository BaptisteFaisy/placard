import React, { useState } from 'react';
import { safeParseReport, type PlacardReport, type Finding, type FindingFilter, type RegistrySort } from '@placard/core';
import { createManorModel } from '@placard/manor-model';
import { Manor, Registry, Hall, Legend, Filters, FindingSheet } from '@placard/ui';
import demoReportData from '../public/demo-report.json';

/** Le rapport embarqué est validé au démarrage : un rapport invalide arrête net. */
function readEmbeddedReport(): PlacardReport {
  const parsed = safeParseReport(demoReportData);
  if (!parsed.success) throw new Error('Invalid embedded demo report');
  return parsed.data;
}

const labelStyle: React.CSSProperties = {
  cursor: 'pointer',
  background: '#2A2140',
  padding: '0.4rem 0.8rem',
  borderRadius: '4px',
  border: '1px solid #F2A541',
};

/** En-tête : titre, chargement d'un rapport local, légende du costume. */
function Header(props: {
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleLegend: () => void;
}): React.ReactElement {
  return (
    <header>
      <h1>🏚️ Placard — Skeletons in the Closet</h1>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={labelStyle}>
          Load Local Report (.json)
          <input type="file" accept=".json" onChange={props.onUpload} style={{ display: 'none' }} />
        </label>
        <button onClick={props.onToggleLegend}>Costume Legend</button>
      </div>
    </header>
  );
}

/** Bascule entre la vue costumé et le registre accessible. */
function ViewTabs(props: {
  active: 'manor' | 'registry';
  onChange: (tab: 'manor' | 'registry') => void;
}): React.ReactElement {
  return (
    <div className="view-tabs" style={{ marginTop: '1rem' }}>
      <button className={props.active === 'manor' ? 'active' : ''} onClick={() => props.onChange('manor')}>
        Haunted Manor View (Costume)
      </button>
      <button className={props.active === 'registry' ? 'active' : ''} onClick={() => props.onChange('registry')}>
        Registry Table View (Accessible AA)
      </button>
    </div>
  );
}

/** Lit un rapport JSON local et le rend s'il est valide (PLA-F-30). */
function useLocalReport(): {
  report: PlacardReport;
  error: string | null;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
} {
  const [report, setReport] = useState<PlacardReport>(readEmbeddedReport);
  const [error, setError] = useState<string | null>(null);

  function onUpload(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = safeParseReport(JSON.parse(String(reader.result)));
        if (!parsed.success) {
          setError('Invalid Placard report JSON schema.');
          return;
        }
        setReport(parsed.data);
        setError(null);
      } catch {
        setError('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  }

  return { report, error, onUpload };
}

export function App(): React.ReactElement {
  const { report, error, onUpload } = useLocalReport();
  const [activeTab, setActiveTab] = useState<'manor' | 'registry'>('manor');
  const [showLegend, setShowLegend] = useState(false);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [sort, setSort] = useState<RegistrySort>({ field: 'danger', direction: 'desc' });

  const model = createManorModel();
  const [filter, setFilter] = useState<FindingFilter>(() => model.emptyFilter());
  const viewModel = model.buildViewModel(report, filter);

  return (
    <div>
      <Header onUpload={onUpload} onToggleLegend={() => setShowLegend(!showLegend)} />
      <main>
        {error && <div role="alert" style={{ color: '#E4572E', marginBottom: '1rem' }}>{error}</div>}
        <Hall hall={viewModel.hall} repoName={report.repo.name} />
        <Filters
          filter={filter}
          onChange={setFilter}
          years={viewModel.floors.map((floor) => floor.year)}
          matched={viewModel.findings.length}
        />
        <ViewTabs active={activeTab} onChange={setActiveTab} />
        {activeTab === 'manor' ? (
          <Manor model={viewModel} selectedFinding={selected} onSelectFinding={setSelected} />
        ) : (
          <Registry
            model={viewModel}
            sort={sort}
            onSortChange={setSort}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
        )}
        {selected && <FindingSheet finding={selected} onClose={() => setSelected(null)} />}
        <Legend open={showLegend} onClose={() => setShowLegend(false)} />
      </main>
    </div>
  );
}
