import { Modes } from '../core/state.js';
import { clamp } from '../core/util.js';

const BOAT_POINT = { x: 200, y: 90 };
const WATERLINE_Y = 80;

function approach(current, target, factor) {
  return current + (target - current) * factor;
}

function nearPoint(a, b, radius) {
  return Math.hypot(a.x - b.x, a.y - b.y) < radius;
}

function insideZone(point, zone) {
  return Math.hypot(point.x - zone.x, point.y - zone.y) <= zone.r;
}

export function updateEncounter(state, input, dt) {
  const encounter = state.encounter;
  const diver = encounter.diver;
  encounter.timer += dt;

  if (input.tap('Equal')) encounter.targetZoom = clamp(encounter.targetZoom + 0.12, 0.85, 1.5);
  if (input.tap('Minus')) encounter.targetZoom = clamp(encounter.targetZoom - 0.12, 0.85, 1.5);
  encounter.cameraZoom = approach(encounter.cameraZoom, encounter.targetZoom, 0.2);

  maybeToggleCave(encounter, diver, input);

  const moveAccel = 250;
  const waterFriction = 0.26;
  const maxSpeed = 180;
  const currentX = Math.sin(state.elapsed * 0.9 + encounter.timer * 0.2) * encounter.currentFactor * 3.8;

  const axisX = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  const axisY = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);

  const targetVX = axisX * moveAccel;
  const targetVY = axisY * moveAccel;

  diver.vx = approach(diver.vx, targetVX, waterFriction) + currentX;
  diver.vy = approach(diver.vy, targetVY, waterFriction);
  diver.vx = clamp(diver.vx, -maxSpeed, maxSpeed);
  diver.vy = clamp(diver.vy, -maxSpeed, maxSpeed);

  diver.x = clamp(diver.x + diver.vx * dt, 40, 980);
  diver.y = clamp(diver.y + diver.vy * dt, WATERLINE_Y, 540);

  // TEMP: mission timer/fail pressure disabled for playtesting iteration.
  // Keep meter value for UI continuity, but no drain or fail condition.
  if (encounter.hasDiveBell && nearPoint(diver, encounter.diveBell, 52)) {
    diver.o2 = Math.min(130, diver.o2 + dt * 8);
  }

  updateObjectiveProgress(encounter, input, dt);

  const atBoat = nearPoint(diver, BOAT_POINT, 55);
  const objectivesDone = encounter.objectiveIndex >= encounter.contract.objectives.length;
  if (atBoat && objectivesDone && input.tap('KeyE')) {
    completeEncounter(state, encounter);
  }
}

function maybeToggleCave(encounter, diver, input) {
  const interactTap = input.tap('KeyE') || input.tap('KeyF');
  if (!encounter.caveEntrances.length || !interactTap) return;

  if (encounter.currentCaveIndex !== null) {
    const exit = encounter.caveEntrances[encounter.currentCaveIndex];
    diver.x = exit.x + 6;
    diver.y = exit.y + 6;
    encounter.currentCaveIndex = null;
    return;
  }

  const entryIndex = encounter.caveEntrances.findIndex((entry) => nearPoint(diver, entry, 52));
  if (entryIndex >= 0) {
    const targetZone = encounter.caveZones[entryIndex];
    diver.x = targetZone.x;
    diver.y = targetZone.y;
    encounter.currentCaveIndex = entryIndex;
  }
}

function getNearbyCaveEntrance(encounter, diver) {
  if (!encounter.caveEntrances.length || encounter.interior?.active) return null;
  return encounter.caveEntrances.find((entry) => nearPoint(diver, entry, 56)) || null;
}

function updateObjectiveProgress(encounter, input, dt) {
  const diver = encounter.diver;
  const objectives = encounter.contract.objectives;
  const currentObjective = objectives[encounter.objectiveIndex];
  const nearBoat = nearPoint(diver, BOAT_POINT, 55);
  const nearbyEntrance = getNearbyCaveEntrance(encounter, diver);

  if (!currentObjective) {
    encounter.actionHint = nearBoat
      ? 'Mission complete. Press E to extract.'
      : 'Return to boat at surface then press E to extract.';
    if (nearbyEntrance) encounter.actionHint += ' | Cave nearby: press E/F to enter.';
    return;
  }

  const activeNode = encounter.objectiveNodes.find((node) => !node.done) || encounter.objectiveNodes[encounter.objectiveNodes.length - 1];
  const nearNode = nearPoint(diver, activeNode, 45);

  switch (encounter.contract.type) {
    case 'place_beacons':
      encounter.actionHint = `Place beacon (${Math.round(encounter.objectiveProgress * 100)}%)`;
      if (nearNode && input.down('KeyF')) encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 1.0, 0, 1);
      if (encounter.objectiveProgress >= 1) completeStep(encounter, activeNode, objectives);
      break;

    case 'scan_sweep':
      encounter.actionHint = `Hold F to scan site (${Math.round(encounter.objectiveProgress * 100)}%)`;
      if (nearNode && input.down('KeyF')) encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 1.25, 0, 1);
      if (encounter.objectiveProgress >= 1) completeStep(encounter, activeNode, objectives);
      break;

    case 'fetch':
      encounter.actionHint = diver.carrying ? 'Return cargo to boat (E or F)' : 'Pick up cargo (tap F)';
      if (!diver.carrying && nearNode && input.tap('KeyF')) {
        diver.carrying = true;
        completeStep(encounter, activeNode, objectives);
      } else if (diver.carrying && nearBoat && (input.tap('KeyF') || input.tap('KeyE'))) {
        diver.carrying = false;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      }
      break;

    case 'repair': {
      encounter.repairWindow = (Math.sin(encounter.timer * 5) + 1) / 2;
      encounter.actionHint = `Repair timing: hit F in green zone (success ${encounter.repairHits}/3)`;
      if (nearNode && input.tap('KeyF')) {
        if (encounter.repairWindow > 0.38 && encounter.repairWindow < 0.62) encounter.repairHits += 1;
        else encounter.repairHits = Math.max(0, encounter.repairHits - 1);
      }
      if (encounter.repairHits >= 3) {
        encounter.repairHits = 0;
        completeStep(encounter, activeNode, objectives);
      }
      break;
    }

    case 'stabilize': {
      if (!nearNode) {
        encounter.actionHint = 'Move to stabilizer node';
        return;
      }
      const wanted = encounter.valveSequence[encounter.valveStep];
      encounter.actionHint = `Valve cycle: press ${wanted.replace('Key', '')} (${encounter.valveStep + 1}/${encounter.valveSequence.length})`;
      if (input.tap('KeyQ') || input.tap('KeyE')) {
        const pressed = input.tap('KeyQ') ? 'KeyQ' : 'KeyE';
        if (pressed === wanted) {
          encounter.valveStep += 1;
          if (encounter.valveStep >= encounter.valveSequence.length) {
            encounter.valveStep = 0;
            completeStep(encounter, activeNode, objectives);
          }
        } else {
          encounter.valveStep = 0;
        }
      }
      break;
    }

    case 'wreck_explore': {
      const inCave = encounter.currentCaveIndex !== null || encounter.caveZones.some((z) => insideZone(diver, z));
      encounter.actionHint = inCave
        ? `Search wreck cache (${Math.round(encounter.objectiveProgress * 100)}%)`
        : 'Enter cave marker (E) then hold F to search cache';
      if (inCave && nearNode && input.down('KeyF')) encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 0.9, 0, 1);
      if (encounter.objectiveProgress >= 1) completeStep(encounter, activeNode, objectives);
      break;
    }

    case 'rescue':
      encounter.actionHint = diver.escorting ? 'Escort diver to boat (E or F)' : 'Free trapped diver (hold F)';
      if (!diver.escorting && nearNode && input.down('KeyF')) encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 0.6, 0, 1);
      if (!diver.escorting && encounter.objectiveProgress >= 1) {
        diver.escorting = true;
        completeStep(encounter, activeNode, objectives);
      } else if (diver.escorting && nearBoat && (input.tap('KeyF') || input.tap('KeyE'))) {
        diver.escorting = false;
        objectives[encounter.objectiveIndex].done = true;
        encounter.objectiveIndex += 1;
      }
      break;

    default:
      encounter.actionHint = `Work objective (${Math.round(encounter.objectiveProgress * 100)}%)`;
      if (nearNode && input.down('KeyF')) encounter.objectiveProgress = clamp(encounter.objectiveProgress + dt * 0.52, 0, 1);
      if (encounter.objectiveProgress >= 1) completeStep(encounter, activeNode, objectives);
      break;
  }

  if (nearbyEntrance && encounter.contract.type !== 'wreck_explore') {
    encounter.actionHint += ' | Optional cavity nearby: press E/F to enter.';
  }
}

function completeStep(encounter, node, objectives) {
  node.done = true;
  encounter.objectiveProgress = 0;
  objectives[encounter.objectiveIndex].done = true;
  encounter.objectiveIndex += 1;
}

function completeEncounter(state, encounter) {
  encounter.done = true;
  state.lastResult = { success: true, pay: encounter.contract.pay, title: encounter.contract.title };
  state.money += encounter.contract.pay;
  state.mode = Modes.RESULTS;
}

function objectiveImage(assets, contractType) {
  if (contractType === 'fetch' || contractType === 'wreck_explore') return assets.cargo;
  if (contractType === 'rescue') return assets.rescue;
  return assets.beacon;
}

function drawUnderwaterShader(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, WATERLINE_Y, 0, h);
  g.addColorStop(0, '#15445d');
  g.addColorStop(1, '#081d29');
  ctx.fillStyle = g;
  ctx.fillRect(0, WATERLINE_Y, w, h - WATERLINE_Y);

  ctx.strokeStyle = 'rgba(120,215,255,0.08)';
  for (let y = WATERLINE_Y + 12; y < h; y += 28) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 24) {
      const yy = y + Math.sin((x * 0.04) + (t * 1.9) + y * 0.02) * 2.6;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function renderWorld(ctx, encounter, assets, state, w, h) {
  const diver = encounter.diver;
  const bob = Math.sin(state.elapsed * 2.2) * 3;
  if (assets.boat) ctx.drawImage(assets.boat, 130, 22 + bob, 120, 56);

  if (encounter.hasDiveBell) {
    ctx.fillStyle = '#e3d2a8';
    ctx.fillRect(encounter.diveBell.x - 18, encounter.diveBell.y - 24, 36, 36);
    ctx.strokeStyle = '#6d5a38';
    ctx.strokeRect(encounter.diveBell.x - 18, encounter.diveBell.y - 24, 36, 36);
  }

  encounter.caveZones.forEach((zone) => {
    ctx.fillStyle = 'rgba(20,20,20,0.6)';
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
    ctx.fill();
  });

  encounter.caveEntrances.forEach((entry, idx) => {
    ctx.fillStyle = encounter.currentCaveIndex === idx ? '#77ddff' : '#f3c98d';
    ctx.beginPath();
    ctx.arc(entry.x, entry.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c3140';
    ctx.font = '11px sans-serif';
    ctx.fillText('E', entry.x - 4, entry.y + 4);
  });

  const icon = objectiveImage(assets, encounter.contract.type);
  encounter.objectiveNodes.forEach((node) => {
    if (node.done) {
      ctx.fillStyle = '#6ec48d';
      ctx.fillRect(node.x - 8, node.y - 8, 16, 16);
      return;
    }
    if (icon) ctx.drawImage(icon, node.x - 14, node.y - 14, 28, 28);
  });

  if (assets.diver) ctx.drawImage(assets.diver, diver.x - 14, diver.y - 14, 28, 28);

  const gradient = ctx.createRadialGradient(diver.x, diver.y, 10, diver.x, diver.y, diver.lampRange);
  gradient.addColorStop(0, 'rgba(170, 225, 255, 0.28)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, WATERLINE_Y, w, h - WATERLINE_Y);
}

export function renderEncounter(ctx, state, w, h, assets) {
  const encounter = state.encounter;
  const diver = encounter.diver;

  ctx.fillStyle = '#98d3ef';
  ctx.fillRect(0, 0, w, WATERLINE_Y);

  ctx.strokeStyle = '#e7f8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 20) {
    const y = WATERLINE_Y + Math.sin((x + state.elapsed * 130) * 0.03) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  drawUnderwaterShader(ctx, w, h, state.elapsed);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(encounter.cameraZoom, encounter.cameraZoom);
  ctx.translate(-diver.x, -diver.y);
  renderWorld(ctx, encounter, assets, state, w, h);
  ctx.restore();

  if (encounter.contract.type === 'repair') {
    const x = 20;
    const y = h - 30;
    ctx.fillStyle = '#274657';
    ctx.fillRect(x, y, 220, 10);
    ctx.fillStyle = '#5fb06f';
    ctx.fillRect(x + 84, y, 52, 10);
    ctx.fillStyle = '#f7e38e';
    ctx.fillRect(x + encounter.repairWindow * 220 - 3, y - 3, 6, 16);
  }

  ctx.fillStyle = '#d4ecff';
  ctx.font = '16px sans-serif';
  const depthMeters = Math.max(0, Math.round((diver.y - WATERLINE_Y) / 4));
  ctx.fillText('Encounter - WASD swim | F interact | E extract/enter cave | +/- zoom', 20, 28);
  ctx.fillText(`Test Mode: no mission timer/fail pressure active | Depth: ${depthMeters}m/${diver.maxDepth}m`, 20, 52);
  ctx.fillText(encounter.actionHint, 20, 74);

  renderObjectiveList(ctx, encounter.contract.objectives, encounter.objectiveIndex);
}

function renderObjectiveList(ctx, objectives, index) {
  ctx.font = '14px sans-serif';
  objectives.forEach((objective, i) => {
    ctx.fillStyle = objective.done ? '#87d19b' : i === index ? '#ffde87' : '#b7d8e8';
    ctx.fillText(`${objective.done ? '✓' : i === index ? '→' : '•'} ${objective.label}`, 600, 28 + i * 20);
  });
}
