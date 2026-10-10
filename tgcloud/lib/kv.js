import { db } from 'sdk';
import { eq } from 'sdk/db';
import { kv } from '../schema.js';
import { nowSec } from './time.js';

export async function kvGet(key) {
  const row = await db.select().from(kv).where(eq(kv.key, key)).get();
  return row ? row.value : null;
}

export async function kvSet(key, value) {
  const v = value == null ? null : String(value);
  await db.insert(kv).values({ key, value: v })
    .onConflictDoUpdate({ target: kv.key, set: { value: v, updatedAt: nowSec() } })
    .run();
}
