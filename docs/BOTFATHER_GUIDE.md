# Telegram @BotFather Sozlamalari Qo‘llanmasi

Ushbu qo‘llanmada Telegramning rasmiy **@BotFather** boti orqali **Smart Quiz Platform** botini to‘liq sozlash, buyruqlar menyusini kiritish va Telegram Mini App (Web App) tugmasini ulash ko‘rsatilgan.

---

## 1. Yangi Bot Yaratish

1. Telegramda [@BotFather](https://t.me/BotFather) ga kiring.
2. `/newbot` buyrug‘ini yuboring.
3. Botingiz nomini kiriting:
   `Smart Quiz Platform`
4. Botingiz username'ini kiriting (oxiri `bot` bilan tugashi kerak):
   `smartquiz_uz_bot` (yoki o‘zingiz xohlagan nom)
5. @BotFather sizga **HTTP API token** beradi:
   `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`
6. Ushbu tokenni `.env` faylidagi `BOT_TOKEN` parametriga joylashtiring.

---

## 2. Bot Buyruqlarini Ro‘yxatdan O‘tkazish

@BotFather ga `/setcommands` buyrug‘ini yuboring, botingizni tanlang va quyidagi ro‘yxatni nusxalab yuboring:

```text
start - Botni ishga tushirish va bosh menyu
help - Foydalanish bo'yicha yo'riqnoma va yordam
newquiz - Yangi test yaratish yoki Word fayl yuklash
myquizzes - Yaratilgan testlar ro'yxati
results - O'tkazilgan testlar natijalari
profile - Shaxsiy profil va o'quvchi statistikasi
cancel - Joriy amalni bekor qilish
```

---

## 3. Telegram Mini App (Web App) Menyu Tugmasini Sozlash

Foydalanuvchilar bot chatining pastki chap burchagidagi bitta tugma orqali Veb boshqaruv panelini ochishlari uchun:

1. @BotFather ga `/setmenubutton` buyrug‘ini yuboring.
2. Botingizni tanlang.
3. Tugma sarlavhasi sifatida yuboring:
   `🌐 Panelni ochish`
4. Mini App web manzilini yuboring (HTTPS bo‘lishi shart, masalan ngrok yoki serveringiz domeni):
   `https://quiz.sizningdomen.uz`

---

## 4. Bot Ma’lumotlarini Chiroyli Qilish

1. **Bot Tavsifi (Description)**:
   `/setdescription` buyrug‘ini yuboring:
   ```text
   Smart Quiz Platform — Word (.docx) hujjatlaridan testlarni avtomatik import qilish, matematik va kimyoviy formulali savollar, guruhlarda jonli Telegram Quiz Poll va professional Excel hisobotlar taqdim etuvchi zamonaviy ta'limiy platforma.
   ```

2. **Bot Haqida Qisqa Matn (About)**:
   `/setabouttext`:
   ```text
   O'qituvchilar va o'quvchilar uchun zamonaviy test platformasi.
   ```

3. **Bot Rasmi (Botpic)**:
   `/setuserpic` buyrug‘i orqali botingiz profiliga ta’limiy logotip yuklang.

---

## 5. Guruhlarda Ishlash Huquqlarini Yoqish

Bot guruhlarda ishlashi va test o‘tkaza olishi uchun:
1. @BotFather ga `/setjoingroups` yuboring -> `Enable`.
2. Bot guruhlarda xabar yozish va poll yaratish huquqiga ega bo‘lishi kerak (Admin huquqlari tavsiya etiladi).
