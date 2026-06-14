# Gunakan base image resmi Node.js yang ringan (versi 20)
FROM node:20-slim

# Install OpenSSL dan dependensi dasar (sering kali dibutuhkan oleh Prisma Engine)
RUN apt-get update -y && apt-get install -y openssl

# Set direktori kerja di dalam container
WORKDIR /app

# Copy file konfigurasi package npm
COPY package*.json ./

# Install dependensi Node.js
RUN npm install

# Copy seluruh source code project ke dalam container
COPY . .

# Generate Prisma Client agar bisa mengakses database Supabase
RUN npx prisma generate

# Ekspos port default (Railway akan otomatis me-routing variabel PORT)
EXPOSE 3000

# Jalankan server Express (sesuaikan "app.js" dengan nama file utama kamu, misal "server.js" atau "index.js")
CMD ["npm", "start"]
