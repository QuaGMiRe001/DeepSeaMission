export function getUpgradeLabel(id) {
  const labels = {
    tank_1: 'Larger Air Tank',
    lamp_1: 'Brighter Lamp',
    cutter_1: 'Improved Cutter',
    divebell_1: 'Dive Bell Retrofit'
  };
  return labels[id] || id;
}
