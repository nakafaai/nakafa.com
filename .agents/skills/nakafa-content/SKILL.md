---
name: nakafa-content
description: Buat konten edukasi (MDX) dan latihan soal buat platform Nakafa. Dipake kalo kamu bikin atau edit materi pelajaran, soal, pembahasan, atau konten edukasi lainnya.
---

# Nakafa Content Creation

Panduan bikin konten edukasi dan latihan soal di Nakafa.

## Bahasa

- **Utama**: Bahasa Indonesia (yang mudah dipahami)
- **Kedua**: English (buat terjemahan)
- **Tone**: Jelasin dengan jelas, ga usah terlalu formal, tapi tetep profesional

## Jenis Konten

### 1. Materi Pelajaran (`packages/contents/subject/`)

Materi edukasi berdasarkan jenjang:

```
subject/
├── high-school/
│   ├── 10/mathematics/{topic}/
│   ├── 11/mathematics/{topic}/
│   └── 12/mathematics/{topic}/
└── university/
    └── bachelor/
        └── ai-ds/
```

Tiap topic punya:
- `id.mdx`: Versi Indonesia (ini yang utama)
- `en.mdx`: Versi English
- `graph.tsx`: Komponen grafik (kalo perlu)

### 2. Latihan Soal (`packages/contents/exercises/`)

```
exercises/
├── high-school/
│   ├── tka/mathematics/{material}/{set}/{number}/
│   └── snbt/{subject}/{material}/{set}/{number}/
└── middle-school/
```

Struktur tiap nomor:
```
{number}/
├── _question/
│   ├── id.mdx
│   └── en.mdx
├── _answer/
│   ├── id.mdx
│   └── en.mdx
└── choices.ts
```

## MDX Components

### Auto-Imported (Ga Perlu Import)

Udah langsung bisa dipake di semua file MDX:

```mdx
<BlockMath math="x^2 + y^2 = r^2" />

<InlineMath math="5" />

<MathContainer>
  <BlockMath math="a = b" />
  <BlockMath math="c = d" />
</MathContainer>

<CodeBlock
  data={[
    { language: "typescript", filename: "example.ts", code: "const x = 1;" },
  ]}
/>

<Mermaid chart="graph TD; A-->B;" />
```

### Content Components (Harus Import Dulu)

Dari `@repo/design-system/components/contents/*`:

```typescript
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { NumberLine } from "@repo/design-system/components/contents/number-line";
import { Triangle } from "@repo/design-system/components/contents/triangle";
import { UnitCircle } from "@repo/design-system/components/contents/unit-circle";
import { Vector3d } from "@repo/design-system/components/contents/vector-3d";
import { VectorChart } from "@repo/design-system/components/contents/vector-chart";
import { Inequality } from "@repo/design-system/components/contents/inequality";
import { FunctionChart } from "@repo/design-system/components/contents/function-chart";
import { ScatterDiagram } from "@repo/design-system/components/contents/scatter-diagram";
import { BarChart } from "@repo/design-system/components/contents/bar-chart";
import { AnimationBacterial } from "@repo/design-system/components/contents/animation-bacterial";
```

### Sistem Warna

Selalu pake `getColor()`:

```typescript
import { getColor } from "@repo/design-system/lib/color";

// Warna yang tersedia: RED, ORANGE, AMBER, YELLOW, LIME, GREEN, EMERALD,
// TEAL, CYAN, SKY, BLUE, INDIGO, VIOLET, PURPLE, FUCHSIA, PINK, ROSE

<LineEquation
  data={[{
    points: Array.from({ length: 100 }, (_, i) => {
      const x = -5 + (i / 99) * 10;
      return { x, y: x * x, z: 0 };
    }),
    color: getColor("INDIGO"),
    smooth: true,
    showPoints: false,
  }]}
/>
```

**JANGAN pake RED, GREEN, BLUE buat garis.**

## Aturan Format Math

### Components

- **Inline math**: `<InlineMath math="x + y" />`
- **Block math**: `<BlockMath math="x^2 + y^2 = r^2" />`
- **Banyak block**: Bungkus pake `<MathContainer>`

### Angka

- Pake `<InlineMath math="5" />` buat angka di teks (bukan `5`)
- Pake `<InlineMath math="(1)" />` buat nomor referensi
- Satuan: `<InlineMath math="5 \text{ cm}" />`

### Variabel di Teks

Miringin variabel: *x*, *y*, *f(x)*

### Desimal (Bahasa Indonesia)

Pake koma: `3,14` (bukan `3.14`)

## Aturan Penulisan

### Heading

- Mulai dari h2 (`##`), maksimal h4 (`####`)
- Judul yang deskriptif (BUKAN "Langkah 1")
- **JANGAN ada simbol atau math** di heading
- **JANGAN pake kurung** di heading (pake "Analisis 1" bukan "Analisis (1)")

**Bener:**
```md
## Nyari Nilai x

#### Analisis 1
```

**Salah:**
```md
## Langkah 1: Nyari <InlineMath math="x" />

#### Analisis (1)
```

### List

Pake strip `-`:

```md
- Item 1
- Item 2
- Item 3
```

Ga usah bikin list bersarang. Ga usah kasih baris kosong antar item.

### Paragraf dan Math

Selalu kasih baris kosong antara teks dan math:

```mdx
Teks di sini.

<BlockMath math="x = 5" />

Teks lagi di sini.
```

## Bikin Latihan Soal

### File Soal (`_question/id.mdx`)

```mdx
export const metadata = {
  title: "Soal 1",
  authors: [{ name: "Nama Author" }],
  date: "06/11/2025",  // Format MM/DD/YYYY
};

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

Hitunglah nilai dari <InlineMath math="a + b" />.
```

### File Pembahasan (`_answer/id.mdx`)

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Nama Author" }],
  date: "06/11/2025",
};

#### Analisis Soal

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

<MathContainer>
  <BlockMath math="a + b = 5 + 3" />
  <BlockMath math="a + b = 8" />
</MathContainer>

Jadi, nilai <InlineMath math="a + b" /> adalah <InlineMath math="8" />.
```

### File Pilihan (`choices.ts`)

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$7$$", value: false },
    { label: "$$8$$", value: true },   // jawaban bener
    { label: "$$9$$", value: false },
    { label: "$$10$$", value: false },
    { label: "Tidak ada jawaban", value: false },  // teks biasa
  ],
  en: [
    { label: "$$7$$", value: false },
    { label: "$$8$$", value: true },
    { label: "$$9$$", value: false },
    { label: "$$10$$", value: false },
    { label: "No answer", value: false },
  ],
};

export default choices;
```

**Math di choices:** Pake `$$...$$` buat ekspresi math dan angka, teks biasa buat label normal.

### Aturan Penting Buat Latihan

1. **Format Tanggal**: Harus `MM/DD/YYYY` (contoh: "06/11/2025")
2. **Kejelasan**: Pembahasan harus jelas dan ga ambigu
3. **JANGAN Pake Huruf Pilihan**: Jangan pernah nyebut (A), (B), (C) di pembahasan
4. **Math Konsisten**: Pake notasi yang sama di soal dan pembahasan
5. **Nomor Referensi**: Pake `<InlineMath math="(1)" />` bukan `(1)`

## Pattern Visualisasi 3D

### Generate Points

**JANGAN hard-code points**. Pake `Array.from()`:

```typescript
// Buat parabola y = x^2 dari x=-5 sampe x=5
points: Array.from({ length: 100 }, (_, i) => {
  const x = -5 + (i / 99) * 10;  // Range dari -5 sampe 5
  const y = x * x;
  return { x, y, z: 0 };
})

// Buat lingkaran
points: Array.from({ length: 100 }, (_, i) => {
  const angle = (i / 99) * 2 * Math.PI;
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  return { x, y, z: 0 };
})
```

### Setting Grafik 2D

Buat visualisasi 2D:

```tsx
<LineEquation
  title={<>Grafik f(x)</>}
  description="Visualisasi fungsi"
  showZAxis={false}
  cameraPosition={[0, 0, 15]}
  data={[{
    points: [...],
    color: getColor("TEAL"),
    smooth: true,
    showPoints: false,
  }]}
/>
```

### Label

Pastiin label ga numpuk:

```tsx
labels: [
  { text: "y = x²", at: 50, offset: [1, 0.5, 0] }
]
```

## Code vs Math

- **Code pemrograman**: Pake inline code (`` `const x = 5` ``)
- **Nilai math**: Pake `<InlineMath math="5" />`
- **Fungsi math**: Pake `<InlineMath math="f(x)" />`
- **Fungsi pemrograman**: Pake inline code (`` `function()` ``)

## Checklist Kualitas

Sebelum submit konten:

- [ ] Notasi math konsisten antara soal dan pembahasan
- [ ] Semua angka pake `<InlineMath />`
- [ ] Heading ga ada math atau simbol
- [ ] Format tanggal MM/DD/YYYY
- [ ] Warna pake `getColor()` bukan hard-code
- [ ] Points 3D di-generate pake `Array.from()`, bukan hard-code
- [ ] Ga ada huruf pilihan (A, B, C) di pembahasan
- [ ] Pembahasan jelas dan ga ambigu
- [ ] Deskripsi grafik diakhiri titik
- [ ] Run `pnpm lint` sebelum submit
