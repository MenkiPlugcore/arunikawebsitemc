# ARUNIKA

Website pusat informasi server Minecraft ARUNIKA. Tema wheat dan putih, logo ARUNIKA transparan, dan pilihan 10 bahasa: Indonesia, English, Japanese, Spanish, Arabic, Thai, Vietnamese, Malay, Korean, Chinese Traditional.

Halaman: Beranda, About, Leaderboard, Store, dan Live Map. Tata letak bahasa Arab memakai RTL. Preferensi bahasa tersimpan di browser. Tidak membutuhkan framework atau dependency untuk menjalankan website.

## Deploy ke Cloudflare Pages

Di dashboard Cloudflare, buka **Workers & Pages → Create application → Pages → Import an existing Git repository**, lalu pilih **MenkiPlugcore/arunikawebsitemc**.

| Pengaturan | Nilai |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `exit 0` |
| Build output directory | `dist` |
| Root directory | kosong / root repository |
| Environment variables | belum diperlukan |

Klik **Save and Deploy**. Pilih **Pages** untuk konfigurasi di atas. Website adalah HTML/CSS/JavaScript statis; tidak perlu mengunggah folder lain ke output Pages. `dist/index.html` adalah halaman utama dan navigasi memakai hash (`#about`, `#store`, dan seterusnya).

Konfigurasi CLI tersedia dalam `wrangler.toml`. Untuk deploy manual dari komputer yang sudah terhubung ke akun Cloudflare:

```sh
npx wrangler pages deploy dist --project-name arunikawebsitemc
```

Nama project harus sesuai dengan project Pages yang dibuat di akunmu. Tidak ada token Cloudflare atau GitHub di repository.

Referensi resmi: [Static HTML on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) dan [Wrangler configuration for Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

## Pengaturan server

Edit `dist/config.js`, lalu commit perubahan. Semua konfigurasi di file ini bersifat publik.

```js
window.ARUNIKA_CONFIG = {
  javaAddress: '',
  bedrockAddress: '',
  bedrockPort: '',
  statusEndpoint: '',
  leaderboardEndpoint: '',
  mapUrl: '',
  discordUrl: ''
};
```

Alamat, data statistik, dan map masih kosong. Website menampilkan **belum terhubung** sampai sumber data asli dipasang. Store masih rancangan kategori, tanpa produk/harga atau transaksi aktif. Logo dari pengelola tersedia di `dist/assets/arunika-hero.png`. Nama pemain dan alamat server tidak diterjemahkan. Bahasa peta eksternal mengikuti layanan peta tersebut.

### Status server

`statusEndpoint` harus berupa URL HTTPS yang mengizinkan CORS dari domain website, dan menghasilkan JSON:

```json
{
  "online": true,
  "playersOnline": 12,
  "playersMax": 100,
  "version": "1.21.x",
  "latencyMs": 32,
  "updatedAt": "2026-10-13T00:00:00Z"
}
```

Contoh di atas hanya dokumentasi, bukan data yang ditampilkan. Backend/plugin monitoring harus memasok data asli dengan waktu terkini. Website meminta pembaruan setiap 30 detik dan menolak data yang berusia lebih dari 120 detik. `latencyMs` adalah hasil pengukuran monitor, bukan ping dalam game masing-masing pengunjung. Gangguan koneksi ditampilkan sebagai status tidak tersedia.

### Leaderboard

`leaderboardEndpoint` harus mendukung HTTPS/CORS dan menghasilkan JSON:

```json
{
  "updatedAt": "2026-10-13T00:00:00Z",
  "playtime": [{ "name": "ExamplePlayer", "value": 10 }],
  "balance": [],
  "kills": []
}
```

`playtime` memakai satuan jam. Nilai diurutkan dari terbesar, maksimal 100 pemain per kategori. Data yang berusia lebih dari lima menit ditolak. API harus diperbarui oleh sumber data server asli.

### Live Map

Isi `mapUrl` dengan URL HTTPS map server yang mengizinkan iframe. Website juga menyediakan tautan membuka map di tab baru. Privasi dan lokasi pemain ditentukan layanan map.

## Pemeriksaan

Dengan Node.js 20 atau lebih baru:

```sh
npm run check
```

Pemeriksaan mencakup sintaks JavaScript, referensi asset lokal, navigasi, kelengkapan 10 kamus, rebranding ARUNIKA, penyimpanan bahasa, dan Arabic RTL. Build opsional `npm run build` menjalankan pemeriksaan; file produksi sudah tersedia di `dist`. Pemeriksaan tampilan visual melalui browser belum dilakukan pada proses migrasi.
