# Referensi Pattern Latihan Soal

Pattern detail buat bikin latihan soal di Nakafa.

## Kategori dan Tipe Latihan

### Kategori

- `high-school`: Level SMA/SMK/MA
- `middle-school`: Level SMP/MTs

### Tipe

**High School:**
- `tka`: Tes Kemampuan Akademik
- `snbt`: Seleksi Nasional Berbasis Tes

**Middle School:**
- `grade-9`: Kelas 9 (persiapan masuk SMA)

### Materi (Mapel)

**TKA:**
- `mathematics`: Matematika

**SNBT:**
- `quantitative-knowledge`: Pengetahuan Kuantitatif
- `mathematical-reasoning`: Penalaran Matematika
- `general-reasoning`: Penalaran Umum
- `indonesian-language`: Bahasa Indonesia
- `english-language`: Bahasa Inggris
- `general-knowledge`: Pengetahuan Umum
- `reading-and-writing-skills`: Literasi Membaca dan Menulis

## Pattern Struktur File

```
exercises/
├── {category}/              # high-school | middle-school
│   ├── {type}/              # tka | snbt | grade-9
│   │   ├── {material}/      # mathematics | quantitative-knowledge | ...
│   │   │   ├── {set}/       # try-out/set-1 | try-out/set-2 | ...
│   │   │   │   ├── {number}/ # 1, 2, 3, ..., 25
│   │   │   │   │   ├── _question/
│   │   │   │   │   │   ├── id.mdx
│   │   │   │   │   │   └── en.mdx
│   │   │   │   │   ├── _answer/
│   │   │   │   │   │   ├── id.mdx
│   │   │   │   │   │   └── en.mdx
│   │   │   │   │   └── choices.ts
```

## Pattern File Soal

### Struktur Dasar

```mdx
export const metadata = {
  title: "Soal {number}",
  authors: [{ name: "Nama Author" }],
  date: "MM/DD/YYYY",
};

{Teks soal pake <InlineMath math="..." /> buat semua math}

<BlockMath math="..." />
```

### Contoh: Math Sederhana

```mdx
export const metadata = {
  title: "Soal 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui <InlineMath math="a = \\frac{1}{2}" />, <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

Nilai dari

<BlockMath math="\\frac{a^{-2}bc^3}{ab^2c^{-1}} = ...." />
```

### Contoh: Dengan Grafik

```mdx
export const metadata = {
  title: "Soal 25",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui persamaan lingkaran <InlineMath math="x^2 + y^2 + 2x - 6y + 2 = 0" />. Persamaan garis singgung pada lingkaran yang sejajar dengan garis <InlineMath math="x - y + 3 = 0" /> adalah ...
```

### Poin Penting

1. **Format Tanggal**: Selalu `MM/DD/YYYY`
2. **Math di Mana-mana**: Semua angka harus pake `<InlineMath math="..." />`
3. **BlockMath**: Buat persamaan yang berdiri sendiri
4. **Nomor Referensi**: `<InlineMath math="(1)" />` bukan `(1)`
5. **List**: Pake list Markdown standar

## Pattern File Pembahasan

### Struktur

```mdx
export const metadata = {
  title: "Pembahasan Soal {number}",
  authors: [{ name: "Nama Author" }],
  date: "MM/DD/YYYY",
};

#### {Judul Deskriptif 1}

Teks penjelasan pake <InlineMath math="..." />.

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

#### {Judul Deskriptif 2}

Penjelasan lagi...

Jadi, {kesimpulan}.
```

### Contoh: Penyelesaian Step-by-Step

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui: <InlineMath math="a = \\frac{1}{2}" />; <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

<MathContainer>
<BlockMath math="\\frac{a^{-2}bc^3}{ab^2c^{-1}} = \\frac{bc^3}{ab^2} \\cdot \\frac{c^1}{a^2}" />

<BlockMath math="= \\frac{2 \\cdot 1^3}{\\left(\\frac{1}{2}\\right) \\cdot 2^2} \\cdot \\frac{1^1}{\\left(\\frac{1}{2}\\right)^2}" />

<BlockMath math="= \\frac{2 \\cdot 4}{2} = 4" />
</MathContainer>

Jadi, nilai dari ekspresi tersebut adalah <InlineMath math="4" />.
```

### Contoh: Dengan Komponen Grafik

```mdx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export const metadata = {
  title: "Pembahasan Soal 25",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui lingkaran <InlineMath math="L = x^2 + y^2 + 2x - 6y + 2 = 0" /> sejajar dengan garis <InlineMath math="x - y + 3 = 0" />.

#### Nyari Jari-Jari Lingkaran

Bentuk umum lingkaran <InlineMath math="(x - a)^2 + (y - b)^2 = r^2" /> bisa ditentuin dari persamaan <InlineMath math="L" />

<MathContainer>
<BlockMath math="x^2 + y^2 + 2x - 6y + 2 = 0" />

<BlockMath math="(x + 1)^2 - 1 + (y - 3)^2 - 9 = -2" />

<BlockMath math="(x + 1)^2 + (y - 3)^2 = 8" />
</MathContainer>

Jadi pusat lingkaran di <InlineMath math="(-1, 3)" /> dan jari-jari <InlineMath math="r = \\sqrt{8} = 2\\sqrt{2}" />.

#### Nyari Gradien

Karena <InlineMath math="y = mx + c" /> dan garis sejajar dengan garis singgung, maka gradiennya adalah

<MathContainer>
<BlockMath math="x - y + 3 = 0 \\Leftrightarrow y = x + 3" />

<BlockMath math="m_g = m = 1" />
</MathContainer>

#### Persamaan Garis Singgung

Rumus persamaan garis singgung lingkaran dengan gradien <InlineMath math="m" />

<BlockMath math="y - b = m(x - a) \\pm r\\sqrt{1 + m^2}" />

Substitusi nilai yang diketahui

<MathContainer>
<BlockMath math="y - 3 = 1(x + 1) \\pm \\sqrt{8} \\cdot \\sqrt{1 + (1)^2}" />

<BlockMath math="y - 3 = x + 1 \\pm \\sqrt{8} \\cdot \\sqrt{2}" />

<BlockMath math="y - 3 = x + 1 \\pm 4" />
</MathContainer>

Dapet dua persamaan

<MathContainer>
<BlockMath math="y = x + 4 + 4 \\quad \\text{atau} \\quad y = x + 4 - 4" />

<BlockMath math="y = x + 8 \\quad \\text{atau} \\quad y = x" />
</MathContainer>

Bentuk umumnya

<BlockMath math="x - y + 8 = 0 \\quad \\text{atau} \\quad x - y = 0" />

Jawaban yang paling tepat adalah <InlineMath math="x - y + 8 = 0" />.
```

## Pattern File Choices

### Struktur

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    // Pilihan Indonesia
  ],
  en: [
    // Pilihan English
  ],
};

export default choices;
```

### Contoh-contoh

**Pilihan Angka:**

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1$$", value: false },
    { label: "$$2$$", value: false },
    { label: "$$3$$", value: false },
    { label: "$$4$$", value: true },
    { label: "$$5$$", value: false },
  ],
  en: [
    { label: "$$1$$", value: false },
    { label: "$$2$$", value: false },
    { label: "$$3$$", value: false },
    { label: "$$4$$", value: true },
    { label: "$$5$$", value: false },
  ],
};

export default choices;
```

**Pilihan Pecahan:**

```typescript
const choices: ExercisesChoices = {
  id: [
    { label: "$$-\\frac{5}{2}$$", value: true },
    { label: "$$\\frac{5}{2}$$", value: false },
    { label: "$$10$$", value: false },
    { label: "Tidak ada solusi", value: false },
    { label: "$$\\infty$$", value: false },
  ],
  en: [
    { label: "$$-\\frac{5}{2}$$", value: true },
    { label: "$$\\frac{5}{2}$$", value: false },
    { label: "$$10$$", value: false },
    { label: "No solution", value: false },
    { label: "$$\\infty$$", value: false },
  ],
};

export default choices;
```

**Campuran Math dan Teks:**

```typescript
const choices: ExercisesChoices = {
  id: [
    { label: "$$x - y = 0$$", value: false },
    { label: "$$x - y + 8 = 0$$", value: true },
    { label: "$$x + y - 8 = 0$$", value: false },
    { label: "$$x + y = 0$$", value: false },
    { label: "Tidak ada jawaban yang tepat", value: false },
  ],
  en: [
    { label: "$$x - y = 0$$", value: false },
    { label: "$$x - y + 8 = 0$$", value: true },
    { label: "$$x + y - 8 = 0$$", value: false },
    { label: "$$x + y = 0$$", value: false },
    { label: "None of the above", value: false },
  ],
};

export default choices;
```

## Anti-Pattern yang Sering Terjadi

### SALAH: Pake (A), (B), (C) di pembahasan

```mdx
> Jadi jawabannya adalah (C).  // JANGAN BEGINI
```

### BENER: Refer ke konten

```mdx
> Jadi, persamaan garis singgungnya adalah <InlineMath math="x - y + 8 = 0" />.
```

### SALAH: Math di heading

```mdx
#### Nyari Nilai <InlineMath math="x" />  // JANGAN BEGINI
```

### BENER: Heading teks biasa

```mdx
#### Nyari Nilai x
```

### SALAH: Kurung di heading

```mdx
#### Analisis Pernyataan (1)  // JANGAN BEGINI
```

### BENER: Angka biasa

```mdx
#### Analisis Pernyataan 1
```

### SALAH: Angka biasa di teks

```mdx
Diketahui a = 5 dan b = 3.  // JANGAN BEGINI
```

### BENER: InlineMath buat angka

```mdx
Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.
```

### SALAH: Hard-code points di grafik

```tsx
points: [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 },
  { x: 2, y: 4, z: 0 },
  // ... 97 points lagi  // JANGAN BEGINI
]
```

### BENER: Generate points

```tsx
points: Array.from({ length: 100 }, (_, i) => {
  const x = (i / 99) * 5;
  return { x, y: x * x, z: 0 };
})
```

## Checklist Kualitas

### Konten

- [ ] Soal jelas dan ga ambigu
- [ ] Semua ekspresi math pake komponen yang bener
- [ ] Angka pake `<InlineMath />`
- [ ] Persamaan block pake `<BlockMath />`
- [ ] Banyak persamaan dibungkus `<MathContainer />`

### Struktur

- [ ] Metadata ada title, authors, date
- [ ] Format tanggal MM/DD/YYYY
- [ ] Heading deskriptif (bukan "Langkah 1")
- [ ] Heading ga ada math atau simbol
- [ ] Heading pake angka biasa (bukan kurung)

### Pembahasan

- [ ] Penjelasan lengkap dan ga ambigu
- [ ] Ga ada referensi ke huruf pilihan (A, B, C)
- [ ] Kesimpulan jelas nyebutin jawabannya
- [ ] Notasi math sama kaya di soal

### Choices

- [ ] Type di-import dari `@repo/contents/_types/exercises/choices`
- [ ] Array `id` dan `en` ada
- [ ] Math pake `$$...$$`
- [ ] Teks pake string biasa
- [ ] Cuma satu `value: true` per bahasa

### Grafik (kalo ada)

- [ ] Komponen di-import dengan bener
- [ ] `getColor()` dipake buat warna
- [ ] Points di-generate pake `Array.from()`
- [ ] `showZAxis={false}` buat grafik 2D
- [ ] `cameraPosition={[0, 0, 15]}` buat 2D
- [ ] Label ga numpuk
- [ ] Deskripsi diakhiri titik
