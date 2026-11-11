import React from 'react';

/**
 * Étape 4 — vérification et certificat (PLA-F-27, PLA-F-28).
 *
 * Une trouvaille n'est scellée que si une **nouvelle analyse** ne la retrouve
 * plus : le scellement est une conséquence du scan, jamais une déclaration.
 * Le certificat (`PLACARD.md` + badge) ne contient aucun secret.
 */
export interface VerifyStepProps {
  onVerify: () => void;
  onCertificate: () => void;
  /** Résultat de la dernière vérification, s'il y en a une. */
  verification?: { verifiedAt: string; stillFound: boolean; reportPath: string } | null;
  /** Chemin du certificat produit, s'il existe. */
  certificatePath?: string | null;
}

/** Résultat de vérification, en clair : encore trouvé, ou plus trouvé. */
function VerificationResult({
  verification,
}: {
  verification: { verifiedAt: string; stillFound: boolean; reportPath: string };
}): React.ReactElement {
  const suffix = verification.stillFound ? ' placard-verify__result--found' : '';
  return (
    <p className={`placard-verify__result${suffix}`}>
      {verification.stillFound
        ? 'Still found by the latest scan: the finding stays open.'
        : 'No longer found by the latest scan: the finding can be sealed.'}{' '}
      <span className="placard-verify__meta">
        ({verification.verifiedAt}, report <code>{verification.reportPath}</code>)
      </span>
    </p>
  );
}

/** Étape de vérification complète : re-scan, résultat, certificat. */
export function VerifyStep({
  onVerify,
  onCertificate,
  verification,
  certificatePath,
}: VerifyStepProps): React.ReactElement {
  return (
    <div className="placard-verify">
      <button type="button" onClick={onVerify}>
        Verify with a fresh scan
      </button>
      {verification === null || verification === undefined ? null : (
        <VerificationResult verification={verification} />
      )}
      <button type="button" onClick={onCertificate}>
        Write the certificate
      </button>
      {certificatePath === null || certificatePath === undefined ? null : (
        <p className="placard-verify__certificate">
          Certificate written to <code>{certificatePath}</code> — no secret inside.
        </p>
      )}
    </div>
  );
}
