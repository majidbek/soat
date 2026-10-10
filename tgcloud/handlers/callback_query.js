import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { getOrCreateUser, getUser, isPremium, refreshProfile, wake } from '../lib/users.js';
import { editMenu } from '../lib/menu.js';
import { sendPremiumOffer } from '../lib/premium.js';
import { TIMEZONES } from '../lib/time.js';

async function handle(cb) {
  const data = cb.data || '';
  const chatId = cb.message?.chat?.id ?? cb.from.id;
  const messageId = cb.message?.message_id;
  let user = await getOrCreateUser(cb.from);
  const premium = isPremium(user);
  const set = (fields) => db.update(users).set(fields).where(eq(users.tgId, user.tgId)).run();

  let alert = '';
  let toast = '';
  let showTimezones = false;

  if (data === 'toggle_clock') {
    const on = !user.clockEnabled;
    await set({ clockEnabled: on });
    await refreshProfile(user.tgId);
    alert = on ? '✅ Soat yoqildi' : "❌ Soat o'chirildi";
    if (on && !user.connectionId) alert += '\n\nAvval akkauntni botga ulang (Telegram Business).';
  } else if (data === 'toggle_bio') {
    if (!premium) {
      await sendPremiumOffer(chatId);
      toast = '⭐ Biodagi soat — Premium imkoniyati';
    } else {
      const on = !user.bioEnabled;
      await set({ bioEnabled: on });
      await refreshProfile(user.tgId);
      alert = on ? '✅ Bio yoqildi' : "❌ Bio o'chirildi";
      if (on && !user.clockEnabled) alert += "\n\nBio ishlashi uchun «Ismga» ham yoqilgan bo'lishi kerak.";
    }
  } else if (data === 'buy_premium') {
    await sendPremiumOffer(chatId);
  } else if (data === 'show_tz') {
    showTimezones = true;
  } else if (data.startsWith('tz_')) {
    showTimezones = true;
    const zone = TIMEZONES[Number(data.slice(3))];
    if (zone && zone.premium && !premium) {
      toast = '⭐ Bu mintaqa — Premium uchun';
      await sendPremiumOffer(chatId);
    } else if (zone) {
      await set({ timeZone: zone.tz });
      await refreshProfile(user.tgId);
      toast = `✅ ${zone.label}`;
    }
  }

  user = await getUser(user.tgId);
  if (messageId) await editMenu(chatId, messageId, user, showTimezones);
  await api.answerCallbackQuery({
    callback_query_id: cb.id,
    text: alert || toast,
    show_alert: Boolean(alert),
  });
}

export default async function (cb) {
  try {
    await handle(cb);
  } finally {
    await wake();
  }
}
