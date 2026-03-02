import { Modes } from '../core/state.js';

const UPGRADE_KEYS = {
  Digit7: { id: 'tank_1', cost: 300 },
  Digit8: { id: 'lamp_1', cost: 220 },
  Digit9: { id: 'cutter_1', cost: 260 },
  KeyB: { id: 'divebell_1', cost: 520 }
};

export function updatePort(state, input) {
  const selectedIdx = contractSelect(input, state.contracts.length);
  if (selectedIdx >= 0) state.selectedContract = state.contracts[selectedIdx];

  if (input.tap('Digit6')) state.currentGear = 'diver';
  if (input.tap('Digit0') && state.upgradesOwned.includes('divebell_1')) state.currentGear = 'divebell';

  if (input.tap('Enter')) {
    if (!state.selectedContract) state.selectedContract = state.contracts[0];
    state.mode = Modes.MAP;
  }

  Object.entries(UPGRADE_KEYS).forEach(([key, value]) => {
    if (input.tap(key)) buyUpgrade(state, value.id, value.cost);
  });
}

function contractSelect(input, count) {
  const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
  for (let i = 0; i < Math.min(count, keys.length); i += 1) {
    if (input.tap(keys[i])) return i;
  }
  return -1;
}

function buyUpgrade(state, id, cost) {
  if (state.upgradesOwned.includes(id)) return;
  if (state.money < cost) return;
  state.money -= cost;
  state.upgradesOwned.push(id);
}

export function renderPort(ctx, state, w, h, assets) {
  ctx.fillStyle = '#0f2735';
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(125, 214, 255, 0.12)');
  g.addColorStop(1, 'rgba(10, 22, 31, 0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#88d7ff';
  ctx.font = '700 30px sans-serif';
  const currentPort = state.world.ports.find((p) => p.id === state.currentPortId);
  ctx.fillText(`Port - ${currentPort?.name || 'Harbor'}`, 40, 60);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#b9e8ff';
  ctx.fillText('Select contract with [1-5] • Enter to launch • [6]/[0] loadout • [7-9]/[B] upgrades', 40, 88);

  if (assets.boat) ctx.drawImage(assets.boat, 820, 40, 180, 90);

  ctx.fillStyle = '#1d3b4e';
  ctx.fillRect(40, 112, 470, 78);
  ctx.strokeStyle = '#3d6a82';
  ctx.strokeRect(40, 112, 470, 78);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#d6f0ff';
  ctx.fillText('Upgrades: [7] Tank [8] Lamp [9] Cutter [B] Dive Bell', 54, 142);
  ctx.fillText(`Loadout: [6] Diver [0] Dive Bell  | Active: ${state.currentGear.toUpperCase()}`, 54, 169);

  ctx.fillStyle = '#1a3343';
  ctx.fillRect(40, 204, 960, 330);
  ctx.strokeStyle = '#396781';
  ctx.strokeRect(40, 204, 960, 330);
  ctx.fillStyle = '#aee8ff';
  ctx.fillText(`Credits: $${state.money}`, 55, 236);
  ctx.fillText(`Owned upgrades: ${state.upgradesOwned.join(', ') || 'none'}`, 55, 264);

  ctx.fillStyle = '#ffdf95';
  ctx.fillText('Contract Board', 55, 294);
  state.contracts.forEach((contract, idx) => {
    const y = 316 + idx * 58;
    const active = state.selectedContract?.id === contract.id;
    ctx.fillStyle = active ? 'rgba(255, 221, 130, 0.22)' : 'rgba(30, 56, 73, 0.65)';
    ctx.fillRect(55, y - 24, 930, 44);
    ctx.strokeStyle = active ? '#ffd46f' : '#315c75';
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(55, y - 24, 930, 44);

    ctx.fillStyle = active ? '#ffdf95' : '#d6efff';
    ctx.font = active ? '700 17px sans-serif' : '16px sans-serif';
    const modLabel = contract.modifier ? ` + ${contract.modifier.label}` : '';
    const req = contract.depth > 70 ? 'Dive Bell' : 'Diver';
    ctx.fillText(
      `${active ? '▶' : ' '} [${idx + 1}] ${contract.title}${modLabel}`,
      70,
      y
    );
    ctx.fillStyle = '#9ecbe3';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${contract.aoiType.toUpperCase()} • ${contract.depth}m • ${req} • $${contract.pay}`, 78, y + 18);
  });
}
