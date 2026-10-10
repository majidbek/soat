import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users, payments } from '../schema.js';
import { PRODUCTS } from './products.js';
import { getUser, refreshProfile } from './users.js';
import { nowSec } from './time.js';

// Stars obunasi uchun to'lov havolasini chatga yuboradi.
export async function sendPremiumOffer(chatId) {
  const p = PRODUCTS.premium;
  const link = await api.createInvoiceLink({
    title: p.title,
    description: p.description,
    payload: JSON.stringify({ product: 'premium' }),
    currency: 'XTR',
    prices: [{ label: p.title, amount: p.stars }],
    subscription_period: p.subscriptionPeriod,
  });
  await api.sendMessage({
    chat_id: chatId,
    parse_mode: 'HTML',
    text:
      `⭐ <b>${p.title}</b> — ${p.stars} ⭐/oy\n\n` +
      '• Biodagi soat\n' +
      "• O'z formatingiz: /nameformat, /bioformat\n" +
      "• 12 ta qo'shimcha vaqt mintaqasi\n\n" +
      "Obuna har oy avtomatik yangilanadi, Telegram sozlamalaridan istalgan vaqtda bekor qilinadi.",
    reply_markup: { inline_keyboard: [[{ text: `⭐ ${p.stars} Stars bilan olish`, url: link }]] },
  });
}

// message.successful_payment — birinchi to'lov ham, har oylik yangilanish ham.
export async function handleSuccessfulPayment(message) {
  const p = message.successful_payment;
  let product = 'premium';
  try { product = JSON.parse(p.invoice_payload).product || product; } catch {}

  const inserted = await db.insert(payments).values({
    tgId: message.from.id,
    product,
    stars: p.total_amount,
    chargeId: p.telegram_payment_charge_id,
    recurring: Boolean(p.is_recurring),
  }).onConflictDoNothing({ target: payments.chargeId }).run();
  if (!inserted.rowsAffected) return; // takroriy update

  const u = await getUser(message.from.id);
  const base = Math.max(nowSec(), u?.premiumUntil || 0);
  const until = p.subscription_expiration_date || base + PRODUCTS.premium.subscriptionPeriod;
  await db.update(users).set({ premiumUntil: until }).where(eq(users.tgId, message.from.id)).run();
  await refreshProfile(message.from.id);

  const renewal = p.is_recurring && !p.is_first_recurring;
  await api.sendMessage({
    chat_id: message.chat.id,
    text: renewal
      ? `✨ Premium yangilandi (${p.total_amount} ⭐). Rahmat!`
      : `Rahmat! ${p.total_amount} ⭐ qabul qilindi. ✨ Premium faollashtirildi.\n\n/menu — bioni yoqing, /nameformat — o'z formatingiz.`,
  });
}
