# Arsitektur Try Out Nakafa

Dokumen ini menjelaskan arsitektur try out Nakafa dengan bahasa yang bisa dibaca
oleh product, ops, support, dan engineering.

Dokumen ini tidak menggantikan source of truth teknikal. Ia merangkum bagaimana
sistem bekerja hari ini supaya orang tidak perlu membaca banyak file sekaligus.

Dokumen terkait:

- `../README.md`
- `./PRODUCT_POLICY.id.md`
- `../../irt/README.md`
- `../../irt/docs/EXPLAINER.id.md`
- `../../irt/docs/ARCHITECTURE.id.md`

## Ringkasan Singkat

Try out Nakafa sekarang dibagi menjadi empat lapisan besar:

- `contentSync/` mendeteksi try out dari content dan menyimpan katalog browse
- `tryoutAccess/` menentukan siapa yang boleh mulai
- `tryouts/` menjalankan lifecycle attempt dan membaca hasil
- `irt/` menjaga kualitas score internal dan publikasi frozen scale

Bahasa sederhananya:

- katalog try out dibentuk dari content yang sudah disync
- user melihat katalog itu di hub dan halaman produk
- saat user menekan mulai, backend menentukan sumber akses yang sah
- attempt lalu terkunci ke snapshot part dan frozen scale yang berlaku saat itu
- hasil publik yang dilihat user mengikuti policy produk, bukan sekadar status
  internal IRT

## Tujuan Desain

Arsitektur ini dibuat supaya:

- katalog hub bisa dipaginasi dengan benar tanpa scan penuh
- akses event dan Pro tidak saling menebak state satu sama lain
- attempt lama tetap stabil walaupun content berubah setelah sync
- kualitas psychometric tetap dipisah dari finalitas event
- dev dan prod bisa disegarkan ulang lewat sync yang sama

## Komponen Utama

### `contentSync/`

Tanggung jawab:

- mendeteksi try out dari `exerciseSets`
- menulis `tryouts` dan `tryoutPartSets`
- menulis read model katalog:
  - `tryoutCatalogEntries`
  - `tryoutCatalogMeta`

Artinya hub frontend tidak membaca seluruh `tryouts` lalu menyortir sendiri.
Urutan browse sudah dipersist ke katalog.

### `tryoutAccess/`

Tanggung jawab:

- membaca campaign dan link akses event
- menentukan grant aktif untuk `competition` atau `access-pass`
- menyinkronkan status grant dan jendela aktif event

Lapisan ini hanya menjawab pertanyaan:

> user ini boleh mulai dari jalur akses apa sekarang?

### `tryouts/`

Tanggung jawab:

- menyediakan query katalog hub
- menyediakan detail satu try out
- membuat dan melanjutkan attempt
- menyimpan snapshot part saat start
- menyimpan provenance akses attempt
- menampilkan hasil terakhir dan history attempt

Lapisan ini adalah runtime utama yang dilihat user.

### `irt/`

Tanggung jawab:

- menjaga frozen scale agar try out tetap startable
- mengkalibrasi item dari respons nyata
- memutuskan apakah hasil bisa naik menjadi `official`
- mempromosikan hasil lama saat official scale baru terbit

Lapisan ini tidak menentukan finalitas event. Ia menentukan kualitas
psychometric internal.

## Tabel Penting

### Katalog Browse

- `tryoutCatalogEntries`
  - satu baris kecil untuk satu kartu/package di hub
  - menyimpan `catalogSortKey` supaya pagination mengikuti urutan produk final
- `tryoutCatalogMeta`
  - menyimpan `activeCount` per `{product, locale}`
  - dipakai badge jumlah package tanpa scan penuh

### Definisi Try Out

- `tryouts`
  - definisi runtime satu try out
- `tryoutPartSets`
  - mapping part ke `exerciseSets`

### Runtime Attempt

- `tryoutAttempts`
  - lifecycle attempt level try out
- `tryoutPartAttempts`
  - lifecycle attempt level part yang menunjuk ke `exerciseAttempts`
- `userTryoutLatestAttempts`
  - pointer cepat ke status attempt terakhir per user dan try out

### Hasil dan Ranking

- `tryoutLeaderboardEntries`
  - best official result per user untuk namespace tertentu
- `userTryoutStats`
  - agregat personal untuk leaderboard/product

## Journey User

### 1. User membuka hub try out

- server membaca `getActiveTryoutCatalogMeta`
- client membaca `getActiveTryoutCatalogPage` dengan `usePaginatedQuery`
- setiap page sudah datang dalam urutan final yang benar
- jika user login, page itu juga membawa status latest attempt untuk baris yang
  sedang ditampilkan

### 2. User membuka halaman detail try out

- backend membaca `getTryoutDetails`
- halaman ini memakai slug runtime yang sudah dideteksi saat sync

### 3. User menekan mulai

- `startTryout` memverifikasi auth
- backend membaca access source aktif:
  - `competition`
  - `access-pass`
  - Pro subscription
- backend memilih access source yang sah sesuai policy produk
- backend mengikat attempt ke frozen scale terbaru yang aman dipakai
- backend menyimpan snapshot part dan provenance akses

### 4. User mengerjakan per part

- `startPart` memakai snapshot yang sudah disimpan saat attempt dibuat
- timer dan jumlah soal tidak boleh menebak dari content live yang mungkin sudah
  berubah
- `completePart` menyimpan score part

### 5. User melihat hasil

- hasil terbaru dibaca dari `queries/me/attempt.ts`
- history attempt dibaca dari `queries/me/history.ts`
- label publik mengikuti policy:
  - `Estimasi Awal`
  - `Terverifikasi IRT`
  - `Final Event`

## Alur Data End To End

```mermaid
flowchart TD
    A[Filesystem content] --> B[content sync]
    B --> C[tryouts]
    B --> D[tryoutPartSets]
    B --> E[tryoutCatalogEntries]
    B --> F[tryoutCatalogMeta]
    E --> G[Hub page query]
    F --> G
    G --> H[User memilih package]
    H --> I[startTryout]
    I --> J[resolveTryoutAccessSources]
    I --> K[get latest frozen scale]
    J --> L[tryoutAttempts]
    K --> L
    L --> M[startPart / completePart]
    M --> N[Result queries]
    N --> O[Public status shown to user]
```

## Alur Akses dan Result

```mermaid
flowchart TD
    A[User mau mulai try out] --> B{punya access source?}
    B -- competition --> C[attempt event dihitung untuk competition]
    B -- access-pass --> D[attempt event biasa]
    B -- subscription --> E[attempt subscription]
    C --> F{event finalized?}
    F -- belum --> G[Estimasi Awal]
    F -- sudah --> H[Final Event]
    D --> I{IRT official?}
    E --> I
    I -- belum --> G
    I -- sudah --> J[Terverifikasi IRT]
```

## Kenapa Katalog Punya Tabel Sendiri?

Karena hub butuh tiga hal sekaligus:

- urutan final yang stabil
- exact count untuk badge
- pagination yang bounded dan murah

Kalau hub membaca `tryouts` langsung lalu menyortir setelah query:

- caller harus memuat semua page dulu
- count badge butuh scan penuh atau workaround
- urutan final tidak hidup di storage layer

Dengan `tryoutCatalogEntries` dan `tryoutCatalogMeta`:

- query Convex sudah sesuai kebutuhan UI
- hub bisa paginasi page per page
- count tetap exact tanpa scan besar

## Frontend Contract

Hub dan halaman produk sekarang mengikuti kontrak ini:

- server component:
  - baca translations
  - baca `getActiveTryoutCatalogMeta`
- client component:
  - baca `getActiveTryoutCatalogPage`
  - group by `cycleKey`
  - load more dengan `Intersection`

Artinya path lama yang menghabiskan semua page di Next server sudah tidak
dipakai lagi.

## Checklist Ops Dan Engineering

Kalau schema atau write path try out berubah:

1. deploy backend Convex
2. jalankan sync fresh di dev
3. verifikasi katalog dan integrity IRT
4. jalankan sync fresh di prod
5. verifikasi lagi di prod

Perintah penting:

- `pnpm --filter @repo/backend sync`
- `pnpm --filter @repo/backend sync:prod`
- `pnpm --filter @repo/backend irt:verify:cache`
- `pnpm --filter @repo/backend irt:verify:scale`
- `pnpm --filter @repo/backend irt:prod:verify:cache`
- `pnpm --filter @repo/backend irt:prod:verify:scale`

## Pertanyaan Yang Sering Salah Dipahami

### Apakah hub membaca semua try out sekaligus?

Tidak. Hub membaca meta count kecil dan page katalog kecil.

### Apakah status badge hub membaca semua package status sekaligus?

Tidak. Status latest attempt hanya dibaca untuk row yang sedang ada di page aktif.

### Apakah `Final Event` sama dengan `official`?

Tidak. `Final Event` adalah finalitas produk event. `official` adalah finalitas
IRT internal.

### Apakah content sync hanya membuat definisi try out?

Tidak. Content sync juga mengisi read model katalog yang dipakai frontend.
