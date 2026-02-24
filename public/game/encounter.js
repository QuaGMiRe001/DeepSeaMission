import { Modes } from '../core/state.js';
import { clamp } from '../core/util.js';

const BOAT_POINT = { x: 200, y: 90 };
const WATERLINE_Y = 80;

export function updateEncounter(state, input, dt) {
  const encounter = state.encounter;
  const diver = encounter.diver;
  encounter.timer += dt;

  const accel = 140;
  const drag = 0.9;
  const currentX = Math.sin(state.elapsed * 0.9 + encounter.timer * 0.2) * encounter.currentFactor * 10;

  if (input.down('KeyW') || input.down('ArrowUp')) diver.vy -= accel * dt;
  if (input.down('KeyS') || input.down('ArrowDown')) diver.vy += accel * dt;
  if (input.down('KeyA') || input.down('ArrowLeft')) diver.vx -= accel * dt;
  if (input.down('KeyD') || input.down('ArrowRight')) diver.vx += accel * dt;

  diver.vx += currentX * dt;
  diver.vx *= drag;
  diver.vy *= drag;

  diver.x = clamp(diver.x + diver.vx, 40, 980);
  diver.y = clamp(diver.y + diver.vy, WATERLINE_Y, 540);
  diver.o2 = Math.max(0, diver.o2 - dt * 2.3);

  const depthMeters = Math.max(0, Math.round((diver.y - WATERLINE_Y) / 4));
  if (depthMeters > diver.maxDepth) {
    diver.o2 = Math.max(0, diver.o2 - dt * 5 * encounter.depthPressure);
  }

  updateObjectiveProgress(encounter, input, dt);

  const atBoat = nearPoint(diver, BOAT_POINT, 55);
  const objectivesDone = encounter.objectiveIndex >= encounter.contract.objectives.length;
  if (atBoat && objectivesDone && input.tap('KeyE')) {
    completeEncounter(state, encounter);
    return;
  }

  if (diver.o2 <= 0) {
    encounter.failed = true;
    state.lastResult = { success: false, pay: -60, title: encounter.contract.title };
    state.money = Math.max(0, state.money - 60);
    state.mode = Modes.RESULTS;
  }
}

function completeEncounter(state, encounter) {
  encounter.done = true;
  state.lastResult = { success: true, pay: encounter.contract.pay, title: encounter.contract.title };
  state.money += encounter.contract.pay;
  state.mode = Modes.RESULTS;
}

function updateObjectiveProgress(encounter, input, dt) {
  const diver = encounter.diver;
  const objectives = encounter.contract.objectives;
  const currentObjective = objectives[encounter.objectiveIndex];
  const nearBoat = nearPoint(diver, BOAT_POINT, 55);

  if (!currentObjective) {
    encounter.actionHint = nearBoat
      ? 'Mission complete. Press E to extract.'
      : 'Return to boat at surface then press E to extract.';
    return;
  }

  encounter.actionHint = `Objective: ${currentObjective.label}`;

  const activeNode = encounter.objectiveNodes.find((node) => !node.done) || encounter.objectiveNodes[encounter.objectiveNodes.length - 1];
  const nearNode = nearPoint(diver, activeNode, 45);

  switch (encounter.contract.type) {
    case 'place_beacons':
      if (nearNode && input.down('KeyF')) {
        encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 0.9, 0, 1);
      }
      if (encounter.objectiveProgress >= 1) {
        activeNode.done = true;
        encounter.objectiveProgress = 0;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      }
      break;
    case 'fetch':
      if (!diver.carrying && nearNode && input.tap('KeyF')) {
        diver.carrying = true;
        activeNode.done = true;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      } else if (diver.carrying && nearBoat && (input.tap('KeyF') || input.tap('KeyE'))) {
        diver.carrying = false;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      }
      break;
    case 'rescue':
      if (!diver.escorting && nearNode && input.down('KeyF')) {
        encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 0.5, 0, 1);
      }
      if (!diver.escorting && encounter.objectiveProgress >= 1) {
        diver.escorting = true;
        activeNode.done = true;
        encounter.objectiveProgress = 0;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      } else if (diver.escorting && nearBoat && (input.tap('KeyF') || input.tap('KeyE'))) {
        diver.escorting = false;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      }
      break;
    default:
      if (nearNode && input.down('KeyF')) {
        encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 0.45, 0, 1);
      }
      if (encounter.objectiveProgress >= 1) {
        activeNode.done = true;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveProgress = 0;
        encounter.objectiveIndex += 1;
      }
      break;
  }
}

function nearPoint(a, b, radius) {
  return Math.hypot(a.x - b.x, a.y - b.y) < radius;
}

function objectiveImage(assets, contractType) {
  if (contractType === 'fetch') return assets.cargo;
  if (contractType === 'rescue') return assets.rescue;
  return assets.beacon;
}

export function renderEncounter(ctx, state, w, h, assets) {
  const encounter = state.encounter;
  const diver = encounter.diver;

  ctx.fillStyle = '#9fd5ef';
  ctx.fillRect(0, 0, w, WATERLINE_Y);

  const bob = Math.sin(state.elapsed * 2.2) * 3;
  if (assets.boat) {
    ctx.drawImage(assets.boat, 130, 22 + bob, 120, 56);
  }

  ctx.strokeStyle = '#d6f2ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 24) {
    const y = WATERLINE_Y + Math.sin((x + state.elapsed * 120) * 0.03) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#0e2d3e';
  ctx.fillRect(0, WATERLINE_Y, w, h - WATERLINE_Y);

  const particles = 40;
  for (let i = 0; i < particles; i += 1) {
    const px = (i * 173 + Math.floor(state.elapsed * 30)) % w;
    const py = WATERLINE_Y + 15 + ((i * 89 + Math.floor(state.elapsed * 18 * encounter.siltiness)) % (h - WATERLINE_Y - 20));
    ctx.fillStyle = `rgba(190,220,235,${0.07 * encounter.siltiness})`;
    ctx.fillRect(px, py, 2, 2);
  }

  const gradient = ctx.createRadialGradient(diver.x, diver.y, 10, diver.x, diver.y, diver.lampRange);
  gradient.addColorStop(0, 'rgba(170, 225, 255, 0.30)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, WATERLINE_Y, w, h - WATERLINE_Y);

  const icon = objectiveImage(assets, encounter.contract.type);
  encounter.objectiveNodes.forEach((node) => {
    if (node.done) {
      ctx.fillStyle = '#6ec48d';
      ctx.fillRect(node.x - 8, node.y - 8, 16, 16);
      return;
    }

    if (icon) {
      ctx.drawImage(icon, node.x - 14, node.y - 14, 28, 28);
    } else {
      ctx.fillStyle = '#7fb7cf';
      ctx.fillRect(node.x - 10, node.y - 10, 20, 20);
    }
  });

  if (assets.diver) {
    ctx.drawImage(assets.diver, diver.x - 14, diver.y - 14, 28, 28);
  }

  ctx.fillStyle = '#d4ecff';
  ctx.font = '16px sans-serif';
  const depthMeters = Math.max(0, Math.round((diver.y - WATERLINE_Y) / 4));
  ctx.fillText('Encounter - hold F to interact | E can also dock/extract at boat', 20, 28);
  ctx.fillText(`O2: ${Math.round(diver.o2)}  Depth: ${depthMeters}m/${diver.maxDepth}m`, 20, 52);
  ctx.fillText(encounter.actionHint, 20, 74);

  renderObjectiveList(ctx, encounter.contract.objectives, encounter.objectiveIndex);
}

function renderObjectiveList(ctx, objectives, index) {
  ctx.font = '14px sans-serif';
  objectives.forEach((objective, i) => {
    ctx.fillStyle = objective.done ? '#87d19b' : i === index ? '#ffde87' : '#b7d8e8';
    ctx.fillText(`${objective.done ? '✓' : i === index ? '→' : '•'} ${objective.label}`, 680, 28 + i * 20);
  });
}
