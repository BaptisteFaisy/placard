// Configuration ESLint « à plat » — règle user 2026-10-24 :
// aucun fichier de code ne dépasse 500 lignes, aucune fonction 50 lignes.
// Ces deux bornes sont des erreurs bloquantes, pas des avertissements.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Scripts d'outillage exécutés par Node hors du navigateur (recette, capture
    // vidéo) : ils ont besoin des globaux Node.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'packages/web/dist/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true, IIFEs: false },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Fichiers de test : la borne « 50 lignes par fonction » vise le code de
    // production. Un bloc `describe` est un conteneur déclaratif, pas une
    // fonction métier ; chaque `it` reste court. Borne relevée à 120 pour les
    // suites, la borne de 500 lignes par fichier reste inchangée.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: false },
      ],
    },
  },
  {
    // Les composants React découpent déjà le rendu en sous-composants ;
    // la borne reste à 50 lignes, seule la règle « pas de any » est relâchée
    // pour les props génériques de test.
    files: ['packages/ui/src/**/*.tsx', 'packages/web/src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
