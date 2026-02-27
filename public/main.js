import { createGameState, Modes } from './core/state.js';
import { createInput } from './core/input.js';
import { clearFrame, drawWaterBackdrop } from './core/render.js';
import { loadAssets } from './core/assets.js';
import { updatePort, renderPort } from './game/port.js';
import { updateMap, renderMap } from './game/map.js';
import { updateEncounter, renderEncounter } from './game/encounter.js';
import { updateResults, renderResults } from './game/results.js';
import { contractSummary } from './game/missions.js';
import { formatBoatState } from './game/entities.js';
import { getUpgradeLabel } from './game/upgrades.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const input = createInput();

const [bootstrap, assets] = await Promise.all([
  fetch('/api/bootstrap').then((r) => r.json()),
  loadAssets()
]);
const state = createGameState(bootstrap);

let last = performance.now();
let lastAutosave = 0;

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  state.dt = dt;
  state.elapsed += dt;

  update(dt);
  render();
  updateHud();
  maybeAutosave(now);

  input.endFrame();
  requestAnimationFrame(loop);
}

function update(dt) {
  switch (state.mode) {
    case Modes.PORT:
      updatePort(state, input, dt);
      break;
    case Modes.MAP:
      updateMap(state, input, dt);
      break;
    case Modes.ENCOUNTER:
      updateEncounter(state, input, dt);
      break;
    case Modes.RESULTS:
      updateResults(state, input, dt);
      break;
    default:
      break;
  }
}

function render() {
  clearFrame(ctx, canvas.width, canvas.height);
  drawWaterBackdrop(ctx, canvas.width, canvas.height);

  switch (state.mode) {
    case Modes.PORT:
      renderPort(ctx, state, canvas.width, canvas.height, assets);
      break;
    case Modes.MAP:
      renderMap(ctx, state, canvas.width, canvas.height, assets);
      break;
    case Modes.ENCOUNTER:
      renderEncounter(ctx, state, canvas.width, canvas.height, assets);
      break;
    case Modes.RESULTS:
      renderResults(ctx, state, canvas.width, canvas.height);
      break;
    default:
      break;
  }
}

function meterRow(label, value) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return `<div class="stat-row"><span>${label}</span><div class="meter"><div class="fill" style="width:${v}%"></div></div><span>${v}%</span></div>`;
}

function updateHud() {
  const contracts = state.contracts
    .map((c, idx) => `<li>${idx + 1}. ${contractSummary(c)} ${state.selectedContract?.id === c.id ? '• active' : ''}</li>`)
    .join('');

  const upgrades = state.upgradesOwned.map((u) => getUpgradeLabel(u)).join(', ') || 'none';
  const activeContract = state.selectedContract ? contractSummary(state.selectedContract) : 'None selected';
  const currentPort = state.world.ports.find((p) => p.id === state.currentPortId);

  hud.innerHTML = `
    <section class="card">
      <h3>Deep Sea Mission</h3>
      <p class="small">Mode: <span class="key">${state.mode}</span></p>
      <p class="small">${formatBoatState(state.boat)}</p>
      ${meterRow('Fuel', state.boat.fuel)}
      ${meterRow('Hull', state.boat.hull)}
      <p class="small">Credits: $${state.money}</p>
      <p class="small">Docked Port: ${currentPort?.name || 'At Sea'}</p>
    </section>
    <section class="card">
      <h3>Active Contract</h3>
      <p class="small">${activeContract}</p>
    </section>
    <section class="card">
      <h3>Contracts</h3>
      <ul>${contracts}</ul>
      <p class="small">Port select: [1-5]</p>
    </section>
    <section class="card">
      <h3>Upgrades</h3>
      <p class="small">${upgrades}</p>
      <p class="small">Port buy: [7]/[8]/[9]</p>
    </section>
    <section class="card">
      <h3>Controls</h3>
      <p class="small">Map boat: W/S throttle, A/D steer</p>
      <p class="small">Map sonar: SPACE</p>
      <p class="small">Deploy/Dock/Extract: E</p>
      <p class="small">Encounter interact: hold F</p>
      <p class="small">Dock by sailing near port and pressing E</p>
    </section>
  `;
}

function getSavePayload() {
  return {
    money: state.money,
    upgradesOwned: state.upgradesOwned,
    boat: {
      fuel: state.boat.fuel,
      hull: state.boat.hull,
      mapX: state.boat.x,
      mapY: state.boat.y
    },
    discoveredAOIs: Array.from(state.discoveredAOIs)
  };
}

function maybeAutosave(now) {
  if (now - lastAutosave < 8000) return;
  lastAutosave = now;
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getSavePayload())
  });
}

window.addEventListener('beforeunload', () => {
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getSavePayload())
  });
});

requestAnimationFrame(loop);
