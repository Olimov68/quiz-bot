# Windows Muhitida O‘rnatish va Ishga Tushirish Qo‘llanmasi (NO-DOCKER)

Ushbu qo‘llanmada **Smart Quiz Platform** tizimini Windows operatsion tizimida **hech qanday Docker ishlatmasdan**, sof mahalliy (native) servislar bilan o‘rnatish va ishga tushirish qadamma-qadam tushuntirilgan.

---

## 1. Talab Qilinadigan Dasturlar

1. **Node.js**: v20.x yoki v22.x+ LTS ([nodejs.org](https://nodejs.org/))
2. **PostgreSQL**: v15 yoki v16 ([postgresql.org/download/windows](https://www.postgresql.org/download/windows/))
3. **Redis**: Windows uchun Redis yoki Memurai ([github.com/tporadowski/redis/releases](https://github.com/tporadowski/redis/releases) yoki [memurai.com](https://www.memurai.com/))
4. **Git**: ([git-scm.com](https://git-scm.com/))

---

## 2. PostgreSQL va Redis Servislarini O‘rnatish

### 2.1. PostgreSQL
1. Rasmiy saytdan PostgreSQL o‘rnatuvchisini (Windows installer) yuklab oling va o‘rnating.
2. O‘rnatish jarayonida `postgres` superuseri uchun parol o‘rnating (masalan: `postgres`).
3. Port sifatida standart `5432` ni tanlang.
4. **pgAdmin** yoki **PowerShell** orqali yangi baza yarating:
   ```powershell
   psql -U postgres -c "CREATE DATABASE smart_quiz_platform;"
   ```

### 2.2. Redis (Windows)
1. GitHub releases sahifasidan `Redis-x64-5.0.14.1.msi` ni yuklab oling va oddiy Windows xizmati sifatida o‘rnating.
2. Yoki PowerShell orqali xizmat holatini tekshiring:
   ```powershell
   Get-Service -Name *redis*
   ```
3. Standart port: `6379`.

---

## 3. Loyihani Sozlash

### 3.1. Bog‘liqliklarni o‘rnatish
Loyihaning asosiy papkasida:
```powershell
npm install
```

### 3.2. Muhit o‘zgaruvchilarini (.env) sozlash
Loyihaning ildiz papkasidagi `.env.example` faylidan nusxa olib `.env` yarating:
```powershell
Copy-Item .env.example .env
```

`.env` faylidagi qiymatlarni tahrirlang:
```env
NODE_ENV=development

# Telegram botingiz tokeni (@BotFather dan olingan)
BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
BOT_USERNAME=smartquiz_bot

# Mahalliy PostgreSQL ulanishi
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smart_quiz_platform?schema=public"

# Mahalliy Redis ulanishi
REDIS_URL="redis://127.0.0.1:6379"

API_PORT=4000
WEB_PORT=3000
PUBLIC_API_URL="http://localhost:4000"
PUBLIC_WEB_URL="http://localhost:3000"

# O‘zingizning Telegram ID raqamingiz
SUPER_ADMIN_TELEGRAM_IDS=123456789
```

---

## 4. Ma’lumotlar Bazasini Migratsiya Qilish va Boshlang‘ich Ma’lumotlarni Yuklash

1. Prisma mijozini generatsiya qilish:
   ```powershell
   npm run db:generate
   ```

2. Baza jadvallarini yaratish (Migratsiya):
   ```powershell
   npm run db:migrate
   ```

3. Boshlang‘ich test va muallim namunalarini kiritish:
   ```powershell
   npm run db:seed
   ```

---

## 5. Loyihani Ishga Tushirish

### 5.1. Dasturlash (Development) rejimida
Bir vaqtning o‘zida API, Telegram Bot va Veb boshqaruv panelini ishga tushirish:
```powershell
npm run dev
```

* **Veb Panel**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:4000/api](http://localhost:4000/api)
* **Telegram Bot**: Long Polling rejimida avtomatik ishga tushadi va xabarlarni qabul qiladi.

### 5.2. Ishlab chiqarish (Production) rejimida
1. Loyihani yig‘ish (Build):
   ```powershell
   npm run build
   ```

2. Ishga tushirish:
   ```powershell
   npm run start
   ```

Windows muhitida PM2 orqali xizmat sifatida boshqarish:
```powershell
npm install -g pm2
pm2 start dist/main.js --name "smart-quiz-api"
```
