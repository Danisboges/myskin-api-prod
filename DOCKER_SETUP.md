# Docker Setup

Panduan ini menjalankan backend `melanoma-api` dengan Docker Compose dan PostgreSQL lokal di container.

## Prasyarat

1. Install Docker Desktop.
2. Pastikan Docker Desktop sedang running.
3. Buka terminal di folder project ini.

## Setup Pertama Kali

Copy file env Docker:

```bash
cp .env.docker.example .env.docker
```

Di Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env.docker
```

Edit `.env.docker`, minimal ubah:

```env
JWT_SECRET=isi-dengan-secret-yang-panjang
```

Jalankan container:

```bash
docker compose up --build
```

API akan jalan di:

```text
http://localhost:3000
```

Database PostgreSQL dari host dapat diakses di:

```text
localhost:5433
user: postgres
password: postgres
database: melanoma
```

## Menjalankan Migration

Migration otomatis dijalankan saat container API start:

```bash
npx prisma migrate deploy
```

Jika ingin menjalankan manual:

```bash
docker compose exec api npx prisma migrate deploy
```

## Menjalankan Seed

Jika ingin mengisi data awal:

```bash
docker compose exec api npx prisma db seed
```

## Melihat Log

```bash
docker compose logs -f api
```

atau:

```bash
docker compose logs -f db
```

## Stop Container

```bash
docker compose down
```

Stop sekaligus hapus database volume:

```bash
docker compose down -v
```

Gunakan `down -v` hanya jika ingin reset database Docker.

## Ollama Chatbot

Jika chatbot memakai Ollama di Windows host:

1. Install Ollama di Windows.
2. Jalankan:

```powershell
ollama pull gemma2
ollama serve
```

3. Pastikan `.env.docker` berisi:

```env
OLLAMA_HOST=http://host.docker.internal:11434
```

Jika endpoint chatbot masih gagal, cek apakah Ollama bisa diakses:

```bash
docker compose exec api node -e "fetch('http://host.docker.internal:11434/api/tags').then(r=>console.log(r.status)).catch(console.error)"
```

## Troubleshooting

Jika port 3000 sudah dipakai, ubah bagian `ports` di `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"
```

Lalu akses API dari:

```text
http://localhost:3001
```

Jika port database 5433 sudah dipakai, ubah:

```yaml
ports:
  - "5434:5432"
```

Jika Prisma gagal connect database, pastikan container database healthy:

```bash
docker compose ps
```

Jika perlu rebuild dari nol:

```bash
docker compose down -v
docker compose up --build
```
