function pickOne(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function xorshift(seed) {
  let state = seed || 123456789;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };
}

function buildObjectives(type) {
  switch (type) {
    case 'fetch':
      return [
        { id: 'pickup', label: 'Recover lost cargo', done: false },
        { id: 'return', label: 'Return cargo to boat', done: false }
      ];
    case 'repair':
      return [
        { id: 'locate', label: 'Locate cable break', done: false },
        { id: 'fix', label: 'Stabilize and repair cable', done: false }
      ];
    case 'place_beacons':
      return [
        { id: 'b1', label: 'Place survey beacon 1', done: false },
        { id: 'b2', label: 'Place survey beacon 2', done: false },
        { id: 'b3', label: 'Place survey beacon 3', done: false }
      ];
    case 'cut':
      return [
        { id: 'approach', label: 'Approach entanglement site', done: false },
        { id: 'cut', label: 'Cut trapped lines', done: false }
      ];
    case 'rescue':
      return [
        { id: 'find', label: 'Find trapped diver', done: false },
        { id: 'escort', label: 'Escort diver to extraction point', done: false }
      ];
    default:
      return [{ id: 'complete', label: 'Complete objective', done: false }];
  }
}

function encounterParamsByAoi(aoi, modifier) {
  const base = {
    reef: { visibility: 1, current: 1, depthPressure: 1 },
    kelp: { visibility: 0.86, current: 1.15, depthPressure: 1.1 },
    wreck: { visibility: 0.72, current: 1.25, depthPressure: 1.2 }
  }[aoi.type] || { visibility: 0.9, current: 1, depthPressure: 1 };

  return {
    visibility: Math.max(0.5, base.visibility * (modifier?.visibility || 1)),
    current: base.current * (modifier?.surfaceDrift || 1),
    siltiness: modifier?.siltiness || 1,
    depthPressure: base.depthPressure
  };
}

function generateContract({ aoi, templates, modifiers, seed, sequence }) {
  const rng = xorshift(seed || Date.now());
  const template = pickOne(templates, rng);
  const maybeModifier = rng() > 0.5 ? pickOne(modifiers, rng) : null;
  const payMult = maybeModifier?.payMult || 1;

  return {
    id: `ct_${Date.now()}_${sequence}`,
    aoiId: aoi.id,
    aoiType: aoi.type,
    risk: aoi.risk,
    title: template.title,
    type: template.type,
    modifier: maybeModifier,
    params: encounterParamsByAoi(aoi, maybeModifier),
    basePay: template.basePay,
    pay: Math.round(template.basePay * payMult * (1 + aoi.risk * 0.1)),
    objectives: buildObjectives(template.type)
  };
}

module.exports = {
  generateContract
};
