-- Eski MySQL (phpMyAdmin) dagi foydalanuvchilarni D1 ga ko'chirish.
-- 1) Shu so'rovni phpMyAdmin → SQL bo'limida ishga tushiring.
-- 2) Natijadagi barcha qatorlarni migrate.sql fayliga saqlang
--    (Export → CSV emas, "Copy to clipboard" yoki natijani to'liq ko'rsatib nusxalang).
-- 3) npx wrangler d1 execute soat --remote --file=migrate.sql

SELECT CONCAT(
  'INSERT OR REPLACE INTO business_users ',
  '(telegram_id, business_connection_id, original_name, time_zone, clock_enabled, bio_enabled, username_format, bio_format) VALUES (',
  telegram_id, ', ',
  IF(business_connection_id IS NULL, 'NULL', CONCAT('''', REPLACE(business_connection_id, '''', ''''''), '''')), ', ',
  IF(original_name IS NULL, 'NULL', CONCAT('''', REPLACE(original_name, '''', ''''''), '''')), ', ',
  CONCAT('''', REPLACE(IFNULL(time_zone, 'Asia/Tashkent'), '''', ''''''), ''''), ', ',
  IFNULL(clock_enabled, 0), ', ',
  IFNULL(bio_enabled, 0), ', ',
  CONCAT('''', REPLACE(IFNULL(username_format, '{name} | 🕒 {time}'), '''', ''''''), ''''), ', ',
  CONCAT('''', REPLACE(IFNULL(bio_format, '🕒 {date} {time} | {name}'), '''', ''''''), ''''),
  ');'
) AS q
FROM business_users;
