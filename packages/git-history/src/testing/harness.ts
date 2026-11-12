import { afterEach, beforeAll } from 'vitest';

import { destroyFixture, isolateGitEnvironment, type Fixture } from './fixture';

/**
 * Cycle de vie commun aux suites qui créent de vrais dépôts Git.
 *
 * Isole Git de toute configuration utilisateur avant la suite, puis détruit les
 * dépôts temporaires après chaque test — y compris quand un test échoue.
 * Renvoie une fonction d'enregistrement : `const track = useGitFixtures()`.
 */
export function useGitFixtures(): (fixture: Fixture) => Fixture {
  const fixtures: Fixture[] = [];
  beforeAll(() => {
    isolateGitEnvironment();
  });
  afterEach(() => {
    while (fixtures.length > 0) {
      const fixture = fixtures.pop();
      if (fixture !== undefined) destroyFixture(fixture);
    }
  });
  return (fixture: Fixture): Fixture => {
    fixtures.push(fixture);
    return fixture;
  };
}
