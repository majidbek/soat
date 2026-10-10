// Bot egalari: /stats va /refund buyruqlari faqat ular uchun, majburiy obunadan ozod.
export const ADMIN_IDS = [8808803998];

// Bitta uyg'onishda yangilanadigan profillar soni (har biri ≤2 Bot API chaqiruvi).
export const SWEEP_LIMIT = 25;

// Telegram Stars to'lovlari. false — barcha imkoniyatlar hamma uchun bepul,
// to'lov tugmalari ko'rinmaydi. Qayta yoqish uchun true qiling.
export const PAYMENTS_ENABLED = false;

// Majburiy obuna kanali. Bot shu kanalda ADMIN bo'lishi shart (aks holda
// Telegram obunani tekshirishga ruxsat bermaydi). null — tekshiruv o'chiq.
export const REQUIRED_CHANNEL = {
  chatId: '@Bandlik_Markazi',
  url: 'https://t.me/Bandlik_Markazi',
};
