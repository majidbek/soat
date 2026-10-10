import { api } from 'sdk';
import { TIMEZONES, getCurrentTime } from './time.js';
import { isPremium, effectiveSettings } from './users.js';
import { PRODUCTS } from './products.js';

const fmtDate = (sec) => {
  const d = new Date(sec * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function menuText(u) {
  const s = effectiveSettings(u);
  const t = getCurrentTime(s.timeZone);
  const premium = isPremium(u);
  let text =
    '🕒 <b>Soatli Profil</b>\n\n' +
    `Profilga ulanish: ${u.connectionId ? '✅ Bor' : "❌ Yo'q"}\n` +
    `Vaqt mintaqasi: ${s.timeZone}\n` +
    `Premium: ${premium ? `✨ ${fmtDate(u.premiumUntil)} gacha` : "yo'q"}\n\n` +
    `📅 ${t.date}  🕐 ${t.time}`;

  if (!u.connectionId) {
    text +=
      "\n\n<i>Ulash: Sozlamalar → Telegram Business → Chatbotlar → botni qo'shing va " +
      "«Ismni o'zgartirish» hamda «Bioni o'zgartirish» ruxsatlarini yoqing.</i>";
  } else if (!u.canEditName || !u.canEditBio) {
    text += "\n\n⚠️ <i>Botga «Ismni o'zgartirish» va «Bioni o'zgartirish» ruxsatlarini bering.</i>";
  }
  if (u.lastError) text += `\n\n⚠️ Oxirgi xato: <code>${esc(u.lastError.slice(0, 200))}</code>`;
  if (premium) {
    text += '\n\n✏️ Format: /nameformat va /bioformat';
  }
  return text;
}

export function mainKeyboard(u) {
  const premium = isPremium(u);
  const rows = [
    [
      { text: `${u.clockEnabled ? '✅' : '☑️'} Ismga`, callback_data: 'toggle_clock' },
      { text: `${u.bioEnabled && premium ? '✅' : '☑️'} Bioga${premium ? '' : ' ⭐'}`, callback_data: 'toggle_bio' },
    ],
    [{ text: '🌍 Vaqt mintaqasi', callback_data: 'show_tz' }],
  ];
  if (!premium) rows.push([{ text: `⭐ Premium — ${PRODUCTS.premium.stars} ⭐/oy`, callback_data: 'buy_premium' }]);
  if (!u.connectionId) rows.push([{ text: '🔗 Akkauntga ulash', url: 'tg://settings' }]);
  return { inline_keyboard: rows };
}

export function timezoneKeyboard(u) {
  const premium = isPremium(u);
  const current = effectiveSettings(u).timeZone;
  const rows = [];
  for (let i = 0; i < TIMEZONES.length; i += 2) {
    rows.push(TIMEZONES.slice(i, i + 2).map((z, j) => ({
      text: `${current === z.tz ? '✅ ' : ''}${z.label}${z.premium && !premium ? ' ⭐' : ''}`,
      callback_data: `tz_${i + j}`,
    })));
  }
  rows.push([{ text: '🔙 Orqaga', callback_data: 'back' }]);
  return { inline_keyboard: rows };
}

export async function sendMenu(chatId, u) {
  await api.sendMessage({
    chat_id: chatId,
    text: menuText(u),
    parse_mode: 'HTML',
    reply_markup: mainKeyboard(u),
  });
}

export async function editMenu(chatId, messageId, u, showTimezones = false) {
  try {
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: menuText(u),
      parse_mode: 'HTML',
      reply_markup: showTimezones ? timezoneKeyboard(u) : mainKeyboard(u),
    });
  } catch (e) {
    // "message is not modified" — zararsiz
    if (e?.code !== 400) throw e;
  }
}
