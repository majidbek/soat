# 🕒 Soatli Profil — Telegram Business bot (serverless)

Foydalanuvchining Telegram ismi va biosiga **har daqiqada joriy vaqtni** yozib turadigan bot.
Telegram Business orqali ishlaydi (`setBusinessAccountName` / `setBusinessAccountBio`).

Eski PHP + MySQL + cron versiyasi **Cloudflare Workers + D1** ga ko'chirildi:

| | Eski (PHP hosting) | Yangi (Cloudflare Workers) |
|---|---|---|
| Server | Shared hosting | Serverless, server kerak emas |
| Baza | MySQL | D1 (SQLite) |
| Cron | Hosting cron → `cron.php` | Workers Cron Trigger, har daqiqa |
| Narx | Hosting to'lovi | Bepul tarif yetadi (100k so'rov/kun) |
| Ko'p foydalanuvchi | Bitta skript ketma-ket | Bo'laklarga bo'linib parallel |

## Nimalar tuzatildi

- Token va DB paroli koddan olib tashlandi → `wrangler secret`.
- Webhook `secret_token` bilan himoyalangan (begona so'rovlar 403).
- `update_log.txt` ga hamma update yozilishi olib tashlandi (20 MB+ o'sib, shaxsiy ma'lumot saqlardi).
- `business_message` da mijozning `chat.id` si egasi deb saqlanardi — tuzatildi.
- Botni uzganda (`is_enabled: false`) ulanish o'chiriladi, yaroqsiz ulanishlar avtomatik tozalanadi.
- Telegramga faqat o'zgargan qiymat yuboriladi (ism/bio bir daqiqada bir marta).
- Bot hech qachon o'rnatmagan bo'lsa, foydalanuvchining biosi o'chirilmaydi.
- `/start` bosmagan, lekin tugmani bosgan foydalanuvchi ham bazaga qo'shiladi.
- Ism 64, bio 140 belgidan oshmaydi (Telegram limiti).

## O'rnatish (bir marta)

```bash
npm install
npx wrangler login

# 1. Baza yaratish — chiqqan database_id ni wrangler.toml ga qo'ying
npx wrangler d1 create soat
npm run db:init

# 2. Maxfiy qiymatlar
npx wrangler secret put BOT_TOKEN        # @BotFather tokeni
npx wrangler secret put WEBHOOK_SECRET   # uzun tasodifiy satr, masalan: openssl rand -hex 32

# 3. Deploy
npm run deploy
```

Deploydan keyin webhookni o'rnating (brauzerda oching):

```
https://soat-bot.<subdomain>.workers.dev/setup?secret=<WEBHOOK_SECRET>
```

Javobda `"webhook":{"ok":true...}` chiqsa — tayyor.

### @BotFather sozlamalari

`/mybots` → bot → **Bot Settings → Business Mode → Turn on**.
Foydalanuvchi: *Sozlamalar → Telegram Business → Chatbotlar* → botni qo'shadi va
**«Ismni o'zgartirish»** hamda **«Bioni o'zgartirish»** ruxsatlarini yoqadi.

### O'z domeningizda (ixtiyoriy)

`wrangler.toml` ga qo'shing (domen Cloudflare'da bo'lishi kerak):

```toml
routes = [{ pattern = "soat.avtora.uz", custom_domain = true }]
```

## GitHub orqali avtomatik deploy

`main` ga har push → `.github/workflows/deploy.yml` deploy qiladi.
Repo → *Settings → Secrets and variables → Actions* ga qo'shing:

| Secret | Qayerdan |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens → "Edit Cloudflare Workers" shabloni (+ D1 Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard o'ng panelidagi Account ID |
| `BOT_TOKEN` | @BotFather |
| `WEBHOOK_SECRET` | o'zingiz yaratgan tasodifiy satr |

## Eski MySQL bazasidan ko'chirish

Eski foydalanuvchilar qayta ulanmasligi uchun: `scripts/mysql-export.sql` ni phpMyAdmin'da ishga tushiring,
natijani `migrate.sql` ga saqlang va:

```bash
npx wrangler d1 execute soat --remote --file=migrate.sql
```

So'ng webhookni yangi manzilga `/setup` orqali o'tkazing va hostingdagi cron'ni o'chiring.

## Lokal test

```bash
printf 'BOT_TOKEN=...\nWEBHOOK_SECRET=test\n' > .dev.vars
npm run db:init:local
npm run dev
# cron'ni qo'lda ishga tushirish:
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

## Masshtab

Cron har daqiqada faol foydalanuvchilarni `BATCH_SIZE` (standart 20) talik bo'laklarga bo'lib,
har bir bo'lakni alohida worker chaqiruvida (`SELF` service binding) bajaradi —
shu tufayli bepul tarifdagi 50 subrequest limitiga urilmaydi.
Workers Paid tarifida `BATCH_SIZE` ni 200–400 gacha oshirish mumkin.

## Format o'zgaruvchilari

`username_format` va `bio_format` da: `{name}`, `{time}`, `{date}`, `{full}`, `{weekday}`.
