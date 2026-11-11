import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Harnais de rendu des tests de `@placard/ui`.
 *
 * `@testing-library/react` 16 est résolu ici sur React 19 par le lockfile du
 * monorepo, alors que le paquet épingle React 18.3.1 : deux copies de React
 * cohabitent et `render()` jette. On monte donc avec `react-dom/client` du
 * paquet (18.3.1) et `act` de React, sans toucher aux configurations racine.
 * Les requêtes viennent de `@testing-library/dom`, qui est agnostique du moteur.
 */

/** Active le mode « act » attendu par React 18 en environnement de test. */
function enableActEnvironment(): void {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

export interface Mounted {
  container: HTMLElement;
  root: Root;
}

/** Monte un élément React dans un conteneur neuf attaché au document. */
export function mount(ui: React.ReactElement): Mounted {
  enableActEnvironment();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

/** Laisse React traiter les mises à jour en attente. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Démonte et nettoie le conteneur. */
export function cleanup(mounted: Mounted): void {
  act(() => {
    mounted.root.unmount();
  });
  mounted.container.remove();
}

/** Déclenche un événement DOM dans un cycle `act`. */
export async function fire(element: Element, event: Event): Promise<void> {
  await act(async () => {
    element.dispatchEvent(event);
  });
}

/** Raccourci : clavier sur un élément. */
export async function press(element: Element, key: string): Promise<void> {
  await fire(element, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** Raccourci : clic sur un élément. */
export async function click(element: Element): Promise<void> {
  await fire(element, new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Raccourci : saisie dans un champ contrôlé (React écoute `input`). */
export async function type(element: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
