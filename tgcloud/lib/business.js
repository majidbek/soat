import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { saveConnection, wake } from './users.js';
import { kick } from './heartbeat.js';

// Business xabarlar: javob bermaymiz (chat.id — mijozniki), faqat
// noma'lum ulanish egasini aniqlaymiz va update'dan "soat" sifatida foydalanamiz.
export async function onBusinessUpdate(connectionId) {
  try {
    if (!connectionId) return;
    const known = await db.select({ id: users.id }).from(users).where(eq(users.connectionId, connectionId)).get();
    if (known) return;
    const bc = await api.getBusinessConnection({ business_connection_id: connectionId });
    if (bc?.is_enabled && bc.user?.id) await saveConnection(bc.user, connectionId, bc.rights);
  } catch (e) {
    console.warn('business update', e?.description || e);
  } finally {
    await wake();
    await kick().catch(() => {});
  }
}
