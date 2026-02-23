import { Modes } from '../core/state.js';
import { clamp, dist } from '../core/util.js';

const MAP_W = 1600;
const MAP_H = 1100;

export function updateMap(state, input, dt) {
  const thrust = 120;
  const drag = 0.93;
  const storm = 0.4 + Math.sin(state.elapsed * 0.2) * 0.35;

  if (input.down('KeyW') || input.down('ArrowUp')) state.boat.vy -= thrust * dt;
  if (input.down('KeyS') || input.down('ArrowDown')) state.boat.vy += thrust * dt;
  if (input.down('KeyA') || input.down('ArrowLeft')) state.boat.vx -= thrust * dt;
  if (input.down('KeyD') || input.down('ArrowRight')) state.boat.vx += thrust * dt;

  state.boat.vx += Math.sin(state.elapsed * 0.55) * storm * dt * 5;
  state.boat.vy += Math.cos(state.elapsed * 0.45) * storm * dt * 4;

  state.boat.vx *= drag;
  state.boat.vy *= drag;
  state.boat.x = clamp(state.boat.x + state.boat.vx, 20, MAP_W - 20);
  state.boat.y = clamp(state.boat.y + state.boat.vy, 20, MAP_H - 20);

  const moving = Math.abs(state.boat.vx) + Math.abs(state.boat.vy) > 0.05;
  if (moving) {
    state.boat.fuel = Math.max(0, state.boat.fuel - dt * 0.6 * (1 + storm * 0.25));
  }

  if (input.tap('Space')) {
    revealNearby(state, 260);
    state.sonarFlash = 0.45;
  }
  state.sonarFlash = Math.max(0, (state.sonarFlash || 0) - dt);

  const nearby = getNearbyAOI(state, 65);
  if (nearby && input.tap('KeyE')) {
    const contract = state.selectedContract?.aoiId === nearby.id
      ? state.selectedContract
      : state.contracts.find((c) => c.aoiId === nearby.id) || state.contracts[0];
    state.selectedContract = contract;
    state.encounter = createEncounterState(nearby, contract, state);
    state.mode = Modes.ENCOUNTER;
  }

  if (input.tap('KeyP')) {
    state.mode = Modes.PORT;
  }
}

function revealNearby(state, radius) {
  state.world.aois.forEach((aoi) => {
    if (dist(state.boat, aoi) < radius) {
      state.discoveredAOIs.add(aoi.id);
    }
  });
}

function getNearbyAOI(state, radius) {
  return state.world.aois.find((aoi) => dist(state.boat, aoi) < radius);
}

function createEncounterState(aoi, contract, state) {
  return {
    aoi,
    contract,
    diver: {
      x: 200,
      y: 90,
      vx: 0,
      vy: 0,
      o2: Math.round(100 * (state.upgradesOwned.includes('tank_1') ? 1.25 : 1)),
      maxDepth: Math.round(aoi.depth * 1.25),
      lampRange: Math.round((state.upgradesOwned.includes('lamp_1') ? 185 : 140) * contract.params.visibility),
      carrying: false,
      escorting: false
    },
    objectiveProgress: 0,
    objectiveIndex: 0,
    actionHint: '',
    done: false,
    failed: false,
    timer: 0,
    currentFactor: contract.params.current,
    siltiness: contract.params.siltiness,
    depthPressure: contract.params.depthPressure,
    objectiveNodes: buildObjectiveNodes(contract.type)
  };
}

function buildObjectiveNodes(type) {
  if (type === 'place_beacons') {
    return [
      { x: 660, y: 290, done: false },
      { x: 760, y: 410, done: false },
      { x: 860, y: 500, done: false }
    ];
  }
  if (type === 'rescue') {
    return [{ x: 820, y: 470, done: false }];
  }
  return [{ x: 770, y: 430, done: false }];
}

export function renderMap(ctx, state, w, h, assets) {
  ctx.fillStyle = '#0a3045';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < w; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  if (state.sonarFlash > 0) {
    ctx.strokeStyle = `rgba(128,220,255,${state.sonarFlash})`;
    ctx.beginPath();
    ctx.arc(state.boat.x * 0.6, state.boat.y * 0.45, 240 * (0.45 - state.sonarFlash + 0.1), 0, Math.PI * 2);
    ctx.stroke();
  }

  state.world.aois.forEach((aoi) => {
    const discovered = state.discoveredAOIs.has(aoi.id);
    ctx.beginPath();
    ctx.arc(aoi.x * 0.6, aoi.y * 0.45, discovered ? 16 : 10, 0, Math.PI * 2);
    ctx.fillStyle = discovered ? '#ffde87' : '#3d6f84';
    ctx.fill();
    if (discovered) {
      ctx.fillStyle = '#0c1f2a';
      ctx.font = '14px sans-serif';
      ctx.fillText(`${aoi.type} • ${aoi.depth}m`, aoi.x * 0.6 - 36, aoi.y * 0.45 + 4);
    }
  });

  const bx = state.boat.x * 0.6;
  const by = state.boat.y * 0.45;
  if (assets.boat) {
    ctx.drawImage(assets.boat, bx - 28, by - 16, 56, 28);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#d2efff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Map Mode - WASD move | SPACE sonar | E engage AOI | P port', 20, 28);
}
