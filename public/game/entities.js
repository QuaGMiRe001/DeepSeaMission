export function formatBoatState(boat) {
  const fuel = Math.max(0, Math.round(boat.fuel));
  const hull = Math.max(0, Math.round(boat.hull));
  return `Fuel ${fuel}% | Hull ${hull}%`;
}
