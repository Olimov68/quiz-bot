export const UZ_MENUS = {
  CREATE_QUIZ: '➕ Test yaratish',
  MY_QUIZZES: '📚 Testlarim',
  RESULTS: '🏆 Natijalar',
  MY_GROUPS: '👥 Guruhlarim',
  STATISTICS: '📊 Statistika',
  PROFILE: '👤 Profil',
  SETTINGS: '⚙️ Sozlamalar',
  HELP: '❓ Yordam',
  CANCEL: '❌ Bekor qilish',
  JOIN_QUIZ: '✅ Tayyorman',
  START_QUIZ: '🚀 Testni boshlash',
  OPEN_DASHBOARD: '🌐 Veb panelni ochish',
  REFRESH: '🔄 Yangilash',
};

export const UZ_MESSAGES = {
  WELCOME: (name: string) =>
    `Assalomu alaykum, <b>${name}</b>!\n\n` +
    `<b>Smart Quiz Platform</b> — zamonaviy ta'limiy test platformasiga xush kelibsiz.\n\n` +
    `Bu yerda siz:\n` +
    `• Word (.docx) fayllardan testlarni bir zumda yuklashingiz;\n` +
    `• Matematik va kimyoviy formulali savollar yaratishingiz;\n` +
    `• Guruhlarga haqiqiy Telegram Quiz Poll shaklida test o'tkazishingiz;\n` +
    `• Batafsil natijalar va Excel hisobotlarni olishingiz mumkin.\n\n` +
    `Kerakli bo'limni tanlang:`,

  HELP:
    `<b>📖 Smart Quiz Platform — Foydalanish bo'yicha qo'llanma</b>\n\n` +
    `<b>1. Test yaratish:</b>\n` +
    `«➕ Test yaratish» tugmasini bosing, mavzuni kiriting va Word (.docx) faylini yuboring.\n\n` +
    `<b>2. Word fayl qoidalari:</b>\n` +
    `• Savol raqami: <code>1.</code> yoki <code>1)</code>\n` +
    `• Variantlar: <code>A)</code>, <code>B)</code>, <code>C)</code>, <code>D)</code>\n` +
    `• To'g'ri javob: variant oldida yulduzcha <code>*C)</code> yoki savol ostida <code>Javob: C</code>\n` +
    `• Formulalar va rasmlar avtomatik aniqlanadi.\n\n` +
    `<b>3. Guruhda test o'tkazish:</b>\n` +
    `Botni guruhingizga admin qilib qo'shing va testni guruhga yuboring. O'quvchilar «✅ Tayyorman» tugmasi orqali qatnashadilar.\n\n` +
    `Savollaringiz bo'lsa, administrator bilan bog'laning.`,

  CREATE_TITLE_PROMPT: `📝 <b>Test mavzusini kiriting:</b>\n<i>Masalan: Organik kimyo — Alkenlar</i>`,
  CREATE_DESC_PROMPT: `📄 <b>Test haqida qisqacha tavsif kiriting:</b>\n<i>(Ixtiyoriy, o'tkazib yuborish uchun - belgisini yuborishingiz mumkin)</i>`,
  CREATE_FILE_PROMPT: `📎 <b>Test savollari joylashgan Word (.docx) faylini yuboring:</b>\n<i>Maksimal hajm: 20 MB</i>`,

  FILE_PROCESSING: `⏳ Word fayl tahlil qilinmoqda, iltimos kuting...`,
  FILE_INVALID_TYPE: `❌ Faqat Word (.docx) formatidagi fayllar qabul qilinadi. Eski .doc fayllarni avval .docx formatiga o'tkazing.`,
  FILE_TOO_LARGE: `❌ Fayl hajmi belgilangan me'yordan katta (maksimal 20 MB).`,

  IMPORT_SUCCESS: (data: {
    title: string;
    total: number;
    valid: number;
    needsCheck: number;
    images: number;
    formulas: number;
  }) =>
    `✅ <b>Word fayl muvaffaqiyatli tahlil qilindi!</b>\n\n` +
    `📚 <b>Test:</b> ${data.title}\n` +
    `📝 <b>Savollar:</b> ${data.total} ta\n` +
    `✅ <b>To'g'ri savollar:</b> ${data.valid} ta\n` +
    `⚠️ <b>Tekshirish kerak:</b> ${data.needsCheck} ta\n` +
    `🖼 <b>Rasmlar:</b> ${data.images} ta\n` +
    `🧪 <b>Formulalar:</b> ${data.formulas} ta`,

  IMPORT_ERRORS_HEADER: `⚠️ <b>Quyidagi savollarni tekshirish talab etiladi:</b>\n`,

  OPERATION_CANCELLED: `🚫 Amal bekor qilindi. Bosh menyudasiz.`,
  PERMISSION_DENIED: `❌ Ushbu amalni bajarish uchun ruxsatingiz yo'q.`,
  GENERIC_ERROR: `⚠️ Kutilmagan xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.`,

  GROUP_QUIZ_WAITING: (data: {
    title: string;
    participantsCount: number;
    questionsCount: number;
    timePerQuestion: number;
  }) =>
    `📚 <b>${data.title}</b>\n\n` +
    `👥 <b>Ishtirokchilar:</b> ${data.participantsCount} nafar\n` +
    `📝 <b>Savollar:</b> ${data.questionsCount} ta\n` +
    `⏱ <b>Har bir savol:</b> ${data.timePerQuestion > 0 ? `${data.timePerQuestion} soniya` : 'Cheklanmagan'}\n\n` +
    `Testga qo'shilish uchun quyidagi tugmani bosing:`,

  LEADERBOARD_HEADER: (data: {
    title: string;
    totalQuestions: number;
    participantsCount: number;
    averagePercentage: number;
  }) =>
    `🏆 <b>TEST NATIJALARI</b>\n\n` +
    `📚 <b>${data.title}</b>\n` +
    `📝 <b>Jami:</b> ${data.totalQuestions} ta savol\n\n`,

  LEADERBOARD_FOOTER: (data: {
    participantsCount: number;
    averagePercentage: number;
  }) =>
    `\n👥 <b>Ishtirokchilar:</b> ${data.participantsCount} nafar\n` +
    `📊 <b>O'rtacha natija:</b> ${data.averagePercentage.toFixed(1)}%`,

  STUDENT_PROFILE: (data: {
    name: string;
    quizzesCount: number;
    correctAnswers: number;
    wrongAnswers: number;
    averageScore: number;
    bestScore: number;
  }) =>
    `👤 <b>O'quvchi profili: ${data.name}</b>\n\n` +
    `📚 <b>Ishlangan testlar:</b> ${data.quizzesCount} ta\n` +
    `✅ <b>To'g'ri javoblar:</b> ${data.correctAnswers} ta\n` +
    `❌ <b>Noto'g'ri javoblar:</b> ${data.wrongAnswers} ta\n` +
    `📊 <b>O'rtacha natija:</b> ${data.averageScore.toFixed(1)}%\n` +
    `🏆 <b>Eng yaxshi natija:</b> ${data.bestScore.toFixed(1)}%`,
};
