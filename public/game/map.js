import { Modes } from '../core/state.js';
import { clamp, dist } from '../core/util.js';

const MAP_W = 1600;
const MAP_H = 1100;
const BOAT_SPRITE_FORWARD_OFFSET = Math.PI;

export function updateMap(state, input, dt) {
  const turnRate = 2.4;
  const thrustAccel = 95;
  const reverseAccel = 55;
  const drag = 0.96;
  const maxFwd = 180;
  const maxRev = -75;
  const storm = 0.45 + Math.sin(state.elapsed * 0.24) * 0.35;

  const turnLeft = input.down('KeyA') || input.down('ArrowLeft');
  const turnRight = input.down('KeyD') || input.down('ArrowRight');
  const forward = input.down('KeyW') || input.down('ArrowUp');
  const backward = input.down('KeyS') || input.down('ArrowDown');

  if (turnLeft) state.boat.heading -= turnRate * dt;
  if (turnRight) state.boat.heading += turnRate * dt;
  if (forward) state.boat.speed += thrustAccel * dt;
  if (backward) state.boat.speed -= reverseAccel * dt;

  state.boat.speed *= drag;
  state.boat.speed = clamp(state.boat.speed, maxRev, maxFwd);

  const driftX = Math.sin(state.elapsed * 0.6) * storm * 8;
  const driftY = Math.cos(state.elapsed * 0.5) * storm * 6;

  state.boat.vx = Math.cos(state.boat.heading) * state.boat.speed + driftX;
  state.boat.vy = Math.sin(state.boat.heading) * state.boat.speed + driftY;

  state.boat.x = clamp(state.boat.x + state.boat.vx * dt, 20, MAP_W - 20);
  state.boat.y = clamp(state.boat.y + state.boat.vy * dt, 20, MAP_H - 20);

  const speed = Math.abs(state.boat.speed);
  if (speed > 1) {
    state.boat.fuel = Math.max(0, state.boat.fuel - dt * 0.42 * (1 + storm * 0.3) * (1 + speed / 180));
  }

  if (input.tap('Space')) {
    revealNearby(state, 280);
    state.sonarFlash = 0.48;
  }
  state.sonarFlash = Math.max(0, (state.sonarFlash || 0) - dt);

  const nearbyPort = getNearbyPort(state, 80);
  const nearbyAoi = getNearbyAOI(state, 68);

  if (nearbyPort) {
    state.mapHint = `Press E to dock at ${nearbyPort.name}`;
    if (input.tap('KeyE')) {
      state.currentPortId = nearbyPort.id;
      state.mode = Modes.PORT;
      return;
    }
  } else if (nearbyAoi) {
    state.mapHint = `Press E to deploy at ${nearbyAoi.type} (${nearbyAoi.depth}m)`;
    if (input.tap('KeyE')) {
      const contract = state.selectedContract?.aoiId === nearbyAoi.id
        ? state.selectedContract
        : state.contracts.find((c) => c.aoiId === nearbyAoi.id) || state.contracts[0];
      state.selectedContract = contract;
      state.encounter = createEncounterState(nearbyAoi, contract, state);
      state.mode = Modes.ENCOUNTER;
      return;
    }
  } else {
    state.mapHint = 'Scan with SPACE, deploy at AOIs, dock at ports to cash out';
  }

  if (input.tap('KeyP')) {
    state.mapHint = 'Need to be near a port to dock (use E).';
  }
}

function revealNearby(state, radius) {
  state.world.aois.forEach((aoi) => {
    if (dist(state.boat, aoi) < radius) state.discoveredAOIs.add(aoi.id);
  });
}

function getNearbyAOI(state, radius) {
  return state.world.aois.find((aoi) => dist(state.boat, aoi) < radius);
}

function getNearbyPort(state, radius) {
  return state.world.ports.find((port) => dist(state.boat, port) < radius);
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
    valveSequence: ['KeyQ', 'KeyE', 'KeyQ'],
    valveStep: 0,
    currentFactor: contract.params.current,
    siltiness: contract.params.siltiness,
    depthPressure: contract.params.depthPressure,
    objectiveNodes: buildObjectiveNodes(contract.type)
  };
}

function buildObjectiveNodes(type) {
  if (type === 'place_beacons' || type === 'scan_sweep') {
    return [
      { x: 660, y: 290, done: false },
      { x: 760, y: 410, done: false },
      { x: 860, y: 500, done: false }
    ];
  }
  if (type === 'rescue') return [{ x: 820, y: 470, done: false }];
  return [{ x: 770, y: 430, done: false }];
}

function drawRotatedBoat(ctx, image, x, y, heading) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((heading || 0) + BOAT_SPRITE_FORWARD_OFFSET);
  ctx.drawImage(image, -28, -14, 56, 28);
  ctx.restore();
}

function drawWaterShader(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#155879');
  g.addColorStop(0.5, '#0a3852');
  g.addColorStop(1, '#08293e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(130,220,255,0.10)';
  ctx.lineWidth = 1.5;
  for (let y = 20; y < h; y += 38) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 26) {
      const yy = y + Math.sin((x * 0.03) + (t * 1.8) + y * 0.02) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

export function renderMap(ctx, state, w, h, assets) {
  drawWaterShader(ctx, w, h, state.elapsed);

  state.world.ports.forEach((port) => {
    const x = port.x * 0.6;
    const y = port.y * 0.45;
    ctx.fillStyle = '#ffd7a3';
    ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.fillStyle = '#243645';
    ctx.font = '12px sans-serif';
    ctx.fillText(port.name, x - 30, y - 18);
  });

  if (state.sonarFlash > 0) {
    ctx.strokeStyle = `rgba(128,220,255,${state.sonarFlash})`;
    ctx.lineWidth = 2;
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
  if (assets.boat) drawRotatedBoat(ctx, assets.boat, bx, by, state.boat.heading || 0);

  ctx.fillStyle = '#d2efff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Map - W/S throttle, A/D steer | SPACE sonar | E deploy/dock', 20, 28);
  ctx.fillText(state.mapHint || '', 20, 50);
}
