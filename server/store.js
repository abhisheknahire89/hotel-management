import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { createSeedData } from './seed.js';
import { StateModel } from './stateModel.js';

const DATA_DIR = path.resolve('server/data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const STATE_KEY = 'hotel-core-state';
const useMongo = Boolean(process.env.MONGODB_URI);

let mongoReady = false;

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createSeedData(), null, 2));
  }
}

function readFileState() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeFileState(nextState) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextState, null, 2));
}

async function initMongo() {
  if (!useMongo || mongoReady) return;

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const existing = await StateModel.findOne({ key: STATE_KEY }).lean();
  if (!existing) {
    await StateModel.create({ key: STATE_KEY, data: createSeedData() });
  }

  mongoReady = true;
}

export async function readState() {
  if (!useMongo) {
    return readFileState();
  }

  await initMongo();
  const doc = await StateModel.findOne({ key: STATE_KEY }).lean();
  return doc?.data || createSeedData();
}

export async function writeState(nextState) {
  if (!useMongo) {
    writeFileState(nextState);
    return;
  }

  await initMongo();
  await StateModel.updateOne(
    { key: STATE_KEY },
    {
      $set: {
        data: nextState,
      },
    },
    { upsert: true },
  );
}

export async function updateState(updater) {
  const current = await readState();
  const next = updater(current);
  await writeState(next);
  return next;
}

export function nextId(collection, prefix, start = 1) {
  const max = collection.reduce((currentMax, item) => {
    const parsed = Number(String(item.id || '').replace(`${prefix}-`, ''));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, start - 1);

  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function isCloudMode() {
  return useMongo;
}
