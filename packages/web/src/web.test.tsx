import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { App } from './App';

describe('@placard/web demo application', () => {
  it('monte le manoir avec le rapport de démonstration embarqué sans aucun appel réseau', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    expect(screen.getByText(/Placard — Skeletons in the Closet/i)).toBeTruthy();
    expect(screen.getByText(/Haunted Manor View/i)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    cleanup();
  });

  it('bascule vers la vue Registre accessible et ouvre la légende du costume', () => {
    render(<App />);
    const registryTab = screen.getByRole('button', { name: /Registry Table View/i });
    fireEvent.click(registryTab);
    expect(screen.getByRole('table')).toBeTruthy();

    const legendBtn = screen.getByRole('button', { name: /Costume Legend/i });
    fireEvent.click(legendBtn);
    expect(screen.getByRole('dialog')).toBeTruthy();
    cleanup();
  });
});

describe('le rapport de démonstration embarqué produit un vrai manoir', () => {
  it('affiche plusieurs étages et plusieurs portes, pas une page vide', () => {
    const { container } = render(<App />);
    const floors = container.querySelectorAll('[data-year]');
    expect(floors.length).toBeGreaterThanOrEqual(3);
    const scene = container.querySelector('[data-doors]');
    expect(scene).toBeTruthy();
    expect(Number(scene?.getAttribute('data-doors'))).toBeGreaterThanOrEqual(5);
    expect(scene?.getAttribute('aria-label')).toMatch(/Haunted manor: \d+ floors/);
    cleanup();
  });
});
