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
  ctx.fillStyle = '#153547';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#88d7ff';
  ctx.font = '28px sans-serif';
  const currentPort = state.world.ports.find((p) => p.id === state.currentPortId);
  ctx.fillText(`Port - ${currentPort?.name || 'Harbor'}`, 40, 60);

  if (assets.boat) ctx.drawImage(assets.boat, 820, 40, 180, 90);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#d6f0ff';
  ctx.fillText('Choose contract [1-5], press Enter to depart', 40, 100);
  ctx.fillText('Buy upgrades: [7] Tank [8] Lamp [9] Cutter [B] Dive Bell', 40, 128);
  ctx.fillText(`Gear loadout: [6] Diver [0] Dive Bell   Active: ${state.currentGear.toUpperCase()}`, 40, 156);

  ctx.fillStyle = '#264e63';
  ctx.fillRect(40, 184, 920, 320);
  ctx.fillStyle = '#aee8ff';
  ctx.fillText(`Credits: $${state.money}`, 55, 216);
  ctx.fillText(`Owned upgrades: ${state.upgradesOwned.join(', ') || 'none'}`, 55, 244);

  ctx.fillText('Available contracts:', 55, 278);
  state.contracts.forEach((contract, idx) => {
    const y = 308 + idx * 32;
    const active = state.selectedContract?.id === contract.id;
    ctx.fillStyle = active ? '#ffde87' : '#cbe8ff';
    const modLabel = contract.modifier ? ` + ${contract.modifier.label}` : '';
    const req = contract.depth > 70 ? 'Dive Bell' : 'Diver';
    ctx.fillText(
      `[${idx + 1}] ${contract.title}${modLabel} | ${contract.aoiType.toUpperCase()} ${contract.depth}m | ${req} | $${contract.pay}`,
      65,
      y
    );
  });
}
