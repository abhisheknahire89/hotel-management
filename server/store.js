import fs from 'node:fs';
import path from 'node:path';
import { createSeedData } from './seed.js';

const DATA_DIR = path.resolve('server/data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createSeedData(), null, 2));
  }
}

export function readState() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

export function writeState(nextState) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextState, null, 2));
}

export function updateState(updater) {
  const current = readState();
  const next = updater(current);
  writeState(next);
  return next;
}

export function nextId(collection, prefix, start = 1) {
  const max = collection.reduce((currentMax, item) => {
    const parsed = Number(String(item.id || '').replace(`${prefix}-`, ''));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, start - 1);

  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
