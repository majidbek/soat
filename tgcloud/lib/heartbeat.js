// TAJRIBA: Serverless'da cron yo'q. Heartbeat `endpoints/tick` ni har daqiqada
// o'zi qayta chaqirib, zanjir hosil qiladi. Ishlashi uchun kerak:
//   - setTimeout (keyingi daqiqagacha kutish uchun),
//   - endpoint o'z app manzilini fetch qila olishi,
//   - kv da bot tokeni (initData imzolash uchun; GitHub Actions yozadi).
// Biror shart bajarilmasa, zanjir o'zi to'xtaydi; soat baribir update kelganda
// yangilanadi (lib/users.js → wake). Daqiqa qulfi takroriy/tez zanjirga yo'l qo'ymaydi.

import { db, fetch } from 'sdk';
import { eq, sql } from 'sdk/db';
import { kv } from '../schema.js';
import { ADMIN_IDS, HEARTBEAT_MAX_BATCHES, SWEEP_LIMIT } from './config.js';
import { sweep, dueCount } from './users.js';
import { currentMinute, nowSec } from './time.js';
import { signInitData } from './initdata.js';

export const hasTimers = () => typeof setTimeout === 'function';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function kvGet(key) {
  const row = await db.select().from(kv).where(eq(kv.key, key)).get();
  return row ? row.value : null;
}

export async function kvSet(key, value) {
  await db.insert(kv).values({ key, value: value == null ? null : String(value) })
    .onConflictDoUpdate({ target: kv.key, set: { value: value == null ? null : String(value), updatedAt: nowSec() } })
    .run();
}

// Atomar: qiymat `from` dan kichik bo'lsa, `to` ga o'zgartiradi. true — biz yutdik.
async function kvAdvance(key, to) {
  await db.insert(kv).values({ key, value: '0' }).onConflictDoNothing({ target: kv.key }).run();
  const r = await db.run(sql`UPDATE kv SET value = ${String(to)}, updated_at = unixepoch()
    WHERE key = ${key} AND CAST(value AS INTEGER) < ${to}`);
  return r.rowsAffected > 0;
}

async function setStatus(patch) {
  let s = {};
  try { s = JSON.parse((await kvGet('hb_status')) || '{}'); } catch {}
  await kvSet('hb_status', JSON.stringify({ ...s, ...patch, at: nowSec() }));
}

export async function getStatus() {
  try { return JSON.parse((await kvGet('hb_status')) || '{}'); } catch { return {}; }
}

// Endpointga initData yuborishning mumkin bo'lgan usullari. Platforma formati
// hujjatda yo'q, shuning uchun /hb on birinchi ishlaganini topib, kv ga yozadi.
const AUTH_STYLES = [
  (init) => ({ headers: { 'X-Telegram-Init-Data': init } }),
  (init) => ({ headers: { Authorization: `tma ${init}` } }),
  (init) => ({ headers: { 'Telegram-Init-Data': init } }),
  (init) => ({ headers: { 'X-Init-Data': init } }),
  (init) => ({ query: `initData=${encodeURIComponent(init)}` }),
];

async function callSelf(name, input, styleIdx) {
  const token = await kvGet('bot_token');
  if (!token) throw new Error('bot_token yo\'q (GitHub Secrets → BOT_TOKEN)');
  const botId = token.split(':')[0];
  const init = signInitData(token, { id: ADMIN_IDS[0], first_name: 'heartbeat' });
  const style = AUTH_STYLES[styleIdx](init);
  const url = `https://app${botId}.tgcloud.ai/api/${name}${style.query ? `?${style.query}` : ''}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(style.headers || {}) },
    body: JSON.stringify(input),
  });
}

// Qaysi auth usuli ishlashini aniqlaydi (endpoints/ping orqali).
export async function probe() {
  for (let i = 0; i < AUTH_STYLES.length; i++) {
    try {
      const res = await callSelf('ping', {}, i);
      if (res.ok) {
        await kvSet('hb_auth', i);
        return { ok: true, style: i };
      }
      await res.text().catch(() => {});
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }
  return { ok: false, error: 'hech bir auth usuli qabul qilinmadi (401)' };
}

// Keyingi beat'ni ishga tushiradi; javobni kutmaymiz (u ~1 daqiqa uxlaydi).
async function fire(input) {
  const style = await kvGet('hb_auth');
  if (style == null) throw new Error('auth usuli aniqlanmagan (/hb on)');
  const p = callSelf('tick', input, Number(style)).then((r) => r.text()).catch((e) => {
    console.warn('hb fire', e?.message || e);
  });
  await Promise.race([p, sleep(1500)]);
}

// endpoints/tick shu funksiyani chaqiradi.
export async function beat(input = {}) {
  if ((await kvGet('hb_enabled')) !== '1') return { stopped: 'disabled' };
  if (!hasTimers()) {
    await setStatus({ mode: 'no-timers' });
    return { stopped: 'no-timers' };
  }

  // Maqsad daqiqasigacha kutamiz (1 soniya zaxira bilan)
  if (input.target) {
    const wait = input.target * 60000 + 1000 - Date.now();
    if (wait > 0) await sleep(Math.min(wait, 65000));
  }

  const minute = currentMinute();
  if (!(await kvAdvance('hb_minute', minute))) return { skipped: minute };

  let fireError = null;
  try {
    await fire({ target: minute + 1 });
  } catch (e) {
    fireError = String(e?.message || e);
  }

  let updated = 0;
  for (let i = 0; i < HEARTBEAT_MAX_BATCHES; i++) {
    const n = await sweep(SWEEP_LIMIT);
    updated += n;
    if (n < SWEEP_LIMIT) break;
  }
  const left = await dueCount();
  await setStatus({ mode: 'running', lastBeat: minute, updated, left, fireError });
  return { minute, updated, left, fireError };
}

// Zanjir uzilgan bo'lsa (2+ daqiqa beat yo'q), har qanday update uni qayta ulaydi.
export async function kick(force = false) {
  if ((await kvGet('hb_enabled')) !== '1' || !hasTimers()) return false;
  const minute = currentMinute();
  const last = Number((await kvGet('hb_minute')) || 0);
  if (!force && last >= minute - 2) return false;
  // Ko'pi bilan 2 daqiqada bir marta urinamiz
  if (!(await kvAdvance('hb_kick', minute + 1))) return false;
  try {
    await fire({});
    return true;
  } catch (e) {
    await setStatus({ kickError: String(e?.message || e) });
    return false;
  }
}
