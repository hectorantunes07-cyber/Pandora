import { expect, it } from 'vitest';
import { findInstalledGame, GAME_GUIDES } from '../shared/game-guides';
it('recognizes verified launcher identities without claiming a future GTA VI profile', () => {
  const game = { id: 'steam:1172470', name: 'Apex Legends™', installed: true, path: 'verified install' };
  expect(findInstalledGame('apex', [game])).toBe(game);
  expect(findInstalledGame('gta5', [game])).toBeUndefined();
  expect(findInstalledGame('gta6', [{ ...game, name: 'Grand Theft Auto VI' }])).toBeUndefined();
  expect(findInstalledGame('apex', [{ ...game, installed: false }])).toBeUndefined();
  expect(GAME_GUIDES).toHaveLength(6);
});
