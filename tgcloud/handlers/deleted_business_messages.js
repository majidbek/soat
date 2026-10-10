import { onBusinessUpdate } from '../lib/business.js';

export default async function (deleted) {
  await onBusinessUpdate(deleted.business_connection_id);
}
