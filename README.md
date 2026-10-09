# Smart Quiz Platform 🚀

**Smart Quiz Platform** — o‘qituvchilar, ta’lim markazlari va o‘quvchilar uchun mo‘ljallangan professional Telegram test platformasi. Tizim Telegram rasmiy `@QuizBot` imkoniyatlarini taqdim etishi bilan birga, Word (.docx) fayllarni chuqur tahlil qilish, matematik (LaTeX / OMML) va kimyoviy formulalarni qo‘llab-quvvatlash, rasmlarni avtomatik ajratib olish, o‘qituvchi veb-boshqaruv paneli, Telegram Mini App hamda ko‘p varaqli professional Excel (.xlsx) hisobotlarini o‘z ichiga oladi.

> **QAT’IY TALAB: NO-DOCKER ARXITEKTURA**  
> Ushbu platforma hech qanday Docker, Docker Compose yoki konteynerlarga bog‘liq emas. U Windows va Linux operatsion tizimlarida sof mahalliy Node.js, PostgreSQL va Redis xizmatlari orqali bevosita ishlaydi.

---

## 🌟 Asosiy Imkoniyatlar

1. **Word (.docx) Hujjatlarini Avtomatik Import Qilish:**
   - Word hujjatidagi `1.`, `1)`, `Savol 1:` kabi raqamlashlarni taniydi.
   - `A)`, `B)`, `*C)`, `#D)` yoki savol ostidagi `Javob: B` kalitlarini avtomatik ajratadi.
   - Word Office Math (OMML) formulalarini to‘liq LaTeX formatiga o‘tkazadi.
   - Kimyoviy formulalar (`H₂SO₄`, `CH₄ + 2O₂ → CO₂ + 2H₂O`) va organik tuzilmalarni taniydi.
   - Hujjat ichidagi barcha rasmlarni xavfsiz ajratib oladi va tegishli savollarga biriktiradi.
   - To‘liq o‘zbek tilida diagnostika hisoboti: to‘g‘ri savollar, xatoliklar va ogohlantirishlar.

2. **Haqiqiy Telegram Quiz Poll Dvigateli:**
   - Rasmiy Telegram Bot API `sendPoll` metodidan (`type: "quiz"`, `is_anonymous: false`) foydalanadi.
   - Guruhlarda jonli testlar (`Mode A: Live Group Quiz`) va deep link orqali individual testlar (`Mode B: Individual Quiz`).
   - Savollar orasidagi vaqt boshqaruvi (10s, 15s, 30s, 60s yoki cheklanmagan).
   - Bir vaqtning o‘zida bir nechta parallel guruh sessiyalari (9-A sinf, 10-B sinf) mustaqil ishlaydi.
   - Jonli leaderboard va medallar: 🥇 1-o‘rin, 🥈 2-o‘rin, 🥉 3-o‘rin.

3. **Professional O‘qituvchi Veb Paneli:**
   - Zamonaviy Next.js 14, Tailwind CSS, Lucide piktogrammalari va KaTeX formulalar renderi.
   - Real statistik ko‘rsatkichlar (testlar, savollar, faol sessiyalar, o‘rtacha ballar).
   - Vizual savollar muharriri: formulalarni kiritishda bir vaqtning o‘zida KaTeX da jonli ko‘rinish.
   - Savollar banki: mavzu, fan va qiyinlik darajasi bo‘yicha saralash.
   - Testlarni klonlash (duplicate), versiyalash va arxivlash.

4. **Telegram Mini App (Web App) Integratsiyasi:**
   - Telegram ilovasi ichida to‘g‘ridan-to‘g‘ri ochiladi.
   - Telegram `initData` ma’lumotlarini serverda HMAC-SHA256 imzosi orqali qat’iy tekshirish.
   - O‘qituvchi va o‘quvchi profillari uchun moslashuvchan (responsive) mobil dizayn.

5. **Professional Excel Hisobotlari (ExcelJS):**
   - **1-varaq: Umumiy natijalar:** Ishtirokchilar, to‘g‘ri/noto‘g‘ri javoblar, ball, foiz, sarflangan vaqt.
   - **2-varaq: Batafsil javoblar:** Har bir savol bo‘yicha tanlangan variant, to‘g‘ri javob va holati.
   - **3-varaq: Guruh statistikasi:** Guruh o‘rtacha bali, eng yuqori/past ball, savollar kesimidagi muvaffaqiyat foizi.
   - Formula Injection (CSV/XLSX Injection) dan xavfsiz himoya.

---

## 🛠 Texnologiyalar Steki

| Qatlam | Texnologiyalar |
| :--- | :--- |
| **Backend** | Node.js LTS, TypeScript (strict), NestJS, REST API, grammY (Telegram Bot API) |
| **Ma’lumotlar bazasi** | PostgreSQL, Prisma ORM |
| **Fon vazifalari** | Redis, BullMQ |
| **Frontend** | Next.js 14, React, Tailwind CSS, Lucide Icons, KaTeX |
| **Word & Media** | JSZip, fast-xml-parser, Mammoth |
| **Hisobotlar** | ExcelJS |
| **Testlash** | Vitest |

---

## 🚀 Tezkor Boshlash (Quick Start)

### 1. Bog‘liqliklarni o‘rnatish:
```bash
npm install
```

### 2. Muhit faylini yaratish:
```bash
# Windows:
Copy-Item .env.example .env

# Linux:
cp .env.example .env
```
`.env` faylida PostgreSQL, Redis va `BOT_TOKEN` parametrlarini ko‘rsating.

### 3. Ma’lumotlar bazasini tayyorlash:
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Dasturlash (Development) rejimida ishga tushirish:
```bash
npm run dev
```
- **Veb Boshqaruv Paneli:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:4000/api](http://localhost:4000/api)
- **Telegram Bot:** Mahalliy kompyuterda Long Polling rejimida avtomatik ishlaydi.

### 5. Ishlab chiqarish (Production) rejimida ishga tushirish:
```bash
npm run build
npm run start
```

---

## 📂 Loyiha Strukturasi

```text
smart-quiz-platform/
│
├── apps/
│   ├── api/          # NestJS REST API, grammY Telegram Bot, Mini App auth
│   └── web/          # Next.js 14 Veb Dashboard, Mini App va O'quvchi portali
│
├── packages/
│   ├── shared/          # Domen turlari, Zod sxemalari, o'zbekcha xabarlar
│   ├── database/        # Prisma PostgreSQL sxemasi, munosabatlar va seed
│   ├── docx-parser/     # JSZip, XML, OMML->LaTeX, kimyo va rasm ekstraktori
│   └── quiz-engine/     # Telegram Quiz Poll builder, scoring, leaderboard va ExcelJS
│
├── docs/
│   ├── WINDOWS_SETUP.md   # Windows o'rnatish qo'llanmasi
│   ├── LINUX_SETUP.md     # Linux va Nginx sozlash qo'llanmasi
│   ├── BOTFATHER_GUIDE.md # @BotFather va Mini App sozlash
│   ├── SECURITY_AUDIT.md  # Kiberxavfsizlik nazorat hisoboti
│   └── namuna_test.docx   # Namuna Word test fayli
│
├── scripts/
│   └── create-fixture.ts # Namuna Word .docx generatsiya qilish skripti
│
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Xavfsizlik Tamoyillari

- **HMAC-SHA256:** Telegram initData autentifikatsiyasi `crypto.timingSafeEqual` orqali tekshiriladi.
- **RBAC:** Super Admin, O‘qituvchi va O‘quvchi huquqlari server darajasida nazorat qilinadi.
- **Zip-Bomba Himoyasi:** Yuklanayotgan Word fayllar hajmi (max 20MB) va arxivdan yoyilish nisbati cheklangan.
- **XXE Himoyasi:** XML parserda tashqi entitiyalar taqiqlangan.
- **Excel Formula Injection:** `=, +, -, @` bilan boshlanuvchi yozuvlar xavfsizlashtiriladi.

Batafsil ma’lumot uchun [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) fayliga qarang.

---

## 📖 To‘liq Hujjatlar

- [Windows muhitida o‘rnatish (NO-DOCKER)](docs/WINDOWS_SETUP.md)
- [Linux muhitida o‘rnatish va Nginx sozlash](docs/LINUX_SETUP.md)
- [Telegram @BotFather sozlamalari](docs/BOTFATHER_GUIDE.md)
- [Kiberxavfsizlik audit hisoboti](docs/SECURITY_AUDIT.md)
