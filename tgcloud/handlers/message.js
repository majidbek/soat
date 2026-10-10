import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { ADMIN_IDS } from '../lib/config.js';
import { getOrCreateUser, isPremium, refreshProfile, wake, DEFAULT_NAME_FORMAT, DEFAULT_BIO_FORMAT } from '../lib/users.js';
import { sendMenu } from '../lib/menu.js';
import { sendPremiumOffer, handleSuccessfulPayment } from '../lib/premium.js';
import { sendStats, refund } from '../lib/admin.js';

const FORMAT_HELP =
  "O'zgaruvchilar: {name} {time} {date} {full} {weekday}\n" +
  'Misol: /nameformat {name} ⏰ {time}\n' +
  "Standartga qaytarish: /nameformat reset";

async function setFormat(message, user, field, text) {
  if (!isPremium(user)) return sendPremiumOffer(message.chat.id);
  const value = text.trim();
  const max = field === 'nameFormat' ? 64 : 140;
  if (!value) {
    const current = user[field] || (field === 'nameFormat' ? DEFAULT_NAME_FORMAT : DEFAULT_BIO_FORMAT);
    return api.sendMessage({ chat_id: message.chat.id, text: `Joriy format: ${current}\n\n${FORMAT_HELP}` });
  }
  if (value !== 'reset' && Array.from(value).length > max) {
    return api.sendMessage({ chat_id: message.chat.id, text: `Format ${max} belgidan oshmasin.` });
  }
  await db.update(users).set({ [field]: value === 'reset' ? null : value }).where(eq(users.tgId, user.tgId)).run();
  await refreshProfile(user.tgId);
  await api.sendMessage({ chat_id: message.chat.id, text: value === 'reset' ? '✅ Standart format tiklandi.' : '✅ Format saqlandi.' });
}

async function handle(message) {
  if (message.chat.type !== 'private' || !message.from) return;

  if (message.successful_payment) return handleSuccessfulPayment(message);

  const text = (message.text || '').trim();
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split('@')[0];
  const arg = text.slice(cmdRaw.length).trim();

  if (ADMIN_IDS.includes(message.from.id)) {
    if (cmd === '/stats') return sendStats(message.chat.id);
    if (cmd === '/refund') return refund(message.chat.id, rest[0]);
  }

  const user = await getOrCreateUser(message.from);
  if (cmd === '/premium') return sendPremiumOffer(message.chat.id);
  if (cmd === '/nameformat') return setFormat(message, user, 'nameFormat', arg);
  if (cmd === '/bioformat') return setFormat(message, user, 'bioFormat', arg);
  return sendMenu(message.chat.id, user);
}

export default async function (message) {
  try {
    await handle(message);
  } finally {
    await wake();
  }
}
