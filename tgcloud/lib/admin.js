import { api, db } from 'sdk';
import { and, eq, desc, sql } from 'sdk/db';
import { users, payments } from '../schema.js';
import { refreshProfile } from './users.js';
import { kvGet, kvSet, getStatus, probe, kick, hasTimers } from './heartbeat.js';
import { getCurrentTime, currentMinute } from './time.js';

// /stats — foydalanuvchilar, Premium, tushum va heartbeat holati.
export async function sendStats(chatId) {
  const u = await db.get(sql`
    SELECT count(*) AS total,
      sum(connection_id IS NOT NULL) AS connected,
      sum(connection_id IS NOT NULL AND clock_enabled = 1) AS active,
      sum(premium_until > unixepoch()) AS premium,
      sum(last_error IS NOT NULL) AS errors
    FROM users`);
  const all = await db.get(sql`SELECT count(*) AS n, coalesce(sum(stars), 0) AS stars FROM payments WHERE refunded = 0`);
  const month = await db.get(sql`SELECT count(*) AS n, coalesce(sum(stars), 0) AS stars FROM payments
    WHERE refunded = 0 AND created_at >= unixepoch('now', 'start of month')`);
  const lag = await db.get(sql`SELECT max(${currentMinute()} - last_minute) AS lag FROM users
    WHERE connection_id IS NOT NULL AND clock_enabled = 1`);
  const hb = await getStatus();
  const hbMinute = Number((await kvGet('hb_minute')) || 0);

  await api.sendMessage({
    chat_id: chatId,
    text:
      '📊 Statistika\n\n' +
      `Foydalanuvchilar: ${u.total}\n` +
      `Ulangan: ${u.connected ?? 0}, soat yoqilgan: ${u.active ?? 0}\n` +
      `Premium: ${u.premium ?? 0}\n` +
      `Xatoli profillar: ${u.errors ?? 0}\n` +
      `Eng katta kechikish: ${lag?.lag ?? 0} daq\n\n` +
      `Shu oy: ${month.n} to'lov, ${month.stars} ⭐\n` +
      `Jami: ${all.n} to'lov, ${all.stars} ⭐\n\n` +
      `💓 Heartbeat: ${(await kvGet('hb_enabled')) === '1' ? 'yoqilgan' : "o'chiq"}, ` +
      `setTimeout: ${hasTimers() ? 'bor' : "yo'q"}\n` +
      `Oxirgi beat: ${hbMinute ? `${currentMinute() - hbMinute} daq oldin` : "hali yo'q"}\n` +
      (hb.fireError ? `Xato: ${hb.fireError}\n` : '') +
      (hb.kickError ? `Kick xato: ${hb.kickError}\n` : '') +
      `Server vaqti (Toshkent): ${getCurrentTime().full}`,
  });
}

// /refund <charge_id> — Stars'ni qaytaradi, obunani bekor qiladi va Premium'ni o'chiradi.
export async function refund(chatId, chargeId) {
  if (!chargeId) {
    const last = await db.select().from(payments)
      .where(eq(payments.refunded, false))
      .orderBy(desc(payments.id))
      .limit(5)
      .all();
    const lines = last.map((p) => `${p.stars} ⭐ · user ${p.tgId}\n/refund ${p.chargeId}`);
    await api.sendMessage({
      chat_id: chatId,
      text: lines.length ? `Oxirgi to'lovlar:\n\n${lines.join('\n\n')}` : "To'lovlar yo'q.",
    });
    return;
  }

  const p = await db.select().from(payments)
    .where(and(eq(payments.chargeId, chargeId), eq(payments.refunded, false)))
    .get();
  if (!p) {
    await api.sendMessage({ chat_id: chatId, text: "Bunday to'lov topilmadi yoki allaqachon qaytarilgan." });
    return;
  }

  try {
    await api.editUserStarSubscription({ user_id: p.tgId, telegram_payment_charge_id: p.chargeId, is_canceled: true });
  } catch (e) {
    console.warn('cancel subscription', e?.description || e);
  }
  await api.refundStarPayment({ user_id: p.tgId, telegram_payment_charge_id: p.chargeId });
  await db.update(payments).set({ refunded: true }).where(eq(payments.id, p.id)).run();
  await db.update(users).set({ premiumUntil: 0 }).where(eq(users.tgId, p.tgId)).run();
  await refreshProfile(p.tgId);
  await api.sendMessage({ chat_id: chatId, text: `Qaytarildi: ${p.stars} ⭐ → user ${p.tgId}. Premium o'chirildi.` });
}

// /hb, /hb on, /hb off — heartbeat tajribasini boshqarish.
export async function heartbeatCommand(chatId, arg) {
  if (arg === 'off') {
    await kvSet('hb_enabled', '0');
    await api.sendMessage({ chat_id: chatId, text: "💓 Heartbeat o'chirildi. Soat faqat update kelganda yangilanadi." });
    return;
  }
  if (arg === 'on') {
    if (!hasTimers()) {
      await api.sendMessage({ chat_id: chatId, text: "❌ Platformada setTimeout yo'q — heartbeat ishlay olmaydi." });
      return;
    }
    const r = await probe();
    if (!r.ok) {
      await api.sendMessage({ chat_id: chatId, text: `❌ O'zini chaqirib bo'lmadi: ${r.error}` });
      return;
    }
    await kvSet('hb_enabled', '1');
    await kick(true);
    await api.sendMessage({ chat_id: chatId, text: `💓 Heartbeat yoqildi (auth usuli #${r.style}). 2–3 daqiqadan keyin /stats ni tekshiring.` });
    return;
  }
  return sendStats(chatId);
}
