import { Modes } from '../core/state.js';

export function updateResults(state, input) {
  if (input.tap('Enter')) {
    state.mode = Modes.PORT;
    state.encounter = null;
  }
}

export function renderResults(ctx, state, w, h) {
  const result = state.lastResult;
  ctx.fillStyle = '#102836';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#c7ebff';
  ctx.font = '32px sans-serif';
  ctx.fillText(result.success ? 'Mission Complete' : 'Mission Failed', 40, 70);

  ctx.font = '20px sans-serif';
  ctx.fillText(`Contract: ${result.title}`, 40, 120);
  ctx.fillText(`Credits change: ${result.pay >= 0 ? '+' : ''}${result.pay}`, 40, 150);
  ctx.fillText(`Total credits: ${state.money}`, 40, 180);
  ctx.fillText('Press Enter to return to Port', 40, 230);
}
