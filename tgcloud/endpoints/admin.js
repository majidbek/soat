import { api, EndpointError } from 'sdk';
import { ADMIN_IDS, REQUIRED_CHANNEL } from '../lib/config.js';
import { getCurrentTime } from '../lib/time.js';
import { dueCount } from '../lib/users.js';

// Diagnostika: GitHub Actions har deploy'dan keyin `tgcloud run endpoints/admin` bilan chaqiradi.
export default async function (input, ctx) {
  if (!ADMIN_IDS.includes(ctx.initData?.user?.id)) {
    throw new EndpointError("Ruxsat yo'q", { code: 'FORBIDDEN' });
  }
  // Bot majburiy obuna kanalida admin bo'lishi kerak
  let channel = null;
  if (REQUIRED_CHANNEL) {
    try {
      const me = await api.getMe();
      const m = await api.getChatMember({ chat_id: REQUIRED_CHANNEL.chatId, user_id: me.id });
      channel = m.status;
    } catch (e) {
      channel = `ERROR: ${e?.description || e?.message || e}`;
    }
  }
  return {
    channel,
    timers: typeof setTimeout === 'function',
    tashkent: getCurrentTime('Asia/Tashkent').full,
    newYork: getCurrentTime('America/New_York').full,
    due: await dueCount(),
  };
}
