# 🕒 Soatli Profil — Telegram Serverless bot

Foydalanuvchining Telegram ismi (va Premium'da biosi) ga joriy vaqtni yozib turadi.
Telegram Business orqali ishlaydi. Bot, baza va to'lovlar to'liq
[Telegram Serverless](https://core.telegram.org/bots/serverless) ustida — tashqi server yo'q.

## Imkoniyatlar

Hammasi bepul: ismdagi va biodagi soat, 24 ta vaqt mintaqasi, o'z formati (`/nameformat`, `/bioformat`).

**Majburiy obuna:** botdan foydalanish uchun [@Bandlik_Markazi](https://t.me/Bandlik_Markazi)
kanaliga obuna bo'lish shart (`lib/config.js` → `REQUIRED_CHANNEL`).
⚠️ Bot shu kanalda **admin** bo'lishi kerak, aks holda Telegram obunani tekshirishga ruxsat
bermaydi. Bunda bot hammaga ochiq ishlaydi va `/stats` ogohlantiradi.

Telegram Stars (Premium obuna) kodi saqlangan, lekin o'chiq: `lib/config.js` →
`PAYMENTS_ENABLED = true` qilinsa, bio/format/qo'shimcha mintaqalar 50 ⭐/oy Premium'ga o'tadi.

Admin (`lib/config.js` → `ADMIN_IDS`, obunadan ozod): `/stats`, `/refund [charge_id]`.

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
