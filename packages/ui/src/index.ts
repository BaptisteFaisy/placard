// @placard/ui — composants React du manoir, du registre et du rituel.
//
// Tous les composants sont **purement pilotés par props** : aucun accès réseau,
// aucun état global, aucune lecture de fichier. Les données viennent de
// `@placard/manor-model` et `@placard/ritual`, la vérité métier reste dehors.
//
// Le thème est un fichier CSS à part (`./theme.css`) : il est importé ici pour
// que toute application qui consomme ce paquet embarque **ses** styles sans
// avoir à connaître le chemin du fichier. Vitest et Node ignorent l'import
// CSS (le paquet reste utilisable hors navigateur).

import './theme.css';

export { SeverityMark, colorOf, glyphOf, labelOf } from './a11y/SeverityMark.js';
export type { SeverityMarkProps } from './a11y/SeverityMark.js';
export {
  REDUCED_MOTION_CLASS,
  REDUCED_MOTION_QUERY,
  readPrefersReducedMotion,
  usePrefersReducedMotion,
} from './a11y/usePrefersReducedMotion.js';

export { Filters, FILTER_STATES, headChoiceOf, toggle, withHeadChoice } from './Filters.js';
export type { FiltersProps, HeadChoice } from './Filters.js';

export { FindingSheet } from './FindingSheet.js';
export type { FindingSheetProps } from './FindingSheet.js';

export { Footprints, footPoint, trailPath, trailPoints } from './Footprints.js';
export type { FootprintsProps } from './Footprints.js';
export { FootprintSheet, floorsSpanned, trailSummary } from './FootprintSheet.js';
export type { FootprintSheetProps } from './FootprintSheet.js';

export { Hall, skeletonVocabulary } from './Hall.js';
export type { HallProps } from './Hall.js';

export { COSTUME_LEGEND, Legend, LegendToggle } from './Legend.js';
export type { LegendEntry, LegendProps, LegendToggleProps } from './Legend.js';

export { Manor } from './Manor.js';
export type { ManorProps } from './Manor.js';

export { Registry, SORT_LABELS, ariaSortFor } from './Registry.js';
export type { RegistryProps } from './Registry.js';

export { RitualPanel, stepOf } from './RitualPanel.js';
export type { RitualPanelProps, RitualVerification } from './RitualPanel.js';

export { isStillAlive, lastRemoval, lifetimeDaysOf } from './sheet-data.js';

export * from './illustrations/index.js';
export {
  CORRIDOR_START,
  DOOR_WIDTH,
  FLOOR_BASELINE,
  FLOOR_HEIGHT,
  itemWidth,
  layoutManor,
  STAIR_WIDTH,
  WALL_MAX,
  WALL_MIN,
  WALL_UNIT,
} from './manor/layout.js';
export type { DoorSlot, FloorLayout, ManorLayout, WallSlot } from './manor/layout.js';
export {
  clampIndex,
  doorAtIndex,
  hasRibbon,
  hasSeal,
  indexOfCommit,
  isManorKey,
  MANOR_KEYS,
  nextDoorIndex,
  trailDoors,
} from './manor/navigation.js';
export type { ManorKey } from './manor/navigation.js';
export {
  fallbackReason,
  floorPositionLabel,
  MAX_RENDERED_DOORS,
  planFor,
  summarizeFloors,
} from './manor/fallback.js';
export type { FloorSummaryLine, ManorFallbackReason } from './manor/fallback.js';
export { doorStateOf, MAX_SKELETONS_PER_DOOR, topFindings } from './manor/DoorNode.js';
export type { DoorNodeProps } from './manor/DoorNode.js';
export type { WallNodeProps } from './manor/WallNode.js';
export type { FloorRowProps } from './manor/FloorRow.js';
export type { ManorSceneProps } from './manor/ManorScene.js';
export type { FallbackListProps } from './manor/FallbackList.js';
export { isLocked, stepStatus, stepStatusLabel } from './ritual/StepHeader.js';
export type { StepHeaderProps } from './ritual/StepHeader.js';
export type { RotationStepProps } from './ritual/RotationStep.js';
export type { PurgeStepProps } from './ritual/PurgeStep.js';
export type { PreventionStepProps } from './ritual/PreventionStep.js';
export type { VerifyStepProps } from './ritual/VerifyStep.js';
