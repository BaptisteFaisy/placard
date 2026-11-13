import React from 'react';
import type { SeverityLevel } from '@placard/core';

import {
  illustrationOpacity,
  illustrationTransform,
  severityColor,
  type IllustrationProps,
} from './scale';

/**
 * La porte du manoir (C.4) : un commit qui contient au moins une trouvaille.
 *
 * Quatre états, tous doublés d'un texte par le parent (PLA-N-05) :
 * - `normal`  : porte close, lueur discrète ;
 * - `alert`   : porte entrouverte, lueur vive = gravité maximale derrière ;
 * - `sealed`  : sceau de cire rouge = rotation faite et purge validée ;
 * - `ribbon`  : ruban noué = faux positif écarté avec raison motivée.
 */
export type DoorIllustrationState = 'normal' | 'alert' | 'sealed' | 'ribbon';

export interface DoorIllustrationProps extends IllustrationProps {
  state?: DoorIllustrationState;
}

/** Lueur sous la porte : la gravité maximale cachée derrière. */
function Glow({ severity, strong }: { severity: SeverityLevel | 'none'; strong: boolean }): React.ReactElement {
  return (
    <g className="placard-glow">
      <rect x="6" y="62" width="52" height={strong ? 6 : 3} rx="2" fill={severityColor(severity)} />
      {strong ? <rect x="16" y="70" width="32" height="2" rx="1" fill={severityColor(severity)} /> : null}
    </g>
  );
}

/** Sceau de cire : trouvaille traitée. */
function WaxSeal(): React.ReactElement {
  return (
    <g className="placard-door__seal">
      <circle cx="47" cy="34" r="7" fill="#B23A48" stroke="#EDE6D6" strokeWidth="1" />
      <circle cx="47" cy="34" r="2.4" fill="none" stroke="#EDE6D6" strokeWidth="1" />
    </g>
  );
}

/** Ruban noué : faux positif écarté. */
function RibbonKnot(): React.ReactElement {
  return (
    <g className="placard-door__ribbon">
      <path d="M32 40 L22 32 L22 24 L32 32 Z" fill="#7C6DB8" />
      <path d="M32 40 L42 32 L42 24 L32 32 Z" fill="#7C6DB8" />
      <path d="M32 40 L28 54 M32 40 L36 54" stroke="#7C6DB8" strokeWidth="2" fill="none" />
      <circle cx="32" cy="36" r="3.2" fill="#EDE6D6" stroke="#7C6DB8" strokeWidth="1" />
    </g>
  );
}

/** Battant entrouvert : la porte n'est plus tout à fait close. */
function AjarPanel(): React.ReactElement {
  return (
    <g className="placard-door__ajar">
      <path d="M22 62 V30 L44 24 V62 Z" fill="#14101F" stroke="#EDE6D6" strokeWidth="1.2" />
      <circle cx="40" cy="45" r="1.6" fill="#EDE6D6" />
    </g>
  );
}

/** Dessin d'une porte : cadre, battant, poignée, puis l'état demandé. */
export function DoorIllustration({
  state = 'normal',
  ...props
}: DoorIllustrationProps): React.ReactElement {
  const severity = props.severity ?? 'low';
  return (
    <g
      className={`placard-door placard-door--${state}${props.className === undefined ? '' : ` ${props.className}`}`}
      transform={illustrationTransform(props)}
      opacity={illustrationOpacity(props)}
    >
      <path
        className="placard-door__frame"
        d="M6 62 V28 Q6 6 32 6 Q58 6 58 28 V62 Z"
        fill="#2A2140"
        stroke="#EDE6D6"
        strokeWidth="1.4"
      />
      <path d="M12 62 V30 Q12 13 32 13 Q52 13 52 30 V62 Z" fill="#14101F" stroke="#2A2140" strokeWidth="1" />
      <path d="M20 62 V22 M44 62 V22" stroke="#2A2140" strokeWidth="1" />
      <circle cx="46" cy="42" r="2" fill="#EDE6D6" />
      {state === 'alert' ? <AjarPanel /> : null}
      {state === 'sealed' ? <WaxSeal /> : null}
      {state === 'ribbon' ? <RibbonKnot /> : null}
      <Glow severity={severity} strong={state === 'alert'} />
    </g>
  );
}
