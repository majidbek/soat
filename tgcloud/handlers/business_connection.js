import { api } from 'sdk';
import { saveConnection, dropConnection, refreshProfile, wake } from '../lib/users.js';

// Akkaunt botga ulandi, uzildi yoki ruxsatlari o'zgardi.
export default async function (bc) {
  try {
    const owner = bc.user;
    if (!bc.id || !owner?.id) return;

    if (bc.is_enabled === false) {
      await dropConnection(owner.id);
      return;
    }
    await saveConnection(owner, bc.id, bc.rights);
    await refreshProfile(owner.id);

    const r = bc.rights;
    const ok = !r || (r.can_edit_name && r.can_edit_bio);
    await api.sendMessage({
      chat_id: bc.user_chat_id ?? owner.id,
      text: ok
        ? '✅ Akkaunt ulandi! /menu orqali soatni yoqing.'
        : "⚠️ Bot ulandi, lekin «Ismni o'zgartirish» va «Bioni o'zgartirish» ruxsatlari kerak. " +
          "Sozlamalar → Telegram Business → Chatbotlar bo'limida ularni yoqing.",
    }).catch(() => {});
  } finally {
    await wake();
  }
}
