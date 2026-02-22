import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createSeedData } from './seed.js';

const DATA_DIR = path.resolve('server/data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const STATE_KEY = 'hotel-core-state';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

const supabase = useSupabase ? createClient(supabaseUrl, supabaseKey) : null;

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

async function ensureSupabaseState() {
  const { data, error } = await supabase
    .from('app_state')
    .select('key,data')
    .eq('key', STATE_KEY)
    .maybeSingle();

  if (error) throw new Error(`Supabase read error: ${error.message}`);

  if (!data) {
    const seed = createSeedData();
    const { error: insertError } = await supabase.from('app_state').insert({ key: STATE_KEY, data: seed });
    if (insertError) throw new Error(`Supabase seed error: ${insertError.message}`);
    return seed;
  }

  return data.data;
}

export async function readState() {
  if (!useSupabase) {
    return readFileState();
  }

  return ensureSupabaseState();
}

export async function writeState(nextState) {
  if (!useSupabase) {
    writeFileState(nextState);
    return;
  }

  await ensureSupabaseState();
  const { error } = await supabase.from('app_state').update({ data: nextState }).eq('key', STATE_KEY);

  if (error) throw new Error(`Supabase write error: ${error.message}`);
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

export function storageMode() {
  return useSupabase ? 'supabase' : 'file';
}
