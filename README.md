# 🕒 Soatli Profil — Telegram Serverless bot

Foydalanuvchining Telegram ismi (va Premium'da biosi) ga joriy vaqtni yozib turadi.
Telegram Business orqali ishlaydi. Bot, baza va to'lovlar to'liq
[Telegram Serverless](https://core.telegram.org/bots/serverless) ustida — tashqi server yo'q.

## Imkoniyatlar

| Bepul | ⭐ Premium — 50 Stars/oy (obuna) |
|---|---|
| Ismdagi soat | Biodagi soat |
| 12 ta vaqt mintaqasi | +12 mintaqa (jami 24) |
| Standart format | O'z formati: `/nameformat`, `/bioformat` |

Admin (`lib/config.js` → `ADMIN_IDS`): `/stats`, `/refund [charge_id]`, `/hb [on|off]`.

## ⚠️ Cron haqida

Serverless'da cron/taymer yo'q. Soat shunday yangilanadi:

1. **Har qanday update kelganda** (`lib/users.js` → `wake`): ulangan foydalanuvchilarning
   chatlariga kelgan har bir xabar botni uyg'otadi va shu daqiqada yangilanmagan profillar
   yangilanadi. Kunduzi deyarli har daqiqa; xabar kam bo'lsa — kechikadi.
2. **Heartbeat (tajriba)** (`lib/heartbeat.js`): `endpoints/tick` o'zini har daqiqada qayta
   chaqiradi. `setTimeout` va o'z manzilini chaqirish platformada ishlasagina ishlaydi.
   Ishlamasa, o'zi to'xtaydi; 1-usul baribir ishlayveradi. `/hb on` bilan yoqiladi,
   `/stats` da holati ko'rinadi.

## Tuzilma

```
tgcloud/schema.js                       users, payments, kv
tgcloud/handlers/message.js             /start, /menu, /premium, formatlar, to'lov, admin
tgcloud/handlers/callback_query.js      menyu tugmalari
tgcloud/handlers/business_connection.js ulanish / uzish / ruxsatlar
tgcloud/handlers/business_message.js    (+ edited_, deleted_) — botni uyg'otadi
tgcloud/handlers/pre_checkout_query.js  to'lovdan oldingi tekshiruv
tgcloud/endpoints/tick.js               heartbeat zanjiri
tgcloud/endpoints/ping.js               heartbeat auth tekshiruvi
tgcloud/endpoints/admin.js              diagnostika, bot tokenini saqlash (Actions)
tgcloud/lib/                            users, menu, premium, admin, time, heartbeat, initdata
test/                                   unit testlar (npm test)
```

## Deploy (telefondan, GitHub Actions)

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Qayerdan | Majburiy |
|---|---|---|
| `TGCLOUD_TOKEN` | BotFather → bot → Serverless → CLI Access | ✅ |
| `BOT_TOKEN` | BotFather → bot → API Token | faqat heartbeat uchun |

So'ng `tgcloud-migration` branch'iga har push (yoki Actions → *Run workflow*) avtomatik:
test → `tgcloud fetch` → `push` → `migrate --safe` → webhook holati → diagnostika.

BotFather'da: **Bot Settings → Business Mode → On**.

Foydalanuvchi: *Sozlamalar → Telegram Business → Chatbotlar* → botni qo'shadi va
«Ismni o'zgartirish», «Bioni o'zgartirish» ruxsatlarini yoqadi.
