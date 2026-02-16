# Subject Content Template

Use this template to create new subject content materials.

## File Structure

```
{topic-name}/
├── id.mdx          # Indonesian version (Source of Truth)
├── en.mdx          # English translation
└── graph.tsx       # Shared graph component (optional)
```

## Quick Start

1. Create folder in appropriate location:
   - High school: `packages/contents/subject/high-school/{grade}/mathematics/{topic}/`
   - University: `packages/contents/subject/university/bachelor/{major}/{course}/{topic}/`

2. Create `id.mdx` with Indonesian content
3. Create `en.mdx` with English translation
4. Add `graph.tsx` if shared graphs needed
5. Run `pnpm lint`

## Template: id.mdx

```mdx
export const metadata = {
  title: "Judul Materi",
  description: "Deskripsi singkat materi ini",
  authors: [{ name: "Nama Penulis" }],
  date: "06/11/2025",
};

## Pengertian

Paragraf pembuka yang menjelaskan konsep secara umum.

{Penjelasan dengan <InlineMath math="..." /> untuk matematika}

<BlockMath math="..." />

### Sub-bagian 1

Penjelasan lebih detail.

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

### Sub-bagian 2

Lebih banyak penjelasan.

## Contoh

#### Contoh 1

Soal:

{Deskripsi soal}

Penyelesaian:

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

Jadi, {kesimpulan}.

#### Contoh 2

...

## Kesimpulan

Ringkasan materi yang telah dipelajari.
```

## Template: en.mdx

```mdx
export const metadata = {
  title: "Material Title",
  description: "Brief description of this material",
  authors: [{ name: "Author Name" }],
  date: "06/11/2025",
};

## Definition

Opening paragraph explaining the general concept.

{Explanation with <InlineMath math="..." /> for math}

<BlockMath math="..." />

### Subsection 1

More detailed explanation.

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

### Subsection 2

More explanation.

## Examples

#### Example 1

Problem:

{Problem description}

Solution:

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

Therefore, {conclusion}.

#### Example 2

...

## Conclusion

Summary of the material learned.
```

## Template with Graph: graph.tsx

```tsx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export function QuadraticGraph() {
  return (
    <LineEquation
      title={<>Grafik Fungsi Kuadrat</>}
      description="Grafik y = x²"
      showZAxis={false}
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points: Array.from({ length: 100 }, (_, i) => {
            const x = -5 + (i / 99) * 10;
            return { x, y: x * x, z: 0 };
          }),
          color: getColor("INDIGO"),
          smooth: true,
          showPoints: false,
          labels: [{ text: "y = x²", at: 75, offset: [0.3, 0.5, 0] }],
        },
      ]}
    />
  );
}
```

## Complete Example

### Location
`packages/contents/subject/high-school/10/mathematics/quadratic-function/concept/id.mdx`

### id.mdx

```mdx
export const metadata = {
  title: "Konsep Fungsi Kuadrat",
  description: "Pengenalan fungsi kuadrat dan sifat-sifatnya",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

## Pengertian Fungsi Kuadrat

Fungsi kuadrat adalah fungsi polinomial berderajat dua yang memiliki bentuk umum:

<BlockMath math="f(x) = ax^2 + bx + c" />
dengan <InlineMath math="a \neq 0" /> dan <InlineMath math="a, b, c" /> adalah bilangan real.

### Karakteristik Grafik

Grafik fungsi kuadrat berbentuk parabola dengan ciri-ciri:

- Membuka ke **atas** jika <InlineMath math="a > 0" />
- Membuka ke **bawah** jika <InlineMath math="a < 0" />
- Titik puncak (<em>vertex</em>) di <InlineMath math="x = -\frac{b}{2a}" />

## Menentukan Titik Puncak

Titik puncak parabola dapat ditentukan dengan rumus:

<MathContainer>
  <BlockMath math="x_p = -\frac{b}{2a}" />
  <BlockMath math="y_p = f(x_p) = a(x_p)^2 + b(x_p) + c" />
</MathContainer>

atau dengan rumus:

<BlockMath math="y_p = -\frac{D}{4a}" />
dengan <InlineMath math="D = b^2 - 4ac" /> adalah diskriminan.

## Contoh

#### Contoh 1: Menentukan Titik Puncak

Tentukan titik puncak dari fungsi <InlineMath math="f(x) = 2x^2 - 4x + 1" />.

**Penyelesaian:**

Diketahui <InlineMath math="a = 2" />, <InlineMath math="b = -4" />, <InlineMath math="c = 1" />.

Menentukan <InlineMath math="x_p" />:

<MathContainer>
  <BlockMath math="x_p = -\frac{b}{2a} = -\frac{-4}{2(2)} = \frac{4}{4} = 1" />
</MathContainer>

Menentukan <InlineMath math="y_p" />:

<MathContainer>
  <BlockMath math="y_p = f(1) = 2(1)^2 - 4(1) + 1" />
  <BlockMath math="y_p = 2 - 4 + 1 = -1" />
</MathContainer>

Jadi, titik puncaknya adalah <InlineMath math="(1, -1)" />.

#### Contoh 2: Menentukan Arah Parabola

Tentukan arah pembukaan parabola dari fungsi <InlineMath math="f(x) = -3x^2 + 6x - 2" />.

**Penyelesaian:**

Karena <InlineMath math="a = -3 < 0" />, maka parabola membuka ke **bawah**.

## Kesimpulan

Fungsi kuadrat <InlineMath math="f(x) = ax^2 + bx + c" /> memiliki grafik berbentuk parabola dengan:

- Titik puncak di <InlineMath math="\left(-\frac{b}{2a}, f\left(-\frac{b}{2a}\right)\right)" />
- Membuka ke atas jika <InlineMath math="a > 0" />, ke bawah jika <InlineMath math="a < 0" />
```

## Using Components in Content

### InlineMath

```mdx
Fungsi <InlineMath math="f(x) = x^2" /> merupakan fungsi kuadrat.
```

### BlockMath

```mdx
Bentuk umum:

<BlockMath math="ax^2 + bx + c = 0" />
```

### MathContainer

```mdx
Penyelesaian:

<MathContainer>
  <BlockMath math="x^2 - 4 = 0" />
  <BlockMath math="x^2 = 4" />
  <BlockMath math="x = \pm 2" />
</MathContainer>
```

### CodeBlock

```mdx
<CodeBlock
  data={[
    {
      language: "python",
      filename: "quadratic.py",
      code: `def solve_quadratic(a, b, c):
    discriminant = b**2 - 4*a*c
    if discriminant >= 0:
        x1 = (-b + discriminant**0.5) / (2*a)
        x2 = (-b - discriminant**0.5) / (2*a)
        return x1, x2
    return None`,
    },
  ]}
/>
```

### LineEquation (Imported)

```mdx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

<LineEquation
  title={<>Grafik Fungsi Kuadrat</>}
  description="Visualisasi y = x² - 4"
  showZAxis={false}
  cameraPosition={[0, 0, 15]}
  data={[
    {
      points: Array.from({ length: 100 }, (_, i) => {
        const x = -5 + (i / 99) * 10;
        return { x, y: x * x - 4, z: 0 };
      }),
      color: getColor("TEAL"),
      smooth: true,
      showPoints: false,
    },
  ]}
/>
```

## Best Practices

1. **Start with h2**: Never use h1 in content
2. **Descriptive headings**: Use "Konsep Dasar" not "Bab 1"
3. **No math in headings**: Use "Nilai x" not "Nilai <InlineMath math="x" />"
4. **Examples section**: Include worked examples
5. **Conclusion**: Summarize key points
6. **Consistent terminology**: Use standard mathematical terms
7. **Progressive complexity**: Start simple, build up
