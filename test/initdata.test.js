import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sha256, hmacSha256, signInitData } from '../tgcloud/lib/initdata.js';

const hex = (b) => Buffer.from(b).toString('hex');

test('sha256 matches node crypto', () => {
  for (const s of ['', 'abc', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'ш🕒'.repeat(100)]) {
    assert.equal(hex(sha256(s)), crypto.createHash('sha256').update(s).digest('hex'));
  }
});

test('hmac matches node crypto', () => {
  const key = 'k'.repeat(100);
  assert.equal(hex(hmacSha256(key, 'msg')), crypto.createHmac('sha256', key).update('msg').digest('hex'));
});

test('initData validates like Telegram does', () => {
  const token = '123456:TEST-token';
  const raw = signInitData(token, { id: 42, first_name: 'hb' }, 1700000000);
  const p = new URLSearchParams(raw);
  const hash = p.get('hash');
  p.delete('hash');
  const check = [...p.keys()].sort().map((k) => `${k}=${p.get(k)}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  assert.equal(crypto.createHmac('sha256', secret).update(check).digest('hex'), hash);
});
