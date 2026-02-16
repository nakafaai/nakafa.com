# Referensi MDX Components

Referensi lengkap buat semua komponen MDX yang tersedia.

## Komponen Auto-Import

Komponen-komponen ini udah langsung bisa dipake di semua file MDX tanpa perlu import.

### BlockMath

Nampilin persamaan math di baris sendiri.

```mdx
<BlockMath math="x^2 + y^2 = r^2" />

<BlockMath math="\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)" />
```

### InlineMath

Nampilin math di dalam teks.

```mdx
Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

Nilai <InlineMath math="(1)" /> nunjukkan...
```

### MathContainer

Bungkus beberapa BlockMath buat persamaan yang berurutan.

```mdx
<MathContainer>
  <BlockMath math="x^2 - 4 = 0" />
  <BlockMath math="x^2 = 4" />
  <BlockMath math="x = \\pm 2" />
</MathContainer>
```

### CodeBlock

Nampilin code multi-bahasa dengan tab.

```mdx
<CodeBlock
  data={[
    {
      language: "typescript",
      filename: "math.ts",
      code: `function add(a: number, b: number): number {
  return a + b;
}`,
    },
    {
      language: "python",
      filename: "math.py",
      code: `def add(a, b):
    return a + b`,
    },
  ]}
/>
```

### Mermaid

Bikin diagram pake sintaks Mermaid.

```mdx
<Mermaid
  chart="graph TD;
    A[Start] --> B{Is it?};
    B -->|Yes| C[OK];
    C --> D[Rethink];
    D --> B;
    B -->|No| E[End];"
/>
```

### Youtube

Embed video YouTube.

```mdx
<Youtube videoId="dQw4w9WgXcQ" />
```

### Element Markdown Standar

Semua elemen Markdown standar tetep jalan dengan styling yang lebih bagus:

```mdx
# Heading 1
## Heading 2
### Heading 3

**Teks bold**
*Teks miring*

- List item 1
- List item 2

1. Ordered item 1
2. Ordered item 2

[Link text](https://example.com)

> Blockquote

| Tabel | Header |
|-------|--------|
| Cell  | Cell   |
```

## Komponen Konten (Harus Import)

Import dari `@repo/design-system/components/contents/*`.

### LineEquation

Visualisasi garis/kurva 3D pake Three.js.

```tsx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

<LineEquation
  title={<>Grafik f(x) = x²</>}
  description="Parabola yang buka ke atas"
  showZAxis={false}
  cameraPosition={[0, 0, 15]}
  data={[
    {
      points: Array.from({ length: 100 }, (_, i) => {
        const x = -5 + (i / 99) * 10;
        return { x, y: x * x, z: 0 };
      }),
      color: getColor("PURPLE"),
      smooth: true,
      showPoints: false,
      labels: [
        { text: "y = x²", at: 50, offset: [1, 0.5, 0] }
      ],
    },
  ]}
/>
```

**Props:**
- `title`: ReactNode - Judul card
- `description`: ReactNode - Deskripsi card
- `showZAxis`: boolean - Nampilin sumbu Z (default: true)
- `cameraPosition`: [number, number, number] - Posisi kamera
- `data`: LineData[] - Array data garis

**LineData:**
- `points`: { x, y, z }[] - Points buat garis
- `color`: string - Warna garis
- `smooth`: boolean - Kurva halus
- `showPoints`: boolean - Nampilin marker point
- `labels`: Label[] - Label di sepanjang garis

### NumberLine

Garis bilangan visual dengan segment.

```tsx
import { NumberLine } from "@repo/design-system/components/contents/number-line";

<NumberLine
  min={-10}
  max={10}
  title="Notasi Interval"
  description="x ≥ 3 atau x < -2"
  segments={[
    {
      start: -10,
      end: -2,
      startInclusive: false,
      endInclusive: false,
      label: "x < -2",
      shaded: true,
    },
    {
      start: 3,
      end: 10,
      startInclusive: true,
      endInclusive: false,
      label: "x ≥ 3",
      shaded: true,
    },
  ]}
/>
```

**Props:**
- `min`: number - Nilai minimum
- `max`: number - Nilai maksimum
- `title`: ReactNode - Judul card
- `description`: ReactNode - Deskripsi card
- `segments`: Segment[] - Array segment

**Segment:**
- `start`: number - Nilai awal
- `end`: number - Nilai akhir
- `startInclusive`: boolean - Include titik awal
- `endInclusive`: boolean - Include titik akhir
- `startLabel`: ReactNode - Label custom buat awal
- `endLabel`: ReactNode - Label custom buat akhir
- `label`: ReactNode - Label segment
- `shaded`: boolean - Arsir segment
- `showPoints`: boolean - Nampilin endpoint
- `backgroundColor`: string - Warna background custom

### Triangle

Segitiga siku-siku interaktif buat trigonometri.

```tsx
import { Triangle } from "@repo/design-system/components/contents/triangle";

<Triangle
  title="Segitiga Siku-Siku"
  description="Segitiga dengan sudut θ"
  angle={Math.PI / 6}  // 30 derajat
  showLabels={true}
  showValues={true}
/>
```

### UnitCircle

Lingkaran satuan interaktif buat trigonometri.

```tsx
import { UnitCircle } from "@repo/design-system/components/contents/unit-circle";

<UnitCircle
  title="Lingkaran Satuan"
  description="Lingkaran satuan standar dengan sudut θ"
  angle={Math.PI / 4}  // 45 derajat
  showAngle={true}
  showCoordinates={true}
  showTriangle={true}
/>
```

### Vector3d

Visualisasi vektor 3D.

```tsx
import { Vector3d } from "@repo/design-system/components/contents/vector-3d";

<Vector3d
  title="Penjumlahan Vektor"
  description="u + v = w"
  vectors={[
    { x: 3, y: 2, z: 0, color: getColor("BLUE"), label: "u" },
    { x: 2, y: 4, z: 0, color: getColor("GREEN"), label: "v" },
    { x: 5, y: 6, z: 0, color: getColor("RED"), label: "w" },
  ]}
/>
```

### VectorChart

Diagram vektor 2D.

```tsx
import { VectorChart } from "@repo/design-system/components/contents/vector-chart";

<VectorChart
  title="Vektor 2D"
  description="Representasi vektor di 2D"
  vectors={[
    { x: 3, y: 4, label: "a" },
    { x: -2, y: 1, label: "b" },
  ]}
/>
```

### FunctionChart

Line chart buat fungsi.

```tsx
import { FunctionChart } from "@repo/design-system/components/contents/function-chart";

<FunctionChart
  title="Fungsi Linear"
  description="y = 2x + 1"
  data={[
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ]}
/>
```

### ScatterDiagram

Scatter plot dengan garis regresi.

```tsx
import { ScatterDiagram } from "@repo/design-system/components/contents/scatter-diagram";

<ScatterDiagram
  title="Analisis Korelasi"
  description="Scatter plot X vs Y"
  data={[
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 5 },
  ]}
  showRegression={true}
/>
```

### BarChart

Chart batang atau histogram.

```tsx
import { BarChart } from "@repo/design-system/components/contents/bar-chart";

<BarChart
  title="Distribusi Frekuensi"
  description="Frekuensi data"
  data={[
    { label: "A", value: 10 },
    { label: "B", value: 20 },
    { label: "C", value: 15 },
  ]}
/>
```

### Inequality

Visualisasi daerah pertidaksamaan.

```tsx
import { Inequality } from "@repo/design-system/components/contents/inequality";

<Inequality
  title="Pertidaksamaan Linear"
  description="y > x + 1"
  inequality="y > x + 1"
  bounds={{ x: [-5, 5], y: [-5, 5] }}
/>
```

### AnimationBacterial

Animasi pertumbuhan bakteri.

```tsx
import { AnimationBacterial } from "@repo/design-system/components/contents/animation-bacterial";

<AnimationBacterial
  title="Pertumbuhan Bakteri"
  description="Model pertumbuhan eksponensial"
  initialCount={100}
  growthRate={0.5}
  timeSteps={10}
/>
```

## Referensi Warna

Warna yang tersedia dari `@repo/design-system/lib/color`:

| Warna | Hex | Penggunaan |
|-------|-----|------------|
| RED | #dc2626 | Hindari buat garis |
| ORANGE | #ea580c | Bagus buat penekanan |
| AMBER | #d97706 | Peringatan |
| YELLOW | #ca8a04 | Highlight |
| LIME | #65a30d | Alternatif yang bagus |
| GREEN | #16a34a | Hindari buat garis |
| EMERALD | #059669 | Bagus buat garis |
| TEAL | #0d9488 | Bagus buat garis |
| CYAN | #0891b2 | Bagus buat garis |
| SKY | #0284c7 | Bagus buat garis |
| BLUE | #2563eb | Hindari buat garis |
| INDIGO | #4f46e5 | Bagus buat garis |
| VIOLET | #7c3aed | Bagus buat garis |
| PURPLE | #9333ea | Bagus buat garis |
| FUCHSIA | #c026d3 | Bagus buat garis |
| PINK | #db2777 | Bagus buat garis |
| ROSE | #e11d48 | Bagus buat garis |

**Rekomendasi**: Pake `INDIGO`, `TEAL`, `EMERALD`, `VIOLET`, `ORANGE`, `CYAN`, atau `PURPLE` buat garis.
