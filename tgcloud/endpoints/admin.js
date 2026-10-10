import { EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { getCurrentTime } from '../lib/time.js';
import { dueCount } from '../lib/users.js';

// Diagnostika: GitHub Actions har deploy'dan keyin `tgcloud run endpoints/admin` bilan chaqiradi.
export default async function (input, ctx) {
  if (!ADMIN_IDS.includes(ctx.initData?.user?.id)) {
    throw new EndpointError("Ruxsat yo'q", { code: 'FORBIDDEN' });
  }
  return {
    timers: typeof setTimeout === 'function',
    tashkent: getCurrentTime('Asia/Tashkent').full,
    newYork: getCurrentTime('America/New_York').full,
    due: await dueCount(),
  };
}
