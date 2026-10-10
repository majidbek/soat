import { EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';

// Heartbeat auth usulini aniqlash uchun.
export default async function (input, ctx) {
  if (!ADMIN_IDS.includes(ctx.initData?.user?.id)) {
    throw new EndpointError('Ruxsat yo\'q', { code: 'FORBIDDEN' });
  }
  return { pong: true };
}
