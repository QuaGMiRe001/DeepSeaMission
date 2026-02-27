export const Modes = {
  PORT: 'PORT',
  MAP: 'MAP',
  ENCOUNTER: 'ENCOUNTER',
  RESULTS: 'RESULTS'
};

export function createGameState(bootstrap) {
  const startPort = bootstrap.world.ports.find((p) => p.id === bootstrap.world.startPort) || bootstrap.world.ports[0];
  return {
    mode: Modes.PORT,
    dt: 0,
    elapsed: 0,
    money: bootstrap.save.money,
    upgradesOwned: bootstrap.save.upgradesOwned,
    currentPortId: startPort?.id || null,
    boat: {
      x: bootstrap.save.boat.mapX ?? startPort.x,
      y: bootstrap.save.boat.mapY ?? startPort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      heading: 0,
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
