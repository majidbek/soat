// Vaqt mintaqalari. `premium: true` — faqat Premium foydalanuvchilar uchun.
export const DEFAULT_TZ = 'Asia/Tashkent';

export const TIMEZONES = [
  { tz: 'Asia/Tashkent', label: "🇺🇿 O'zbekiston" },
  { tz: 'Asia/Almaty', label: "🇰🇿 Qozog'iston" },
  { tz: 'Europe/Moscow', label: '🇷🇺 Rossiya' },
  { tz: 'Europe/London', label: '🇬🇧 Britaniya' },
  { tz: 'Europe/Berlin', label: '🇩🇪 Germaniya' },
  { tz: 'Europe/Istanbul', label: '🇹🇷 Turkiya' },
  { tz: 'Asia/Dubai', label: '🇦🇪 BAA' },
  { tz: 'Asia/Bishkek', label: "🇰🇬 Qirg'iziston" },
  { tz: 'Asia/Dushanbe', label: '🇹🇯 Tojikiston' },
  { tz: 'Asia/Ashgabat', label: '🇹🇲 Turkmaniston' },
  { tz: 'America/New_York', label: '🇺🇸 AQSh (Nyu-York)' },
  { tz: 'Asia/Tokyo', label: '🇯🇵 Yaponiya' },
  { tz: 'Asia/Seoul', label: '🇰🇷 Koreya', premium: true },
  { tz: 'Asia/Shanghai', label: '🇨🇳 Xitoy', premium: true },
  { tz: 'Asia/Kolkata', label: '🇮🇳 Hindiston', premium: true },
  { tz: 'Asia/Riyadh', label: '🇸🇦 Saudiya', premium: true },
  { tz: 'Europe/Warsaw', label: '🇵🇱 Polsha', premium: true },
  { tz: 'Europe/Paris', label: '🇫🇷 Fransiya', premium: true },
  { tz: 'Europe/Rome', label: '🇮🇹 Italiya', premium: true },
  { tz: 'Europe/Madrid', label: '🇪🇸 Ispaniya', premium: true },
  { tz: 'America/Chicago', label: '🇺🇸 AQSh (Chikago)', premium: true },
  { tz: 'America/Los_Angeles', label: '🇺🇸 AQSh (LA)', premium: true },
  { tz: 'America/Toronto', label: '🇨🇦 Kanada', premium: true },
  { tz: 'Australia/Sydney', label: '🇦🇺 Avstraliya', premium: true },
];

export const findZone = (tz) => TIMEZONES.find((z) => z.tz === tz);

// Intl ishlamasa: standart siljish (daqiqa) va yozgi vaqt qoidasi.
const FALLBACK = {
  'Asia/Tashkent': [300], 'Asia/Almaty': [300], 'Europe/Moscow': [180],
  'Europe/London': [0, 'eu'], 'Europe/Berlin': [60, 'eu'], 'Europe/Istanbul': [180],
  'Asia/Dubai': [240], 'Asia/Bishkek': [360], 'Asia/Dushanbe': [300], 'Asia/Ashgabat': [300],
  'America/New_York': [-300, 'us'], 'Asia/Tokyo': [540], 'Asia/Seoul': [540],
  'Asia/Shanghai': [480], 'Asia/Kolkata': [330], 'Asia/Riyadh': [180],
  'Europe/Warsaw': [60, 'eu'], 'Europe/Paris': [60, 'eu'], 'Europe/Rome': [60, 'eu'],
  'Europe/Madrid': [60, 'eu'], 'America/Chicago': [-360, 'us'],
  'America/Los_Angeles': [-480, 'us'], 'America/Toronto': [-300, 'us'],
  'Australia/Sydney': [600, 'au'],
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Oyning n-yakshanbasi (n=-1 — oxirgisi), UTC sana raqami
function nthSunday(year, month, n) {
  if (n < 0) {
    const last = new Date(Date.UTC(year, month + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  }
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}

function isDst(rule, ms, std) {
  const y = new Date(ms).getUTCFullYear();
  if (rule === 'eu') {
    // Mart oxirgi yakshanba 01:00 UTC — oktyabr oxirgi yakshanba 01:00 UTC
    const start = Date.UTC(y, 2, nthSunday(y, 2, -1), 1);
    const end = Date.UTC(y, 9, nthSunday(y, 9, -1), 1);
    return ms >= start && ms < end;
  }
  if (rule === 'us') {
    // Mart 2-yakshanba 02:00 mahalliy — noyabr 1-yakshanba 02:00 mahalliy
    const start = Date.UTC(y, 2, nthSunday(y, 2, 2), 2) - std * 60000;
    const end = Date.UTC(y, 10, nthSunday(y, 10, 1), 2) - (std + 60) * 60000;
    return ms >= start && ms < end;
  }
  if (rule === 'au') {
    // Janubiy yarimshar: oktyabr 1-yakshanba — aprel 1-yakshanba (03:00 mahalliy yozgi)
    const end = Date.UTC(y, 3, nthSunday(y, 3, 1), 3) - (std + 60) * 60000;
    const start = Date.UTC(y, 9, nthSunday(y, 9, 1), 2) - std * 60000;
    return ms < end || ms >= start;
  }
  return false;
}

const pad = (n) => String(n).padStart(2, '0');

function fallbackParts(tz, ms) {
  const [std, rule] = FALLBACK[tz] || FALLBACK[DEFAULT_TZ];
  const offset = std + (rule && isDst(rule, ms, std) ? 60 : 0);
  const d = new Date(ms + offset * 60000);
  return {
    hour: pad(d.getUTCHours()), minute: pad(d.getUTCMinutes()),
    day: pad(d.getUTCDate()), month: pad(d.getUTCMonth() + 1), year: String(d.getUTCFullYear()),
    weekday: WEEKDAYS[d.getUTCDay()],
  };
}

let intlWorks = null;

function intlParts(tz, ms) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long',
  }).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return parts;
}

export function getCurrentTime(tz = DEFAULT_TZ, ms = Date.now()) {
  if (!findZone(tz)) tz = DEFAULT_TZ;
  let p = null;
  if (intlWorks !== false) {
    try {
      p = intlParts(tz, ms);
      // Izolyatsiyada ICU ma'lumotlari bo'lmasa, mintaqa e'tiborsiz qolishi mumkin
      intlWorks = Boolean(p.hour && p.minute && p.weekday) &&
        intlParts('Asia/Tokyo', Date.UTC(2026, 0, 1, 0, 0)).hour === '09';
      if (!intlWorks) p = null;
    } catch {
      intlWorks = false;
    }
  }
  if (!p) p = fallbackParts(tz, ms);
  const time = `${p.hour}:${p.minute}`;
  const date = `${p.day}.${p.month}.${p.year}`;
  return { time, date, full: `${date} ${time}`, weekday: p.weekday };
}

export const currentMinute = (ms = Date.now()) => Math.floor(ms / 60000);
export const nowSec = () => Math.floor(Date.now() / 1000);

// Testlar uchun
export const _fallbackParts = fallbackParts;
