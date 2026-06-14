# Production Docker Setup

Setup ini ditujukan untuk production dengan database external/managed PostgreSQL, misalnya Supabase, Neon, Railway Postgres, Render Postgres, atau AWS RDS.

## Rekomendasi Arsitektur

Gunakan:

```text
Backend API: Dockerfile.production
Database: managed PostgreSQL external
Uploads: cloud storage untuk production serius
Environment variables: disimpan di dashboard platform
Migration: npx prisma migrate deploy
```

Hindari menyimpan database production di container yang sama dengan API.

## File Yang Dipakai

```text
Dockerfile.production
.env.production.example
```

`docker-compose.yml` tetap boleh dipakai untuk development lokal, tetapi production sebaiknya memakai `Dockerfile.production` dan database external.

## Environment Variables Wajib

Minimal isi:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
JWT_SECRET=secret-production-yang-panjang
CORS_ORIGINS=https://domain-frontend-kamu.com
FRONTEND_URL=https://domain-frontend-kamu.com
```

Jangan gunakan:

```env
JWT_SECRET=docker-dev-secret-change-me
POSTGRES_PASSWORD=postgres
```

untuk production.

## Build Image Production

```bash
docker build -f Dockerfile.production -t melanoma-api:production .
```

## Run Production Container

Contoh dengan env file:

```bash
cp .env.production.example .env.production
```

Edit `.env.production`, lalu jalankan:

```bash
docker run -d \
  --name melanoma-api \
  --env-file .env.production \
  -p 3000:3000 \
  -v melanoma-uploads:/app/uploads \
  melanoma-api:production
```

Container akan menjalankan migration otomatis sebelum start:

```bash
npx prisma migrate deploy && npm start
```

## Deploy Ke Railway / Render / Platform Cloud

Set build Dockerfile ke:

```text
Dockerfile.production
```

Set environment variables di dashboard platform:

```text
DATABASE_URL
JWT_SECRET
CORS_ORIGINS
FRONTEND_URL
AI_BASE_URL atau AI_PREDICT_URL/AI_GRADCAM_URL jika fitur scan AI dipakai
SMTP_* jika fitur email dipakai
```

Pastikan platform expose port dari variable:

```text
PORT
```

Project ini sudah membaca:

```js
process.env.PORT || 3000
```

## Catatan Migration

`Dockerfile.production` menjalankan migration saat container start.

Ini praktis untuk satu instance. Jika production memakai beberapa replica/container, lebih aman jalankan migration sebagai step terpisah sebelum deploy:

```bash
npx prisma migrate deploy
```

Lalu ubah command start menjadi:

```bash
npm start
```

## Catatan Uploads

Saat ini file upload disimpan di folder:

```text
/app/uploads
```

Untuk production sederhana di VPS, mount volume:

```bash
-v melanoma-uploads:/app/uploads
```

Untuk production yang lebih aman, gunakan object storage seperti S3, Cloudinary, Supabase Storage, atau storage bawaan platform.

## Health Check Manual

Setelah container jalan:

```bash
docker logs -f melanoma-api
```

Cek API:

```bash
curl http://localhost:3000/api/guest/system-status
```

Jika endpoint itu tidak tersedia, cek route lain yang public di project kamu.
