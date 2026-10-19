# ARUNIKA

Website pusat informasi server Minecraft ARUNIKA. Tema hijau dan emas, logo ARUNIKA transparan pada navbar dan hero, dan pilihan 10 bahasa: Indonesia, English, Japanese, Spanish, Arabic, Thai, Vietnamese, Malay, Korean, Chinese Traditional.

Halaman: Beranda, About, Leaderboard, Store, dan Live Map. Tata letak bahasa Arab memakai RTL. Preferensi bahasa tersimpan di browser. Tidak membutuhkan framework atau dependency untuk menjalankan website.

## Deploy ke Cloudflare Workers (sesuai project saat ini)

Konfigurasi default `wrangler.toml` memakai **Workers Static Assets** untuk melayani isi folder `dist`. Website statis ini tidak membutuhkan script Worker `main`.

Di pengaturan build Cloudflare untuk project yang sudah terhubung ke repository **MenkiPlugcore/arunikawebsitemc**, gunakan:

| Pengaturan | Nilai |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | kosong / root repository |
| Worker name | `arunikawebsitemc` (sesuaikan `name` di konfigurasi jika berbeda) |
| Environment variables aplikasi | belum diperlukan |

Setelah commit perbaikan masuk ke `main`, gunakan build baru yang mengambil commit tersebut. Integrasi Cloudflare yang sudah terhubung dapat memulai build otomatis. Jangan memakai log build lama sebagai hasil pemeriksaan commit baru.

Konfigurasi default:

```toml
name = "arunikawebsitemc"
compatibility_date = "2026-10-13"

[assets]
directory = "./dist"
```

Log yang menjalankan `npx wrangler deploy` menunjukkan alur Workers. Key `pages_build_output_dir` khusus Pages tidak dipakai di konfigurasi default karena tidak menyediakan direktori assets bagi alur Workers.

Referensi resmi: [Migrasi Pages ke Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) dan [Konfigurasi Workers assets](https://developers.cloudflare.com/workers/wrangler/configuration/#assets).

## Alternatif: Cloudflare Pages

Jika sengaja ingin membuat project **Pages** terpisah, pilih **Workers & Pages → Create application → Pages → Import an existing Git repository** lalu pilih repository ini.

| Pengaturan | Nilai |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `exit 0` |
| Build output directory | `dist` |
| Root directory | kosong / root repository |

Konfigurasi Pages opsional tersedia dalam `wrangler.pages.toml`. Untuk deploy Pages manual dari komputer yang sudah terhubung ke akun Cloudflare dan memiliki project Pages:

```sh
npx wrangler pages deploy dist --config wrangler.pages.toml --project-name arunikawebsitemc
```

Nama project harus sesuai dengan project Pages di akunmu. Tidak ada token Cloudflare atau GitHub di repository.

Referensi resmi: [Static HTML on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/).

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

Alamat, data statistik, dan map masih kosong. Website menampilkan **belum terhubung** sampai sumber data asli dipasang. Store menampilkan 6 rank dari kartu yang diberikan pengelola, diurutkan dari termurah: Dawn Rp15.000, Sunflare Rp35.000, Meadow Rp65.000, Horizon Rp120.000, Aurora Rp150.000, Zenith Rp300.000. Klik gambar atau kartu membuka WhatsApp admin 6285703163488 dengan nama rank, harga, dan kolom nickname; tidak mengirim pesan otomatis atau memproses pembayaran di website. Bagian rancangan Cosmetics & bundles di Store sudah dihapus; fitur cosmetic, furniture, mount, dan pet dijelaskan pada halaman About. Logo navbar tersedia di `dist/assets/arunika-hero.png`; ilustrasi ARUNIKA dengan pulau Minecraft pada hero tersedia di `dist/assets/arunika-world-hero.png`. Nama pemain dan alamat server tidak diterjemahkan. Bahasa peta eksternal mengikuti layanan peta tersebut.

### Status server

Status server Java ARUNIKA memakai `https://api.mcstatus.io/v2/status/java/arunikamc.cadera.site` di `dist/config.js`. Website menyesuaikan respons API (status online, jumlah pemain, versi, dan waktu pengecekan) ke format internal. Server yang menggunakan maintenance MOTD bisa menyembunyikan versi numerik Minecraft, sehingga `javaVersion: '1.21.11'` menjadi fallback manual (hanya bila server terdeteksi online dan versi numerik dari API tidak tersedia). Jika versi Java berubah, perbarui `javaVersion` di `dist/config.js`.

Kolom **LATENSI MONITOR** menampilkan waktu respons permintaan HTTPS dari browser pengunjung ke API status jika API tidak memberikan angka latensi. Angka ini *bukan* ping protokol Minecraft, bukan RTT antara server Minecraft dan pemain, dan dapat mencakup waktu query/cache API. Tooltip pada angka menjelaskan asal metrik. Untuk ping Minecraft asli, gunakan plugin/backend ping server khusus. Hasil status API dapat tertunda karena cache; integrasi ini tidak mengubah IP, port, atau Geyser/Floodgate.

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

## Gambar rank dan pesanan WhatsApp

Gambar rank berada di `dist/assets/ranks/` sebagai WebP lossless dengan ukuran dan tampilan asli tetap terjaga. Store menyajikan gambar rank langsung sebagai tautan WhatsApp. Nama, harga, benefit, dan ajakan memesan tetap tersedia bagi pembaca layar melalui teks `sr-only`; informasi produk mengikuti ZIP sumber pengelola. Nomor WhatsApp serta pesan disimpan pada tautan gambar di bagian store pada `dist/index.html`. Efek CSS berupa kemunculan bertahap, gerak hover pada perangkat dengan pointer, dan respons tekan memakai transform/opacity tanpa animasi berulang; efek dinonaktifkan saat `prefers-reduced-motion: reduce`. Perubahan teks bahasa website tidak menerjemahkan teks dalam gambar sumber; teks gambar dan pesan WhatsApp tetap memakai Bahasa Indonesia.

## Halaman About

Menampilkan cosmetic unik, furniture custom, mount/pet yang bisa ditunggangi, dan 13 fitur dari pengelola: Player Shop, Auction, Auto Capicator (Shift untuk satu batang), Auto Stack Item Drop + Mob, Rank Berbayar Ingame, Modeling, Gacha, Vote, Quests, Storyline ARUNIKA, 5 Senjata Legend, AURA SKILL, dan Custom Enchant (Advanced Enchantments).

## Ilustrasi kartu fitur

Ketiga belas kartu fitur memakai gambar kiriman pengelola. Batch pertama meliputi Player Shop, Auction, Auto Capicator, Auto Stack Item Drop + Mob, Rank Berbayar Ingame, Modeling, Gacha, Vote, Quests, dan Storyline ARUNIKA (1672 × 941). Batch kedua melengkapi AURA SKILL dan Custom Enchant (1920 × 1080). Fitur 5 Senjata Legend menggunakan ilustrasi terbaru pengelola (1536 × 864). File web tersedia di `dist/assets/features/` dalam WebP kualitas tinggi, dengan ukuran asli dan komposisi penuh dipertahankan. Gambar memakai lazy loading. Judul/deskripsi HTML tetap diterjemahkan ke 10 bahasa; tulisan dalam gambar mengikuti sumber Bahasa Indonesia.


## Slider fitur

Galeri About menampilkan satu dari 13 fitur pada satu waktu. Gambar tampil utuh dengan keterangan di samping pada layar lebar dan di bawah pada HP. Navigasi memakai panah, penanda slide, geser gambar, dan keyboard (Left/Right, Home, End); slide pertama dan terakhir saling tersambung. Arah navigasi mengikuti Arabic RTL, dan pergantian bahasa mempertahankan fitur aktif. Label kontrol serta pengumuman pembaca layar tersedia dalam 10 bahasa.

Slider memakai JavaScript native tanpa dependency atau autoplay. Efek perpindahan berupa transform/opacity singkat dan mengikuti pengaturan reduced motion. Gambar tetap memakai lazy loading. Jika JavaScript tidak aktif, galeri tetap bisa digeser horizontal melalui CSS scroll snap.
