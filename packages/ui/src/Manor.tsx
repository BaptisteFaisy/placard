import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Door, Finding, FootprintTrail, ManorViewModel } from '@placard/core';

import { FindingSheet } from './FindingSheet';
import { FallbackList } from './manor/FallbackList';
import { topFindings } from './manor/DoorNode';
import { MAX_RENDERED_DOORS, fallbackReason } from './manor/fallback';
import { layoutManor, type ManorLayout } from './manor/layout';
import { ManorScene } from './manor/ManorScene';
import { clampIndex, isManorKey, nextDoorIndex } from './manor/navigation';
import { REDUCED_MOTION_CLASS, usePrefersReducedMotion } from './a11y/usePrefersReducedMotion';

/**
 * Le manoir (PLA-F-14, PLA-F-15, PLA-F-21).
 *
 * Un étage par année, un couloir par étage, une porte par commit qui cache une
 * trouvaille. Le composant **ne calcule aucune donnée** : il reçoit un
 * `ManorViewModel` déjà construit par `@placard/manor-model` et le projette en
 * SVG.
 *
 * Accessibilité : Tab entre dans le manoir, les flèches parcourent les portes
 * (gauche/droite = le temps, haut/bas = les étages), Entrée ouvre la fiche,
 * Échap la ferme. Chaque porte porte `door.ariaLabel`. Aucun son.
 */

export interface ManorProps {
  model: ManorViewModel;
  /** Empreintes à tracer pour la trouvaille sélectionnée (PLA-F-17). */
  trail?: FootprintTrail | null;
  /** Trouvaille à afficher dans la fiche, si le parent en choisit une. */
  selectedFinding?: Finding | null;
  /** Sélection remontée au parent (porte ouverte, fiche fermée). */
  onSelectFinding?: (finding: Finding | null) => void;
  onOpenDoor?: (door: Door) => void;
  /** Seuil de bascule vers le repli lisible. */
  maxDoors?: number;
  /** Date de référence pour la fiche. */
  now?: Date;
}

interface CanvasProps {
  model: ManorViewModel;
  layout: ManorLayout;
  activeIndex: number;
  openedCommit?: string;
  trail: FootprintTrail | null;
  onOpen: (door: Door, index: number) => void;
  onActivate: (index: number) => void;
}

/** La scène SVG, avec le focus réel déplacé sur la porte active. */
function ManorCanvas(props: CanvasProps): React.ReactElement {
  const { layout, onActivate } = props;
  const refs = useRef(new Map<string, SVGGElement>());
  const registerRef = useCallback((commit: string, node: SVGGElement | null) => {
    if (node === null) refs.current.delete(commit);
    else refs.current.set(commit, node);
  }, []);

  const activate = useCallback(
    (index: number) => {
      onActivate(index);
      const commit = layout.order[index]?.door.commit;
      if (commit !== undefined) refs.current.get(commit)?.focus();
    },
    [layout, onActivate],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGGElement>, index: number) => {
      if (!isManorKey(event.key)) return;
      event.preventDefault();
      activate(nextDoorIndex(layout, index, event.key));
    },
    [layout, activate],
  );

  const active = layout.order[props.activeIndex];
  return (
    <ManorScene
      model={props.model}
      layout={layout}
      activeIndex={props.activeIndex}
      openedCommit={props.openedCommit}
      lantern={{ x: (active?.x ?? 0) + 32, y: (active?.y ?? 0) + 96 }}
      trail={props.trail}
      onOpen={props.onOpen}
      onActivate={props.onActivate}
      onKeyDown={onKeyDown}
      registerRef={registerRef}
    />
  );
}

/** Ferme la fiche à la touche Échap, où que soit le focus. */
function useEscape(active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);
}

/** Le manoir complet : scène (ou repli) et fiche de la trouvaille ouverte. */
export function Manor(props: ManorProps): React.ReactElement {
  const reduced = usePrefersReducedMotion();
  const limit = props.maxDoors ?? MAX_RENDERED_DOORS;
  const needed = fallbackReason(props.model, limit).needed;
  const layout = useMemo(() => (needed ? null : layoutManor(props.model)), [props.model, needed]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opened, setOpened] = useState<Door | null>(null);

  const open = useCallback(
    (door: Door, index: number) => {
      setActiveIndex(index);
      setOpened(door);
      props.onOpenDoor?.(door);
      const first = topFindings(door, 1)[0];
      if (first !== undefined) props.onSelectFinding?.(first);
    },
    [props],
  );

  useEffect(() => {
    setActiveIndex((current) => clampIndex(current, layout?.order.length ?? 0));
  }, [layout]);

  const close = useCallback(() => {
    setOpened(null);
    props.onSelectFinding?.(null);
  }, [props]);
  useEscape(opened !== null, close);

  const sheetFinding = props.selectedFinding ?? (opened === null ? null : (topFindings(opened, 1)[0] ?? null));
  const classes = `placard-manor${reduced ? ` ${REDUCED_MOTION_CLASS}` : ''}`;
  return (
    <section className={classes} aria-label="Haunted manor">
      {layout === null ? (
        <FallbackList model={props.model} limit={limit} />
      ) : (
        <ManorCanvas
          model={props.model}
          layout={layout}
          activeIndex={activeIndex}
          openedCommit={opened?.commit}
          trail={props.trail ?? null}
          onOpen={open}
          onActivate={setActiveIndex}
        />
      )}
      {sheetFinding === null ? null : <FindingSheet finding={sheetFinding} onClose={close} now={props.now} />}
    </section>
  );
}
