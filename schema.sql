CREATE TABLE IF NOT EXISTS business_users (
    telegram_id            INTEGER PRIMARY KEY,
    business_connection_id TEXT,
    original_name          TEXT,
    time_zone              TEXT    NOT NULL DEFAULT 'Asia/Tashkent',
    clock_enabled          INTEGER NOT NULL DEFAULT 0,
    bio_enabled            INTEGER NOT NULL DEFAULT 0,
    username_format        TEXT    NOT NULL DEFAULT '{name} | 🕒 {time}',
    bio_format             TEXT    NOT NULL DEFAULT '🕒 {date} {time} | {name}',
    last_name              TEXT,
    last_bio               TEXT,
    last_error             TEXT,
    updated_at             TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_connection
    ON business_users (business_connection_id);
