import { Modes } from '../core/state.js';
import { clamp } from '../core/util.js';

const WATERLINE_Y = 80;
const INTERIOR_BOUNDS = { left: 210, right: 1050, top: 130, bottom: 560 };

function approach(current, target, factor) {
  return current + (target - current) * factor;
}

function nearPoint(a, b, radius) {
  return Math.hypot(a.x - b.x, a.y - b.y) < radius;
}

function insideZone(point, zone) {
  return Math.hypot(point.x - zone.x, point.y - zone.y) <= zone.r;
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function approachAngle(current, target, step) {
  const delta = normalizeAngle(target - current);
  return current + delta * step;
}

function getBoatPoint(encounter, elapsed) {
  const drift = Math.sin(elapsed * 0.22 + encounter.aoi.x * 0.01) * 80;
  const swell = Math.sin(elapsed * 1.8 + encounter.aoi.y * 0.02) * 4;
  return {
    x: (encounter.surfaceX || 200) + drift,
    y: WATERLINE_Y - 8 + swell
  };
}

function interiorPortalPoint(encounter) {
  return encounter.interiorScene?.entry || null;
}

function updateAutoCamera(encounter, diver, boatPoint) {
  const distance = Math.hypot(diver.x - boatPoint.x, diver.y - boatPoint.y);
  const desiredView = 300 + distance + encounter.cameraPadding;
  const desiredZoom = clamp(900 / desiredView, 0.72, 1.5);
  const interiorBoost = encounter.inInterior ? 1.18 : 1;
  encounter.targetZoom = encounter.autoCamera ? clamp(desiredZoom * interiorBoost, 0.72, 1.5) : encounter.targetZoom;
}

function updateDiveBellState(encounter, diver, input, dt) {
  if (!encounter.hasDiveBell) return;

  const nearBell = nearPoint(diver, encounter.diveBell, 42);
  if (!encounter.diveBell.occupied && nearBell && input.tap('KeyE')) {
    encounter.diveBell.occupied = true;
    diver.vx = 0;
    diver.vy = 0;
  }

  if (encounter.diveBell.occupied) {
    if (input.down('KeyR')) encounter.diveBell.y = clamp(encounter.diveBell.y - 70 * dt, 130, 480);
    if (input.down('KeyF')) encounter.diveBell.y = clamp(encounter.diveBell.y + 70 * dt, 130, 480);

    diver.x = encounter.diveBell.x;
    diver.y = encounter.diveBell.y;

    if (input.tap('KeyE')) {
      encounter.diveBell.occupied = false;
      diver.x += 28;
      diver.y += 14;
    }
  }
}

export function updateEncounter(state, input, dt) {
  const encounter = state.encounter;
  const diver = encounter.diver;
  encounter.timer += dt;

  encounter.surfaceX = encounter.surfaceX || 200;
  encounter.surfaceX += Math.sin(state.elapsed * 0.35 + encounter.timer * 0.15) * dt * 9;
  encounter.surfaceX = clamp(encounter.surfaceX, 130, 870);

  if (input.tap('KeyP')) encounter.autoCamera = !encounter.autoCamera;
  if (input.tap('BracketLeft')) encounter.cameraPadding = clamp(encounter.cameraPadding - 20, 80, 320);
  if (input.tap('BracketRight')) encounter.cameraPadding = clamp(encounter.cameraPadding + 20, 80, 320);

  if (!encounter.autoCamera) {
    if (input.tap('Equal')) encounter.targetZoom = clamp(encounter.targetZoom + 0.12, 0.72, 1.5);
    if (input.tap('Minus')) encounter.targetZoom = clamp(encounter.targetZoom - 0.12, 0.72, 1.5);
  }

  maybeToggleCave(encounter, diver, input);
  updateDiveBellState(encounter, diver, input, dt);

  const moveAccel = 215;
  const verticalAccel = 182;
  const waterFriction = 0.34;
  const idleDrag = 0.9;
  const burst = input.down('ShiftLeft') || input.down('ShiftRight') ? 1.28 : 1;
  const maxSpeed = 165 * burst;
  const currentX = Math.sin(state.elapsed * 0.9 + encounter.timer * 0.2) * encounter.currentFactor * 3.2;

  const axisX = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  const axisY = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);

  const targetVX = axisX * moveAccel * burst;
  const targetVY = axisY * verticalAccel * burst;

  if (!encounter.diveBell.occupied) {
    diver.vx = approach(diver.vx, targetVX, waterFriction) + currentX;
    diver.vy = approach(diver.vy, targetVY, waterFriction);

    if (axisX === 0) diver.vx *= idleDrag;
    if (axisY === 0) diver.vy *= idleDrag;
    if (axisX === 0 && axisY === 0) diver.vy -= 8 * dt;

    diver.vx = clamp(diver.vx, -maxSpeed, maxSpeed);
    diver.vy = clamp(diver.vy, -maxSpeed, maxSpeed);

    const swimSpeed = Math.hypot(diver.vx, diver.vy);
    if (swimSpeed > 8) {
      diver.heading = approachAngle(diver.heading || 0, Math.atan2(diver.vy, diver.vx), 0.24);
    }
    diver.kickPhase = (diver.kickPhase || 0) + dt * (2.6 + swimSpeed * 0.04);

    if (encounter.inInterior) {
      diver.x = clamp(diver.x + diver.vx * dt, INTERIOR_BOUNDS.left, INTERIOR_BOUNDS.right);
      diver.y = clamp(diver.y + diver.vy * dt, INTERIOR_BOUNDS.top, INTERIOR_BOUNDS.bottom);
    } else {
      diver.x = clamp(diver.x + diver.vx * dt, 40, 980);
      diver.y = clamp(diver.y + diver.vy * dt, WATERLINE_Y, 540);
    }
  }

  // TEMP: mission timer/fail pressure disabled for playtesting iteration.
  // Keep meter value for UI continuity, but no drain or fail condition.
  const boatPoint = getBoatPoint(encounter, state.elapsed);
  updateAutoCamera(encounter, diver, boatPoint);
  encounter.cameraZoom = approach(encounter.cameraZoom, encounter.targetZoom, 0.18);

  if (encounter.hasDiveBell && nearPoint(diver, encounter.diveBell, 52)) {
    diver.o2 = Math.min(130, diver.o2 + dt * 8);
  }

  updateObjectiveProgress(encounter, input, dt);

  const atBoat = nearPoint(diver, boatPoint, 62);
  const objectivesDone = encounter.objectiveIndex >= encounter.contract.objectives.length;
  if (atBoat && objectivesDone && input.tap('KeyE')) {
    completeEncounter(state, encounter);
  }
}

function maybeToggleCave(encounter, diver, input) {
  const interactTap = input.tap('KeyE') || input.tap('KeyF');
  if (!encounter.caveEntrances.length || !interactTap || encounter.diveBell.occupied) return;

  if (encounter.inInterior) {
    const portal = interiorPortalPoint(encounter);
    if (portal && nearPoint(diver, portal, 46)) {
      const exit = encounter.caveEntrances[encounter.currentCaveIndex || 0];
      diver.x = exit.x + 10;
      diver.y = exit.y + 8;
      encounter.inInterior = false;
      encounter.currentCaveIndex = null;
    }
    return;
  }

  const entryIndex = encounter.caveEntrances.findIndex((entry) => nearPoint(diver, entry, 54));
  if (entryIndex >= 0) {
    encounter.currentCaveIndex = entryIndex;
    if (encounter.interiorScene) {
      const entry = interiorPortalPoint(encounter);
      diver.x = entry.x + 20;
      diver.y = entry.y;
      encounter.inInterior = true;
    } else {
      const targetZone = encounter.caveZones[entryIndex];
      diver.x = targetZone.x;
      diver.y = targetZone.y;
    }
  }
}

function getNearbyCaveEntrance(encounter, diver) {
  if (!encounter.caveEntrances.length || encounter.inInterior) return null;
  return encounter.caveEntrances.find((entry) => nearPoint(diver, entry, 56)) || null;
}

function updateObjectiveProgress(encounter, input, dt) {
  const diver = encounter.diver;
  const objectives = encounter.contract.objectives;
  const currentObjective = objectives[encounter.objectiveIndex];
  const nearBoat = nearPoint(diver, getBoatPoint(encounter, encounter.timer), 62);
  const nearbyEntrance = getNearbyCaveEntrance(encounter, diver);

  if (!currentObjective) {
    encounter.actionHint = nearBoat
      ? 'Mission complete. Press E to extract.'
      : 'Return to boat at surface then press E to extract.';
    if (nearbyEntrance) encounter.actionHint += ' | Cave nearby: press E/F to enter.';
    return;
  }

  const activeNode = encounter.objectiveNodes.find((node) => !node.done) || encounter.objectiveNodes[encounter.objectiveNodes.length - 1];
  const nearNode = nearPoint(diver, activeNode, 52);
  const nodeDistance = Math.round(Math.hypot(diver.x - activeNode.x, diver.y - activeNode.y));

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
      const inCave = encounter.inInterior || encounter.currentCaveIndex !== null || encounter.caveZones.some((z) => insideZone(diver, z));
      encounter.actionHint = inCave
        ? `Search wreck cache (${Math.round(encounter.objectiveProgress * 100)}%)`
        : encounter.interiorScene ? 'Enter wreck hatch marker (E/F) to load interior scene' : 'Enter cave marker (E/F) then hold F to search cache';
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

  if (encounter.hasDiveBell) {
    if (encounter.diveBell.occupied) encounter.actionHint += ' | Dive Bell: R ascend, F descend, E exit';
    else if (nearPoint(diver, encounter.diveBell, 44)) encounter.actionHint += ' | Press E to enter Dive Bell';
  }

  encounter.actionHint += nearNode
    ? ' | In range: hold F'
    : ` | Active target: ${nodeDistance}px`;
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

function drawInteriorBackdrop(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1a1d22');
  g.addColorStop(1, '#0b0d11');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(110,120,135,0.18)';
  for (let y = 100; y < h; y += 34) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 24) {
      const yy = y + Math.sin(x * 0.03 + y * 0.01 + t * 1.5) * 1.7;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function renderWorld(ctx, encounter, assets, state, w, h) {
  const diver = encounter.diver;
  const boatPoint = getBoatPoint(encounter, state.elapsed);
  const boatDrawX = boatPoint.x - 60;
  const boatDrawY = boatPoint.y - 26;
  if (assets.boat) ctx.drawImage(assets.boat, boatDrawX, boatDrawY, 120, 56);

  if (encounter.hasDiveBell) {
    ctx.strokeStyle = 'rgba(211, 190, 146, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boatPoint.x, boatPoint.y + 20);
    ctx.lineTo(encounter.diveBell.x, encounter.diveBell.y - 20);
    ctx.stroke();
    ctx.fillStyle = '#e3d2a8';
    ctx.fillRect(encounter.diveBell.x - 18, encounter.diveBell.y - 24, 36, 36);
    ctx.strokeStyle = '#6d5a38';
    ctx.strokeRect(encounter.diveBell.x - 18, encounter.diveBell.y - 24, 36, 36);
  }

  if (!encounter.inInterior) {
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
  } else if (encounter.interiorScene) {
    renderInteriorScene(ctx, encounter.interiorScene);
  }

  const icon = objectiveImage(assets, encounter.contract.type);
  const activeNode = encounter.objectiveNodes.find((node) => !node.done);
  encounter.objectiveNodes.forEach((node) => {
    if (node.done) {
      ctx.fillStyle = '#6ec48d';
      ctx.fillRect(node.x - 8, node.y - 8, 16, 16);
      return;
    }
    if (icon) ctx.drawImage(icon, node.x - 14, node.y - 14, 28, 28);

    if (activeNode === node) {
      const pulse = 18 + Math.sin(state.elapsed * 4) * 4;
      ctx.strokeStyle = 'rgba(255, 220, 130, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  drawSwimmingDiver(ctx, diver);

  const gradient = ctx.createRadialGradient(diver.x, diver.y, 10, diver.x, diver.y, diver.lampRange);
  gradient.addColorStop(0, 'rgba(170, 225, 255, 0.28)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, WATERLINE_Y, w, h - WATERLINE_Y);
}



function renderInteriorScene(ctx, scene) {
  scene.rooms.forEach((room) => {
    ctx.fillStyle = '#2e3238';
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.strokeStyle = '#5a626d';
    ctx.strokeRect(room.x, room.y, room.w, room.h);
  });

  ctx.strokeStyle = '#8ca0b3';
  ctx.lineWidth = 8;
  scene.corridors.forEach((c) => {
    ctx.beginPath();
    ctx.moveTo(c.x1, c.y1);
    ctx.lineTo(c.x2, c.y2);
    ctx.stroke();
  });

  const entry = scene.entry;
  ctx.fillStyle = '#9de3ff';
  ctx.beginPath();
  ctx.arc(entry.x, entry.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#153347';
  ctx.font = '11px sans-serif';
  ctx.fillText('E', entry.x - 4, entry.y + 4);

  scene.objectiveAnchors.forEach((point) => {
    ctx.strokeStyle = 'rgba(255, 205, 110, 0.5)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  });

}


function drawSwimmingDiver(ctx, diver) {
  const heading = diver.heading || 0;
  const kick = Math.sin(diver.kickPhase || 0);

  ctx.save();
  ctx.translate(diver.x, diver.y);
  ctx.rotate(heading);

  ctx.fillStyle = '#2e3944';
  ctx.fillRect(-16, -6, 22, 12);

  ctx.fillStyle = '#10171d';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffb88a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -4);
  ctx.lineTo(10, -6 - kick * 2);
  ctx.moveTo(2, 4);
  ctx.lineTo(10, 6 + kick * 2);
  ctx.stroke();

  ctx.strokeStyle = '#0f151b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-16, -8 - kick * 4);
  ctx.moveTo(-8, 4);
  ctx.lineTo(-16, 8 + kick * 4);
  ctx.stroke();

  ctx.fillStyle = '#29c9e7';
  ctx.beginPath();
  ctx.arc(-17, -9 - kick * 4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-17, 9 + kick * 4, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1f2932';
  ctx.beginPath();
  ctx.arc(11, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7ddff5';
  ctx.fillRect(9, -2, 8, 4);

  if (diver.carrying) {
    ctx.fillStyle = '#d8a770';
    ctx.fillRect(15, -4, 8, 8);
  }

  if (diver.escorting) {
    ctx.fillStyle = '#9ee0ff';
    ctx.beginPath();
    ctx.arc(-26, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }

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

  if (encounter.inInterior) drawInteriorBackdrop(ctx, w, h, state.elapsed);
  else drawUnderwaterShader(ctx, w, h, state.elapsed);

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
  ctx.fillText('Encounter - WASD swim | Shift burst | E interact/extract | F work/descend bell | R ascend bell | P auto-cam | [ ] padding', 20, 28);
  ctx.fillText(`Test Mode: no mission timer/fail pressure active | Depth: ${depthMeters}m/${diver.maxDepth}m`, 20, 52);
  ctx.fillText(encounter.actionHint, 20, 74);
  ctx.fillText(`Cam: ${encounter.autoCamera ? 'AUTO' : 'MANUAL'} pad ${Math.round(encounter.cameraPadding)} zoom ${encounter.cameraZoom.toFixed(2)}`, 20, 96);
  if (encounter.inInterior && encounter.interiorScene) {
    ctx.fillStyle = '#ffc98b';
    ctx.fillText(`Interior Scene: ${encounter.interiorScene.name}`, 20, 118);
  }

  renderObjectiveList(ctx, encounter.contract.objectives, encounter.objectiveIndex);
}

function renderObjectiveList(ctx, objectives, index) {
  ctx.font = '14px sans-serif';
  objectives.forEach((objective, i) => {
    ctx.fillStyle = objective.done ? '#87d19b' : i === index ? '#ffde87' : '#b7d8e8';
    ctx.fillText(`${objective.done ? '✓' : i === index ? '→' : '•'} ${objective.label}`, 600, 52 + i * 20);
  });
}
