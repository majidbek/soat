// Soatli Profil — Telegram Business bot (Cloudflare Workers + D1)
//
//   POST /webhook  — Telegram update'lari (X-Telegram-Bot-Api-Secret-Token bilan himoyalangan)
//   GET  /setup?secret=...  — webhook va bot buyruqlarini o'rnatadi
//   POST /cron     — ichki: foydalanuvchilar bo'lagini yangilash (SELF service binding)
//   scheduled      — har daqiqada barcha yoqilgan profillarni yangilaydi

const DEFAULT_TZ = 'Asia/Tashkent';

const TIMEZONES = [
  ['Asia/Tashkent', "🇺🇿 O'zbekiston"],
  ['Asia/Almaty', "🇰🇿 Qozog'iston"],
  ['Europe/Moscow', '🇷🇺 Rossiya'],
  ['Europe/London', '🇬🇧 Britaniya'],
  ['Europe/Berlin', '🇩🇪 Germaniya'],
  ['Europe/Istanbul', '🇹🇷 Turkiya'],
  ['Asia/Dubai', '🇦🇪 BAA'],
  ['Asia/Bishkek', "🇰🇬 Qirg'iziston"],
  ['Asia/Dushanbe', '🇹🇯 Tojikiston'],
  ['Asia/Ashgabat', '🇹🇲 Turkmaniston'],
  ['America/New_York', '🇺🇸 AQSh'],
  ['Asia/Tokyo', '🇯🇵 Yaponiya'],
];
const TZ_SET = new Set(TIMEZONES.map(([tz]) => tz));

const ALLOWED_UPDATES = ['message', 'callback_query', 'business_connection', 'business_message'];

// Bu xatolar ulanish endi yaroqsizligini bildiradi — ulanishni o'chirib qo'yamiz
const DEAD_CONNECTION_ERRORS = ['BUSINESS_CONNECTION_INVALID', 'BUSINESS_CONNECTION_NOT_ALLOWED', 'business connection not found'];

// ==================== HELPERS ====================

async function api(env, method, data = {}) {
  try {
    const res = await fetch(`${env.TELEGRAM_API || 'https://api.telegram.org'}/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

function getCurrentTime(tz = DEFAULT_TZ) {
  if (!TZ_SET.has(tz)) tz = DEFAULT_TZ;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      weekday: 'long',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const time = `${parts.hour}:${parts.minute}`;
  const date = `${parts.day}.${parts.month}.${parts.year}`;
  return { time, date, full: `${date} ${time}`, weekday: parts.weekday };
}

function applyFormat(format, name, t) {
  return (format || '')
    .replaceAll('{name}', name)
    .replaceAll('{time}', t.time)
    .replaceAll('{date}', t.date)
    .replaceAll('{full}', t.full)
    .replaceAll('{weekday}', t.weekday)
    .trim();
}

// Telegram cheklovlari: ism 1–64, bio 0–140 belgi
const clip = (s, max) => Array.from(s).slice(0, max).join('');

async function getUser(env, telegramId) {
  return env.DB.prepare('SELECT * FROM business_users WHERE telegram_id = ?').bind(telegramId).first();
}

async function ensureUser(env, from) {
  await env.DB.prepare('INSERT OR IGNORE INTO business_users (telegram_id, original_name) VALUES (?, ?)')
    .bind(from.id, from.first_name ?? null).run();
}

async function saveBusinessConnection(env, telegramId, connectionId, name) {
  await env.DB.batch([
    env.DB.prepare('UPDATE business_users SET business_connection_id = NULL WHERE business_connection_id = ? AND telegram_id != ?')
      .bind(connectionId, telegramId),
    env.DB.prepare(`
      INSERT INTO business_users (telegram_id, business_connection_id, original_name)
      VALUES (?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        business_connection_id = excluded.business_connection_id,
        original_name = COALESCE(excluded.original_name, original_name),
        last_name = NULL, last_bio = NULL, last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).bind(telegramId, connectionId, name ?? null),
  ]);
}

// Profilni hisoblaydi va faqat o'zgargan qismini Telegramga yuboradi.
// Natija: DB ga yoziladigan qiymatlar.
async function updateBusinessProfile(env, user) {
  const connId = user.business_connection_id;
  if (!connId) return null;

  const t = getCurrentTime(user.time_zone);
  const name = user.original_name || 'User';

  const formatted = clip(applyFormat(user.username_format || '{name}', name, t) || name, 64);
  const wantName = user.clock_enabled ? formatted : clip(name, 64);
  const wantBio = user.clock_enabled && user.bio_enabled ? clip(applyFormat(user.bio_format, name, t), 140) : '';

  let lastName = user.last_name;
  let lastBio = user.last_bio;
  let error = null;

  // Bot hech narsa o'rnatmagan bo'lsa (last_* = NULL) foydalanuvchi ismi/biosiga tegmaymiz
  if (wantName !== lastName && (user.clock_enabled || lastName !== null)) {
    const r = await api(env, 'setBusinessAccountName', { business_connection_id: connId, first_name: wantName });
    if (r.ok) lastName = wantName;
    else error = `name: ${r.description}`;
  }
  if (wantBio !== (lastBio ?? '')) {
    const r = await api(env, 'setBusinessAccountBio', { business_connection_id: connId, bio: wantBio });
    if (r.ok) lastBio = wantBio;
    else error = error || `bio: ${r.description}`;
  }

  const dead = error && DEAD_CONNECTION_ERRORS.some((e) => error.includes(e));
  return { telegram_id: user.telegram_id, lastName, lastBio, error, dead };
}

function saveProfileResult(env, r) {
  if (r.dead) {
    return env.DB.prepare('UPDATE business_users SET business_connection_id = NULL, last_error = ? WHERE telegram_id = ?')
      .bind(r.error, r.telegram_id);
  }
  return env.DB.prepare('UPDATE business_users SET last_name = ?, last_bio = ?, last_error = ? WHERE telegram_id = ?')
    .bind(r.lastName ?? null, r.lastBio ?? null, r.error, r.telegram_id);
}

async function refreshProfile(env, telegramId) {
  const user = await getUser(env, telegramId);
  if (!user?.business_connection_id) return;
  const r = await updateBusinessProfile(env, user);
  if (r) await saveProfileResult(env, r).run();
}

// ==================== MENU ====================

function buildMenuText(user) {
  const tz = user?.time_zone || DEFAULT_TZ;
  const t = getCurrentTime(tz);
  const conn = user?.business_connection_id ? '✅ Bor' : "❌ Yo'q";
  let text =
    '🕒 <b>Soatli Profil</b>\n\n' +
    `Profilga ulanish: ${conn}\n` +
    `Vaqt mintaqasi: ${tz}\n\n` +
    `📅 ${t.date}  🕐 ${t.time}`;
  if (!user?.business_connection_id) {
    text +=
      '\n\n<i>Ulash: Sozlamalar → Telegram Business → Chatbotlar → botni qo\'shing ' +
      'va «Ismni o\'zgartirish» hamda «Bioni o\'zgartirish» ruxsatlarini yoqing.</i>';
  }
  return text;
}

function mainKeyboard(user) {
  const clockIcon = user?.clock_enabled ? '✅' : '☑️';
  const bioIcon = user?.bio_enabled ? '✅' : '☑️';
  const rows = [
    [
      { text: `${clockIcon} Ismga`, callback_data: 'toggle_clock' },
      { text: `${bioIcon} Bioga`, callback_data: 'toggle_bio' },
    ],
    [{ text: '🌍 Vaqt mintaqasi', callback_data: 'show_timezones' }],
  ];
  if (!user?.business_connection_id) {
    rows.push([{ text: '🔗 Akkauntga ulash', url: 'tg://settings' }]);
  }
  return { inline_keyboard: rows };
}

function timezoneKeyboard(currentTz) {
  const rows = [];
  for (let i = 0; i < TIMEZONES.length; i += 2) {
    rows.push(TIMEZONES.slice(i, i + 2).map(([tz, label]) => ({
      text: `${currentTz === tz ? '✅ ' : '☑️ '}${label}`,
      callback_data: `tz_${tz}`,
    })));
  }
  rows.push([{ text: '🔙 Orqaga', callback_data: 'back_main' }]);
  return { inline_keyboard: rows };
}

// ==================== UPDATE HANDLERS ====================

async function handleUpdate(env, update) {
  // Akkaunt botga ulandi / uzildi / ruxsatlar o'zgardi
  if (update.business_connection) {
    const bc = update.business_connection;
    const telegramId = bc.user?.id;
    if (!bc.id || !telegramId) return;

    if (bc.is_enabled === false) {
      await env.DB.prepare('UPDATE business_users SET business_connection_id = NULL WHERE telegram_id = ?')
        .bind(telegramId).run();
      return;
    }
    await saveBusinessConnection(env, telegramId, bc.id, bc.user.first_name);
    await refreshProfile(env, telegramId);

    const rights = bc.rights;
    if (rights && (!rights.can_edit_name || !rights.can_edit_bio)) {
      await api(env, 'sendMessage', {
        chat_id: bc.user_chat_id ?? telegramId,
        text: "⚠️ Bot ulandi, lekin «Ismni o'zgartirish» va «Bioni o'zgartirish» ruxsatlari kerak. " +
          'Sozlamalar → Telegram Business → Chatbotlar bo\'limida ularni yoqing.',
      });
    } else {
      await api(env, 'sendMessage', {
        chat_id: bc.user_chat_id ?? telegramId,
        text: '✅ Akkaunt ulandi! /menu orqali soatni yoqing.',
      });
    }
    return;
  }

  // Business xabarlar — faqat ulanish DB da bo'lmasa egasini aniqlaymiz.
  // (chat.id bu yerda mijozning ID si, egasiniki emas — unga javob bermaymiz.)
  if (update.business_message) {
    const connId = update.business_message.business_connection_id;
    if (!connId) return;
    const known = await env.DB.prepare('SELECT 1 FROM business_users WHERE business_connection_id = ?').bind(connId).first();
    if (known) return;
    const r = await api(env, 'getBusinessConnection', { business_connection_id: connId });
    if (r.ok && r.result?.is_enabled && r.result.user?.id) {
      await saveBusinessConnection(env, r.result.user.id, connId, r.result.user.first_name);
    }
    return;
  }

  if (update.message) {
    const msg = update.message;
    if (msg.chat?.type !== 'private' || !msg.from) return;
    const text = (msg.text || '').trim().split('@')[0];
    if (text === '/start' || text === '/menu') {
      await ensureUser(env, msg.from);
      const user = await getUser(env, msg.from.id);
      await api(env, 'sendMessage', {
        chat_id: msg.chat.id,
        text: buildMenuText(user),
        parse_mode: 'HTML',
        reply_markup: mainKeyboard(user),
      });
    }
    return;
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;
    const chatId = cb.message?.chat?.id ?? userId;
    const messageId = cb.message?.message_id;
    const data = cb.data || '';

    await ensureUser(env, cb.from);
    let user = await getUser(env, userId);
    let responseText = '';
    let showTimezones = false;

    if (data === 'toggle_clock') {
      const v = user.clock_enabled ? 0 : 1;
      await env.DB.prepare('UPDATE business_users SET clock_enabled = ? WHERE telegram_id = ?').bind(v, userId).run();
      responseText = v ? '✅ Soat yoqildi' : "❌ Soat o'chirildi";
      if (v && !user.business_connection_id) responseText += "\n\nAvval akkauntni botga ulang (Telegram Business).";
      await refreshProfile(env, userId);
    } else if (data === 'toggle_bio') {
      const v = user.bio_enabled ? 0 : 1;
      await env.DB.prepare('UPDATE business_users SET bio_enabled = ? WHERE telegram_id = ?').bind(v, userId).run();
      responseText = v ? '✅ Bio yoqildi' : "❌ Bio o'chirildi";
      if (v && !user.clock_enabled) responseText += "\n\nBio ishlashi uchun «Ismga» ham yoqilgan bo'lishi kerak.";
      await refreshProfile(env, userId);
    } else if (data === 'show_timezones') {
      showTimezones = true;
    } else if (data.startsWith('tz_')) {
      const tz = data.slice(3);
      if (TZ_SET.has(tz)) {
        await env.DB.prepare('UPDATE business_users SET time_zone = ? WHERE telegram_id = ?').bind(tz, userId).run();
        await refreshProfile(env, userId);
        responseText = "✅ Mintaqa o'zgartirildi!";
      }
      showTimezones = true;
    }

    user = await getUser(env, userId);
    if (messageId) {
      await api(env, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: buildMenuText(user),
        parse_mode: 'HTML',
        reply_markup: showTimezones ? timezoneKeyboard(user.time_zone) : mainKeyboard(user),
      });
    }
    await api(env, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: responseText,
      show_alert: responseText.length > 0 && !data.startsWith('tz_'),
    });
  }
}

// ==================== CRON ====================

// Soat yoqilganlar + soat o'chirilgan, lekin ism/bio hali tiklanmaganlar
const ACTIVE_WHERE = `business_connection_id IS NOT NULL AND (
  clock_enabled = 1
  OR (last_name IS NOT NULL AND last_name != COALESCE(original_name, 'User'))
  OR (last_bio IS NOT NULL AND last_bio != ''))`;

// Bitta bo'lakni yangilaydi (ketma-ket, Telegram limitlariga yumshoq)
async function runBatch(env, offset, limit) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM business_users WHERE ${ACTIVE_WHERE} ORDER BY telegram_id LIMIT ? OFFSET ?`,
  ).bind(limit, offset).all();

  const writes = [];
  let errors = 0;
  for (const user of results) {
    const r = await updateBusinessProfile(env, user);
    if (!r) continue;
    if (r.error) errors++;
    if (r.lastName !== user.last_name || r.lastBio !== user.last_bio || r.error !== user.last_error || r.dead) {
      writes.push(saveProfileResult(env, r));
    }
  }
  if (writes.length) await env.DB.batch(writes);
  return { processed: results.length, errors };
}

async function runUpdater(env) {
  const batchSize = Math.max(1, parseInt(env.BATCH_SIZE || '20', 10));
  const { n } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM business_users WHERE ${ACTIVE_WHERE}`).first();

  if (n <= batchSize || !env.SELF) {
    const r = await runBatch(env, 0, env.SELF ? batchSize : n);
    console.log(`cron: processed=${r.processed} errors=${r.errors}`);
    return;
  }

  // Har bir bo'lak alohida worker chaqiruvida — o'z subrequest limiti bilan
  const calls = [];
  for (let offset = 0; offset < n; offset += batchSize) {
    calls.push(env.SELF.fetch('https://internal/cron', {
      method: 'POST',
      headers: { 'X-Cron-Secret': env.WEBHOOK_SECRET || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset, limit: batchSize }),
    }));
  }
  const res = await Promise.allSettled(calls);
  console.log(`cron: total=${n} batches=${calls.length} failed=${res.filter((x) => x.status === 'rejected').length}`);
}

// ==================== ENTRY ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/webhook') {
      if (env.WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const update = await request.json().catch(() => null);
      if (update) {
        ctx.waitUntil(handleUpdate(env, update).catch((e) => console.error('update error', e?.stack || e)));
      }
      return new Response('OK');
    }

    if (request.method === 'POST' && url.pathname === '/cron') {
      if (request.headers.get('X-Cron-Secret') !== (env.WEBHOOK_SECRET || '')) {
        return new Response('forbidden', { status: 403 });
      }
      const { offset = 0, limit = 20 } = await request.json().catch(() => ({}));
      return Response.json(await runBatch(env, offset, limit));
    }

    if (url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('secret') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const webhook = await api(env, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ALLOWED_UPDATES,
        drop_pending_updates: false,
      });
      const commands = await api(env, 'setMyCommands', {
        commands: [
          { command: 'start', description: 'Boshlash' },
          { command: 'menu', description: 'Sozlamalar' },
        ],
      });
      return Response.json({ webhook, commands });
    }

    return new Response('Soat bot ishlayapti ✅');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runUpdater(env));
  },
};
