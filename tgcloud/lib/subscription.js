import { api } from 'sdk';
import { ADMIN_IDS, REQUIRED_CHANNEL } from './config.js';
import { kvSet } from './kv.js';
import { nowSec } from './time.js';

const MEMBER = new Set(['creator', 'administrator', 'member']);

// true — obuna bo'lgan (yoki tekshiruv o'chiq / admin).
// Bot kanalda admin bo'lmasa Telegram xato qaytaradi: bunda botni to'xtatmaymiz
// (true), xatoni /stats da ko'rsatish uchun saqlaymiz.
export async function isSubscribed(userId) {
  if (!REQUIRED_CHANNEL || ADMIN_IDS.includes(userId)) return true;
  try {
    const m = await api.getChatMember({ chat_id: REQUIRED_CHANNEL.chatId, user_id: userId });
    return MEMBER.has(m.status) || (m.status === 'restricted' && m.is_member === true);
  } catch (e) {
    const desc = e?.description || String(e?.message || e);
    console.warn('getChatMember', desc);
    await kvSet('sub_error', `${nowSec()}|${desc}`).catch(() => {});
    return true;
  }
}

export function subscribeMessage() {
  return {
    text:
      "📢 Botdan foydalanish uchun kanalimizga obuna bo'ling, so'ng «✅ Tekshirish» tugmasini bosing.",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Kanalga o'tish", url: REQUIRED_CHANNEL.url }],
        [{ text: '✅ Tekshirish', callback_data: 'check_sub' }],
      ],
    },
  };
}
