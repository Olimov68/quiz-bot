# Linux (Ubuntu/Debian) Muhitida O‘rnatish va Ishga Tushirish Qo‘llanmasi (NO-DOCKER)

Ushbu qo‘llanma **Smart Quiz Platform** tizimini Linux serverlarida (Ubuntu 22.04 / 24.04 LTS yoki Debian 12) **hech qanday Docker ishlatmasdan**, tizimning standart paketlari, systemd xizmatlari va Nginx orqali to‘liq o‘rnatish va sozlash tartibini taqdim etadi.

---

## 1. Tizim Paketlari, PostgreSQL va Redis O‘rnatish

```bash
# Tizimni yangilash
sudo apt update && sudo apt upgrade -y

# Zarur yordamchi vositalar
sudo apt install -y curl wget git build-essential nginx

# Node.js 20 LTS o'rnatish
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL va Redis o'rnatish
sudo apt install -y postgresql postgresql-contrib redis-server
```

Xizmatlarning ishlayotganini tekshirish:
```bash
sudo systemctl enable postgresql redis-server
sudo systemctl status postgresql redis-server
```

---

## 2. PostgreSQL Ma’lumotlar Bazasini Sozlash

```bash
sudo -u postgres psql
```

PostgreSQL ichida quyidagi buyruqlarni bajaring:
```sql
CREATE USER smartquiz_user WITH ENCRYPTED PASSWORD 'kuchli_parol_2026';
CREATE DATABASE smart_quiz_platform OWNER smartquiz_user;
GRANT ALL PRIVILEGES ON DATABASE smart_quiz_platform TO smartquiz_user;
\q
```

---

## 3. Loyihani Serverga Yuklash va Bog‘liqliklarni O‘rnatish

```bash
cd /var/www
git clone <sizning-repo-manzilingiz> smart-quiz-platform
cd smart-quiz-platform

# Ruxsatlarni to'g'rilash
sudo chown -R $USER:$USER /var/www/smart-quiz-platform

# Bog'liqliklarni o'rnatish
npm install
```

---

## 4. Muhit Fayli (.env) Sozlash

```bash
cp .env.example .env
nano .env
```

Quyidagi qatorlarni o‘z serveringizga moslang:
```env
NODE_ENV=production

BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
BOT_USERNAME=smartquiz_bot

DATABASE_URL="postgresql://smartquiz_user:kuchli_parol_2026@localhost:5432/smart_quiz_platform?schema=public"
REDIS_URL="redis://127.0.0.1:6379"

API_PORT=4000
WEB_PORT=3000

PUBLIC_API_URL="https://quiz.sizningdomen.uz/api"
PUBLIC_WEB_URL="https://quiz.sizningdomen.uz"

# Production Webhook sozlamalari
TELEGRAM_WEBHOOK_URL="https://quiz.sizningdomen.uz/api/bot/webhook"
TELEGRAM_WEBHOOK_SECRET="super_secret_webhook_token_32chars"

SUPER_ADMIN_TELEGRAM_IDS=123456789
JWT_SECRET=juda_kuchli_jwt_maxfiy_kaliti_2026_xyz
```

---

## 5. Baza Migratsiyasi va Build

```bash
npm run db:generate
npm run db:migrate
npm run build
```

---

## 6. Systemd Xizmati Orqali Avtomatik Ishga Tushirish

Backend API va Bot uchun xizmat fayli:
```bash
sudo nano /etc/systemd/system/smartquiz-api.service
```

Quyidagilarni kiriting:
```ini
[Unit]
Description=Smart Quiz Platform API and Bot Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/smart-quiz-platform
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
EnvironmentFile=/var/www/smart-quiz-platform/.env

[Install]
WantedBy=multi-user.target
```

Frontend (Next.js) uchun xizmat:
```bash
sudo nano /etc/systemd/system/smartquiz-web.service
```

```ini
[Unit]
Description=Smart Quiz Platform Web Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/smart-quiz-platform/apps/web
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Xizmatlarni yoqish va ishga tushirish:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now smartquiz-api smartquiz-web
```

---

## 7. Nginx va SSL (Let's Encrypt) Sozlash

```bash
sudo nano /etc/nginx/sites-available/smart-quiz
```

Konfiguratsiya:
```nginx
server {
    server_name quiz.sizningdomen.uz;

    client_max_body_size 50M;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API & Webhook
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Statik media fayllari
    location /media/ {
        proxy_pass http://localhost:4000/media/;
    }
}
```

Saytni faollashtirish va bepul SSL olish:
```bash
sudo ln -s /etc/nginx/sites-available/smart-quiz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Certbot orqali SSL olish
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d quiz.sizningdomen.uz
```
