# Tizim Xavfsizlik Audit Hisoboti va Talablar Nazorati

Ushbu hujjatda **Smart Quiz Platform** tizimida joriy etilgan kiberxavfsizlik choralari, himoya mexanizmlari va audit natijalari batafsil bayon etilgan.

---

## 1. Autentifikatsiya va Sessiya Xavfsizligi

| Talab | Holat | Amaliyot Tafsilotlari |
| :--- | :---: | :--- |
| **Telegram Mini App HMAC-SHA256 imzosi** | ✅ O‘rnatilgan | `validateTelegramInitData` funksiyasi Telegram rasmiy algoritmi bo‘yicha `WebAppData` kaliti va bot tokeni orqali HMAC hisoblaydi. |
| **Timing Attack himoyasi** | ✅ O‘rnatilgan | Imzolarni taqqoslashda `crypto.timingSafeEqual` ishlatiladi, vaqt tahlili orqali xakerlik qilish imkonsiz. |
| **initData muddati (Expiration)** | ✅ O‘rnatilgan | `auth_date` tekshiriladi, 24 soatdan oshgan so‘rovlar qat’iy rad etiladi. |
| **Frontendda sirlarni yashirish** | ✅ O‘rnatilgan | `BOT_TOKEN` yoki `JWT_SECRET` hech qachon mijoz (frontend) kodiga o‘tkazilmaydi. |
| **JWT sessiyalari** | ✅ O‘rnatilgan | Standart HS256 shifrlash, muddatli tokenlar va claims asosida tekshiruv. |

---

## 2. Avtorizatsiya va Ma’lumotlar Izolyatsiyasi (RBAC)

| Talab | Holat | Amaliyot Tafsilotlari |
| :--- | :---: | :--- |
| **Rolli kirish (RBAC)** | ✅ O‘rnatilgan | `RolesGuard` va `@Roles()` dekoratori orqali `SUPER_ADMIN`, `TEACHER`, `STUDENT` zonalari ajratilgan. |
| **Resurs egaligi (Ownership)** | ✅ O‘rnatilgan | Bir o‘qituvchi boshqa o‘qituvchining testlari, talabalari va natijalariga noqonuniy kira olmaydi. Har bir so‘rovda `creatorId === userId` tekshiriladi. |
| **Super Admin huquqlari** | ✅ O‘rnatilgan | Faqat `SUPER_ADMIN_TELEGRAM_IDS` ro‘yxatidagi foydalanuvchilar platforma boshqaruvi va foydalanuvchilarni bloklash imkoniga ega. |

---

## 3. Fayllar va Word (.docx) Yuklash Xavfsizligi

| Talab | Holat | Amaliyot Tafsilotlari |
| :--- | :---: | :--- |
| **Zip-bombadan himoya** | ✅ O‘rnatilgan | Arxivdan ochiladigan maksimal hajm 100 MB, arxiv ichidagi fayllar soni esa 1500 tadan oshmasligi qat’iy tekshiriladi. |
| **XXE (XML External Entity)** | ✅ O‘rnatilgan | XML tahlilida tashqi DTD va tashqi entitiylarni yuklash to‘liq o‘chirilgan. |
| **MIME va Magic Bytes** | ✅ O‘rnatilgan | Fayl faqat kengaytmasiga qarab emas, birinchi 4 baytiga qarab tekshiriladi (PK - Zip/Docx imzosi, PNG: `\x89PNG`, JPEG: `\xFF\xD8\xFF`). |
| **Path Traversal himoyasi** | ✅ O‘rnatilgan | Saqlanadigan rasmlar tasodifiy UUID nomlari bilan xavfsiz `storage/media` papkasiga joylashtiriladi. |

---

## 4. Excel Hisobotlarida Formula Injection (CSV/XLSX Injection) Himoyasi

| Talab | Holat | Amaliyot Tafsilotlari |
| :--- | :---: | :--- |
| **Formula in’yeksiyasi sanitarizatsiyasi** | ✅ O‘rnatilgan | Ishtirokchilar ismlari yoki test matnlaridagi xavfli belgilar (`=`, `+`, `-`, `@`) bilan boshlangan kataklar avtomatik tarzda apostrof (`'`) bilan zararsizlantiriladi. |
| **UTF-8 qo‘llab-quvvatlashi** | ✅ O‘rnatilgan | O‘zbek lotin alifbosidagi `o‘`, `g‘`, `sh`, `ch` harflari buzilmasdan to‘g‘ri formatlanadi. |

---

## 5. Bot API va Ma’lumotlar Bazasi

| Talab | Holat | Amaliyot Tafsilotlari |
| :--- | :---: | :--- |
| **SQL Injection** | ✅ O‘rnatilgan | Prisma ORM parametrli so‘rovlari orqali SQL in’yektsiya ehtimoli bartaraf etilgan. |
| **Telegram Webhook Secret Token** | ✅ O‘rnatilgan | Webhook rejimida `x-telegram-bot-api-secret-token` sarlavhasi tekshiriladi. |
| **Takroriy javoblardan himoya** | ✅ O‘rnatilgan | `PollAnswer` jadvalida `[pollInstanceId, userId]` bo‘yicha unique cheklov mavjud, bir xil yangilanish ikki marta hisoblanmaydi. |
| **Foydalanuvchiga stack trace ko‘rsatmaslik** | ✅ O‘rnatilgan | Telegram foydalanuvchilariga xatolar sodda o‘zbek tilida tushuntiriladi, ichki server xatolari yashiriladi. |
