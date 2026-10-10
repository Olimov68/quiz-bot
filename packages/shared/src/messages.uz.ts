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
    `<b>Smart Quiz Platform</b> — zamonaviy ta'limiy test botiga xush kelibsiz.\n\n` +
    `Bu yerda siz:\n` +
    `• Testlarni to‘g‘ridan-to‘g‘ri Telegramda savolma-savol yaratishingiz;\n` +
    `• Guruhlarga haqiqiy Telegram Quiz Poll shaklida jonli test o'tkazishingiz;\n` +
    `• Har bir savolga vaqt chegarasi va variantlarni sozlashingiz;\n` +
    `• Batafsil natijalar va 3 varaqli Excel hisobotlarni yuklab olishingiz mumkin.\n\n` +
    `Kerakli bo'limni tanlang:`,

  HELP:
    `<b>📖 Smart Quiz Platform — Foydalanish bo'yicha qo'llanma</b>\n\n` +
    `<b>1. Test yaratish:</b>\n` +
    `«➕ Test yaratish» tugmasini bosing, test nomini kiriting. So‘ng har bir savol matni va variantlarini yuborib, to‘g‘ri javob tugmasini tanlang.\n\n` +
    `<b>2. Guruhda test o'tkazish:</b>\n` +
    `• Botni guruhingizga qo‘shib <b>Admin</b> huquqini bering.\n` +
    `• «📚 Testlarim» bo‘limidan test ostidagi «🚀 Guruhda» tugmasini bosing yoki guruhda <code>/startquiz &lt;test_id&gt;</code> buyrug‘ini yuboring.\n` +
    `• Ishtirokchilar «✅ Tayyorman» tugmasi orqali qatnashadilar.\n\n` +
    `<b>3. Majburiy obuna:</b>\n` +
    `Agar bot administrator tomonidan homiy kanallarga ulangan bo‘lsa, ishtirokchilar testga qo‘shilishdan avval ushbu kanallarga a’zo bo‘lishlari lozim.\n\n` +
    `<b>4. Natijalar va Excel hisobot:</b>\n` +
    `Test yakunlangach guruhda reyting e’lon qilinadi va «🏆 Natijalar» bo‘limidan to‘liq Excel hisobot yuklab olinadi.`,

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
