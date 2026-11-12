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

export { SeverityMark, colorOf, glyphOf, labelOf } from './a11y/SeverityMark';
export type { SeverityMarkProps } from './a11y/SeverityMark';
export {
  REDUCED_MOTION_CLASS,
  REDUCED_MOTION_QUERY,
  readPrefersReducedMotion,
  usePrefersReducedMotion,
} from './a11y/usePrefersReducedMotion';

export { Filters, FILTER_STATES, headChoiceOf, toggle, withHeadChoice } from './Filters';
export type { FiltersProps, HeadChoice } from './Filters';

export { FindingSheet } from './FindingSheet';
export type { FindingSheetProps } from './FindingSheet';

export { Footprints, footPoint, trailPath, trailPoints } from './Footprints';
export type { FootprintsProps } from './Footprints';
export { FootprintSheet, floorsSpanned, trailSummary } from './FootprintSheet';
export type { FootprintSheetProps } from './FootprintSheet';

export { Hall, skeletonVocabulary } from './Hall';
export type { HallProps } from './Hall';

export { COSTUME_LEGEND, Legend, LegendToggle } from './Legend';
export type { LegendEntry, LegendProps, LegendToggleProps } from './Legend';

export { Manor } from './Manor';
export type { ManorProps } from './Manor';

export { Registry, SORT_LABELS, ariaSortFor } from './Registry';
export type { RegistryProps } from './Registry';

export { RitualPanel, stepOf } from './RitualPanel';
export type { RitualPanelProps, RitualVerification } from './RitualPanel';

export { isStillAlive, lastRemoval, lifetimeDaysOf } from './sheet-data';

export * from './illustrations/index';
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
} from './manor/layout';
export type { DoorSlot, FloorLayout, ManorLayout, WallSlot } from './manor/layout';
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
} from './manor/navigation';
export type { ManorKey } from './manor/navigation';
export {
  fallbackReason,
  floorPositionLabel,
  MAX_RENDERED_DOORS,
  planFor,
  summarizeFloors,
} from './manor/fallback';
export type { FloorSummaryLine, ManorFallbackReason } from './manor/fallback';
export { doorStateOf, MAX_SKELETONS_PER_DOOR, topFindings } from './manor/DoorNode';
export type { DoorNodeProps } from './manor/DoorNode';
export type { WallNodeProps } from './manor/WallNode';
export type { FloorRowProps } from './manor/FloorRow';
export type { ManorSceneProps } from './manor/ManorScene';
export type { FallbackListProps } from './manor/FallbackList';
export { isLocked, stepStatus, stepStatusLabel } from './ritual/StepHeader';
export type { StepHeaderProps } from './ritual/StepHeader';
export type { RotationStepProps } from './ritual/RotationStep';
export type { PurgeStepProps } from './ritual/PurgeStep';
export type { PreventionStepProps } from './ritual/PreventionStep';
export type { VerifyStepProps } from './ritual/VerifyStep';
