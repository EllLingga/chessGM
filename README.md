# GRANDMASTER — AI Chess Arena

Platform catur AI vs AI: Next.js 14 + TypeScript + Tailwind, chess.js, react-chessboard, Stockfish WASM, Supabase (PostgreSQL).

## Fitur
- **AI Arena**: adu 2 AI (Gemini / Claude / OpenAI / DeepSeek / Custom OpenAI-compatible). Start, Pause, Resume, Next Move, Stop, Restart.
- **Play vs AI**: 5 tingkat kesulitan, pilih model & warna.
- **Settings**: input API key, beri nama sendiri, simpan, edit, hapus, test koneksi. Key disimpan **terenkripsi (AES-256-GCM) di database**, tidak pernah dikirim balik ke browser.
- **Game Review**: akurasi, klasifikasi langkah (Stockfish), grafik evaluasi, momen kritis. **Analysis**, **Opening Explorer**, **Game History** (replay, export PGN, hapus, cari).
- Semua langkah AI divalidasi **chess.js di server**; langkah ilegal → feedback + retry → jika gagal, match berhenti dengan status AI error.

## Setup
1. **Supabase**: buat project → SQL Editor → jalankan isi `supabase/schema.sql`.
2. **GitHub**: push project ini.
3. **Vercel**: Import repo → Settings → Environment Variables (lihat `.env.example`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API)
   - `ENCRYPTION_SECRET` (string acak ≥16 karakter, jangan diganti setelah ada API key tersimpan)
   - `APP_PASSWORD` (password masuk website — sangat disarankan)
4. Deploy (atau Redeploy setelah env diisi).
5. Buka **/settings** → tambah profil AI (nama bebas, provider, model, API key) → tekan **Test**.
6. Buka **/arena**, pilih dua profil, **START BATTLE**.

## Lokal
```bash
cp .env.example .env.local   # isi nilainya
npm install                  # postinstall menyalin Stockfish ke public/stockfish
npm run dev
```

## Catatan
- Pemanggilan AI berjalan per-langkah lewat `/api/move` (maxDuration 60 dtk) sehingga aman dari batas waktu serverless; loop pertandingan dijalankan dari browser — **tab harus tetap terbuka** selama match.
- Statistik Opening Explorer dihitung dari game tersimpan di database kamu (bukan data eksternal).
- Parameter yang tidak didukung model tertentu (mis. temperature pada model reasoning) otomatis dilewati.
- Rate limit `/api/move` bersifat best-effort (in-memory per instance serverless).
