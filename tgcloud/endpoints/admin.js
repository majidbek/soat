import { EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { kvSet, getStatus, hasTimers } from '../lib/heartbeat.js';
import { getCurrentTime } from '../lib/time.js';
import { dueCount } from '../lib/users.js';

// GitHub Actions `tgcloud run endpoints/admin` orqali chaqiradi.
export default async function (input, ctx) {
  if (!ADMIN_IDS.includes(ctx.initData?.user?.id)) {
    throw new EndpointError('Ruxsat yo\'q', { code: 'FORBIDDEN' });
  }
  if (input.action === 'setToken') {
    if (!/^\d+:[\w-]{30,}$/.test(input.token || '')) throw new EndpointError('Token formati noto\'g\'ri', { code: 'BAD_TOKEN' });
    await kvSet('bot_token', input.token);
    return { saved: true };
  }
  // Diagnostika: runtime imkoniyatlari
  return {
    timers: hasTimers(),
    intl: typeof Intl !== 'undefined',
    tashkent: getCurrentTime('Asia/Tashkent').full,
    newYork: getCurrentTime('America/New_York').full,
    due: await dueCount(),
    heartbeat: await getStatus(),
  };
}
