import { EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { beat } from '../lib/heartbeat.js';

// Heartbeat zanjiri: faqat bot o'zi (admin nomidan imzolangan initData bilan) chaqiradi.
export default async function (input, ctx) {
  if (!ADMIN_IDS.includes(ctx.initData?.user?.id)) {
    throw new EndpointError('Ruxsat yo\'q', { code: 'FORBIDDEN' });
  }
  return beat(input || {});
}
