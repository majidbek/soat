import { api, db, BotApiError } from 'sdk';
import { eq, sql } from 'sdk/db';
import { users } from '../schema.js';
import { SWEEP_LIMIT } from './config.js';
import { getCurrentTime, currentMinute, nowSec, findZone, DEFAULT_TZ } from './time.js';

export const DEFAULT_NAME_FORMAT = '{name} | 🕒 {time}';
export const DEFAULT_BIO_FORMAT = '🕒 {date} {time} | {name}';

// Ulanish endi yaroqsiz — uni o'chirib qo'yamiz
const DEAD_CONNECTION = /BUSINESS_CONNECTION_INVALID|BUSINESS_CONNECTION_NOT_ALLOWED|business connection not found|BOT_BUSINESS_MISSING/i;

export const isPremium = (u) => Boolean(u) && u.premiumUntil > nowSec();

export function getUser(tgId) {
  return db.select().from(users).where(eq(users.tgId, tgId)).get();
}

export async function getOrCreateUser(from) {
  await db.insert(users)
    .values({ tgId: from.id, firstName: from.first_name ?? null })
    .onConflictDoNothing({ target: users.tgId })
    .run();
  return getUser(from.id);
}

export async function saveConnection(owner, connectionId, rights) {
  // Shu ulanish boshqa qatorda qolgan bo'lsa — tozalaymiz
  await db.run(sql`UPDATE users SET connection_id = NULL
    WHERE connection_id = ${connectionId} AND tg_id != ${owner.id}`);
  const values = {
    tgId: owner.id,
    firstName: owner.first_name ?? null,
    connectionId,
    canEditName: rights ? Boolean(rights.can_edit_name) : true,
    canEditBio: rights ? Boolean(rights.can_edit_bio) : true,
    lastName: null,
    lastBio: null,
    lastError: null,
    lastMinute: 0,
  };
  const { tgId, ...set } = values;
  if (!owner.first_name) delete set.firstName;
  await db.insert(users).values(values)
    .onConflictDoUpdate({ target: users.tgId, set })
    .run();
}

export async function dropConnection(tgId) {
  await db.update(users).set({ connectionId: null }).where(eq(users.tgId, tgId)).run();
}

function applyFormat(format, name, t) {
  return format
    .replaceAll('{name}', name)
    .replaceAll('{time}', t.time)
    .replaceAll('{date}', t.date)
    .replaceAll('{full}', t.full)
    .replaceAll('{weekday}', t.weekday)
    .trim();
}

// Telegram cheklovlari: ism 1–64, bio 0–140 belgi
const clip = (s, max) => Array.from(s).slice(0, max).join('');

// Premium tugasa: bio, o'z formati va Premium mintaqalar avtomatik o'chadi.
export function effectiveSettings(u) {
  const premium = isPremium(u);
  const zone = findZone(u.timeZone);
  return {
    timeZone: zone && (!zone.premium || premium) ? zone.tz : DEFAULT_TZ,
    clock: Boolean(u.clockEnabled),
    bio: Boolean(u.clockEnabled && u.bioEnabled && premium),
    nameFormat: (premium && u.nameFormat) || DEFAULT_NAME_FORMAT,
    bioFormat: (premium && u.bioFormat) || DEFAULT_BIO_FORMAT,
  };
}

// Kerakli ism/bio ni hisoblab, faqat o'zgarganini Telegramga yuboradi.
// DB ga yoziladigan maydonlarni qaytaradi.
export async function syncProfile(u, ms = Date.now()) {
  if (!u.connectionId) return null;
  const s = effectiveSettings(u);
  const t = getCurrentTime(s.timeZone, ms);
  const name = u.firstName || 'User';

  const wantName = clip(s.clock ? applyFormat(s.nameFormat, name, t) || name : name, 64);
  const wantBio = s.bio ? clip(applyFormat(s.bioFormat, name, t), 140) : '';

  const out = { lastName: u.lastName, lastBio: u.lastBio, lastError: null };
  let dead = false;

  const call = async (method, params) => {
    try {
      await api[method]({ business_connection_id: u.connectionId, ...params });
      return true;
    } catch (e) {
      const desc = e instanceof BotApiError ? e.description : String(e?.message || e);
      out.lastError = out.lastError || `${method}: ${desc}`;
      if (DEAD_CONNECTION.test(desc)) dead = true;
      return false;
    }
  };

  // Bot hech narsa o'rnatmagan bo'lsa (last* = null), foydalanuvchi ismi/biosiga tegmaymiz
  if (wantName !== u.lastName && (s.clock || u.lastName !== null) && u.canEditName) {
    if (await call('setBusinessAccountName', { first_name: wantName })) out.lastName = wantName;
  }
  if (!dead && wantBio !== (u.lastBio ?? '') && u.canEditBio) {
    if (await call('setBusinessAccountBio', { bio: wantBio })) out.lastBio = wantBio;
  }
  if (dead) out.connectionId = null;
  return out;
}

export async function refreshProfile(tgId) {
  const u = await getUser(tgId);
  if (!u?.connectionId) return;
  const out = await syncProfile(u);
  if (out) await db.update(users).set({ ...out, lastMinute: currentMinute() }).where(eq(users.tgId, tgId)).run();
}

// Shu daqiqada hali yangilanmagan profillarni olib (atomar "band qilish"), yangilaydi.
// Bir vaqtda ishlayotgan bir nechta chaqiruv bitta foydalanuvchini ikki marta olmaydi.
// Soat yoqilganlar + soat o'chirilgan, lekin ism/bio hali tiklanmaganlar.
const DUE = sql`connection_id IS NOT NULL AND (
  (clock_enabled = 1 AND (can_edit_name = 1 OR can_edit_bio = 1))
  OR (last_name IS NOT NULL AND last_name != COALESCE(first_name, 'User') AND can_edit_name = 1)
  OR (last_bio IS NOT NULL AND last_bio != '' AND can_edit_bio = 1))`;

export async function sweep(limit = SWEEP_LIMIT) {
  const minute = currentMinute();
  const { rows: claimed } = await db.run(sql`
    UPDATE users SET last_minute = ${minute}
    WHERE id IN (
      SELECT id FROM users WHERE ${DUE} AND last_minute < ${minute}
      ORDER BY last_minute LIMIT ${limit}
    )
    RETURNING id`);
  if (!claimed.length) return 0;

  let done = 0;
  for (const { id } of claimed) {
    const u = await db.select().from(users).where(eq(users.id, id)).get();
    if (!u) continue;
    try {
      const out = await syncProfile(u);
      if (out && (out.lastName !== u.lastName || out.lastBio !== u.lastBio ||
          out.lastError !== u.lastError || out.connectionId === null)) {
        await db.update(users).set(out).where(eq(users.id, id)).run();
      }
      done++;
    } catch (e) {
      console.error('sweep', id, e);
    }
  }
  return done;
}

// Shu daqiqada yangilanishi kerak bo'lgan, hali yangilanmaganlar soni
export async function dueCount() {
  const row = await db.get(sql`SELECT count(*) AS n FROM users WHERE ${DUE} AND last_minute < ${currentMinute()}`);
  return row?.n ?? 0;
}

// Har bir handler oxirida chaqiriladi: kelgan update'dan "soat" sifatida foydalanamiz.
export async function wake() {
  try {
    await sweep();
  } catch (e) {
    console.error('wake sweep', e);
  }
}
