const fs = require('node:fs/promises');
const path = require('node:path');

const SAVE_PATH = path.join(__dirname, 'savegame.json');

const defaultSave = {
  money: 250,
  upgradesOwned: [],
  boat: {
    fuel: 100,
    hull: 100,
    mapX: 320,
    mapY: 260
  },
  discoveredAOIs: []
};

async function loadSave() {
  try {
    const raw = await fs.readFile(SAVE_PATH, 'utf8');
    return { ...defaultSave, ...JSON.parse(raw) };
  } catch {
    return defaultSave;
  }
}

async function writeSave(payload) {
  const next = { ...defaultSave, ...payload };
  await fs.writeFile(SAVE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  defaultSave,
  loadSave,
  writeSave
};
