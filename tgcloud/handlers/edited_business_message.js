import { onBusinessUpdate } from '../lib/business.js';

export default async function (message) {
  await onBusinessUpdate(message.business_connection_id);
}
