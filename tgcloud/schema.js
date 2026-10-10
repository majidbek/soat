import { table, integer, text, boolean, index, uniqueIndex, sql } from 'sdk/db';

// Botdan foydalangan yoki akkauntini ulagan har bir foydalanuvchi.
export const users = table('users', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  tgId:           integer('tg_id').notNull(),
  firstName:      text('first_name'),
  // Telegram Business ulanishi (null — ulanmagan)
  connectionId:   text('connection_id'),
  canEditName:    boolean('can_edit_name').notNull().default(false),
  canEditBio:     boolean('can_edit_bio').notNull().default(false),
  // Sozlamalar
  timeZone:       text('time_zone').notNull().default('Asia/Tashkent'),
  clockEnabled:   boolean('clock_enabled').notNull().default(false),
  bioEnabled:     boolean('bio_enabled').notNull().default(false),
  nameFormat:     text('name_format'),
  bioFormat:      text('bio_format'),
  // Bot oxirgi marta o'rnatgan qiymatlar (null — bot hali tegmagan)
  lastName:       text('last_name'),
  lastBio:        text('last_bio'),
  // Oxirgi ishlov berilgan daqiqa (unix vaqt / 60)
  lastMinute:     integer('last_minute').notNull().default(0),
  lastError:      text('last_error'),
  // Premium tugash vaqti (unix soniya), 0 — Premium yo'q
  premiumUntil:   integer('premium_until').notNull().default(0),
  createdAt:      integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  tgIdx:   uniqueIndex('uidx_users_tg').on(t.tgId),
  connIdx: index('idx_users_conn').on(t.connectionId),
  dueIdx:  index('idx_users_due').on(t.lastMinute),
}));

// Har bir Stars to'lovi (birinchi va har oylik yangilanish). charge_id — qaytarish uchun.
export const payments = table('payments', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  tgId:      integer('tg_id').notNull(),
  product:   text('product').notNull(),
  stars:     integer('stars').notNull(),
  chargeId:  text('charge_id').notNull(),
  recurring: boolean('recurring').notNull().default(false),
  refunded:  boolean('refunded').notNull().default(false),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  chargeIdx: uniqueIndex('uidx_payments_charge').on(t.chargeId),
}));

// Kalit-qiymat (hozircha ishlatilmaydi; jadval bazada yaratilgan).
export const kv = table('kv', {
  key:       text('key').primaryKey(),
  value:     text('value'),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});
