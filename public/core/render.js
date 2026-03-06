export function clearFrame(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

export function drawWaterBackdrop(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1c5a7a');
  gradient.addColorStop(0.45, '#0f3650');
  gradient.addColorStop(1, '#061a26');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
