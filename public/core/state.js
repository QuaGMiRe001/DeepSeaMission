export const Modes = {
  PORT: 'PORT',
  MAP: 'MAP',
  ENCOUNTER: 'ENCOUNTER',
  RESULTS: 'RESULTS'
};

export function createGameState(bootstrap) {
  return {
    mode: Modes.PORT,
    dt: 0,
    elapsed: 0,
    money: bootstrap.save.money,
    upgradesOwned: bootstrap.save.upgradesOwned,
    boat: {
      x: bootstrap.save.boat.mapX,
      y: bootstrap.save.boat.mapY,
      vx: 0,
      vy: 0,
      fuel: bootstrap.save.boat.fuel,
      hull: bootstrap.save.boat.hull
    },
    world: bootstrap.world,
    contracts: bootstrap.contracts,
    selectedContract: null,
    encounter: null,
    lastResult: null,
    discoveredAOIs: new Set(bootstrap.save.discoveredAOIs)
  };
}
