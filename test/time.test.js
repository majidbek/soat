import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIMEZONES, _fallbackParts } from '../tgcloud/lib/time.js';

// Zaxira (Intl'siz) hisob Intl bilan 2026–2027 yillar davomida har 30 daqiqada mos kelishi kerak
test('fallback offsets match Intl for every zone', () => {
  const bad = [];
  for (const { tz } of TIMEZONES) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', hourCycle: 'h23' });
    for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2028, 0, 1); ms += 30 * 60000) {
      const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
      const q = _fallbackParts(tz, ms);
      if (p.hour !== q.hour || p.minute !== q.minute || p.day !== q.day) { bad.push(`${tz} ${new Date(ms).toISOString()}`); break; }
    }
  }
  assert.deepEqual(bad, []);
});
