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

Admin (`lib/config.js` → `ADMIN_IDS`): `/stats`, `/refund [charge_id]`.

## ⚠️ Cron haqida

Serverless'da cron ham, `setTimeout` ham yo'q (deploy diagnostikasi: `timers: false`).
Shuning uchun soat **har qanday update kelganda** yangilanadi (`lib/users.js` → `wake`):
ulangan foydalanuvchilarning chatlariga kelgan har bir xabar botni uyg'otadi va shu daqiqada
hali yangilanmagan profillar (bir uyg'onishda 25 tagacha) yangilanadi. Xabar ko'p bo'lsa soat
deyarli har daqiqa yuradi; xabar kam bo'lgan paytda kechikadi. `/stats` dagi
«Eng katta kechikish» shuni ko'rsatadi.

## Tuzilma

```
tgcloud/schema.js                       users, payments, kv
tgcloud/handlers/message.js             /start, /menu, /premium, formatlar, to'lov, admin
tgcloud/handlers/callback_query.js      menyu tugmalari
tgcloud/handlers/business_connection.js ulanish / uzish / ruxsatlar
tgcloud/handlers/business_message.js    (+ edited_, deleted_) — botni uyg'otadi
tgcloud/handlers/pre_checkout_query.js  to'lovdan oldingi tekshiruv
tgcloud/endpoints/admin.js              deploy'dan keyingi diagnostika (Actions)
tgcloud/lib/                            users, menu, premium, admin, business, time
test/                                   unit testlar (npm test)
```

## Deploy (telefondan, GitHub Actions)

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Qayerdan |
|---|---|
| `TGCLOUD_TOKEN` | BotFather → bot → Serverless → CLI Access |

So'ng `tgcloud-migration` branch'iga har push (yoki Actions → *Run workflow*) avtomatik:
test → `tgcloud fetch` → `push` → `migrate --safe` → webhook holati → diagnostika.

BotFather'da: **Bot Settings → Business Mode → On**.

Foydalanuvchi: *Sozlamalar → Telegram Business → Chatbotlar* → botni qo'shadi va
«Ismni o'zgartirish», «Bioni o'zgartirish» ruxsatlarini yoqadi.
