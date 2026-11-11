import { useEffect, useState } from 'react';

/**
 * `prefers-reduced-motion` (steering `art-direction.md`).
 *
 * Toutes les transitions du manoir sont coupées quand l'utilisateur le demande.
 * Le hook est défensif : sans `matchMedia` (jsdom, SSR), il renvoie `false` et
 * le rendu reste utilisable — aucune animation n'est alors indispensable.
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Lit la préférence courante, sans jamais jeter. */
export function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : undefined;
  return query?.matches ?? false;
}

/** Classe ajoutée au conteneur quand le mouvement est réduit. */
export const REDUCED_MOTION_CLASS = 'placard--reduced-motion';

/** Hook React : suit la préférence et se met à jour si elle change. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (): void => setReduced(query.matches);
    setReduced(query.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  return reduced;
}
