# Exercise Template

Use this template to create a new exercise.

## Quick Start

1. Copy the template folder
2. Rename to the exercise number
3. Edit the MDX files
4. Update choices.ts
5. Run `pnpm lint` to verify

## File Structure

```
{N}/
├── _question/
│   ├── id.mdx
│   └── en.mdx
├── _answer/
│   ├── id.mdx
│   └── en.mdx
└── choices.ts
```

## Template Files

### _question/id.mdx

```mdx
export const metadata = {
  title: "Soal {N}",
  authors: [{ name: "Your Name" }],
  date: "MM/DD/YYYY",
};

{Question text here}

<BlockMath math="..." />
```

### _question/en.mdx

```mdx
export const metadata = {
  title: "Question {N}",
  authors: [{ name: "Your Name" }],
  date: "MM/DD/YYYY",
};

{English question text here}

<BlockMath math="..." />
```

### _answer/id.mdx

```mdx
export const metadata = {
  title: "Pembahasan Soal {N}",
  authors: [{ name: "Your Name" }],
  date: "MM/DD/YYYY",
};

#### {Descriptive Heading}

{Explanation text}

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

Jadi, {conclusion}.
```

### _answer/en.mdx

```mdx
export const metadata = {
  title: "Solution to Question {N}",
  authors: [{ name: "Your Name" }],
  date: "MM/DD/YYYY",
};

#### {Descriptive Heading}

{Explanation text}

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

Therefore, {conclusion}.
```

### choices.ts

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$...$$", value: false },
    { label: "$$...$$", value: true },
    { label: "$$...$$", value: false },
    { label: "$$...$$", value: false },
    { label: "$$...$$", value: false },
  ],
  en: [
    { label: "$$...$$", value: false },
    { label: "$$...$$", value: true },
    { label: "$$...$$", value: false },
    { label: "$$...$$", value: false },
    { label: "$$...$$", value: false },
  ],
};

export default choices;
```

## Example: Complete Exercise

### _question/id.mdx

```mdx
export const metadata = {
  title: "Soal 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui <InlineMath math="a = \frac{1}{2}" />, <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

Nilai dari

<BlockMath math="\frac{a^{-2}bc^3}{ab^2c^{-1}} = ...." />
```

### _question/en.mdx

```mdx
export const metadata = {
  title: "Question 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Given <InlineMath math="a = \frac{1}{2}" />, <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

The value of

<BlockMath math="\frac{a^{-2}bc^3}{ab^2c^{-1}} = ...." />
```

### _answer/id.mdx

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui: <InlineMath math="a = \frac{1}{2}" />; <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

<MathContainer>
<BlockMath math="\frac{a^{-2}bc^3}{ab^2c^{-1}} = \frac{bc^3}{ab^2} \cdot \frac{c^1}{a^2}" />

<BlockMath math="= \frac{2 \cdot 1^3}{\left(\frac{1}{2}\right) \cdot 2^2} \cdot \frac{1^1}{\left(\frac{1}{2}\right)^2}" />

<BlockMath math="= \frac{2 \cdot 4}{2} = 4" />
</MathContainer>

Jadi, nilai dari ekspresi tersebut adalah <InlineMath math="4" />.
```

### _answer/en.mdx

```mdx
export const metadata = {
  title: "Solution to Question 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Given: <InlineMath math="a = \frac{1}{2}" />; <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

<MathContainer>
<BlockMath math="\frac{a^{-2}bc^3}{ab^2c^{-1}} = \frac{bc^3}{ab^2} \cdot \frac{c^1}{a^2}" />

<BlockMath math="= \frac{2 \cdot 1^3}{\left(\frac{1}{2}\right) \cdot 2^2} \cdot \frac{1^1}{\left(\frac{1}{2}\right)^2}" />

<BlockMath math="= \frac{2 \cdot 4}{2} = 4" />
</MathContainer>

Therefore, the value of the expression is <InlineMath math="4" />.
```

### choices.ts

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

**Note:** In TypeScript strings, backslashes must be escaped. For fractions and special symbols:
- Use `$$\\frac{a}{b}$$` not `$$\frac{a}{b}$$`
- Use `$$\\infty$$` not `$$\infty$$`
- Use `$$\\sqrt{x}$$` not `$$\sqrt{x}$$`

## Template with Graph

### _answer/id.mdx (with LineEquation)

```mdx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export const metadata = {
  title: "Pembahasan Soal 25",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

#### Menentukan Pusat Lingkaran

Dari persamaan lingkaran <InlineMath math="x^2 + y^2 + 2x - 6y + 2 = 0" />, dapat ditentukan pusat dan jari-jari.

<MathContainer>
<BlockMath math="(x + 1)^2 + (y - 3)^2 = 8" />
</MathContainer>

Pusat lingkaran di <InlineMath math="(-1, 3)" /> dengan jari-jari <InlineMath math="r = \sqrt{8}" />.

#### Visualisasi

<LineEquation
  title={<>Grafik Lingkaran dan Garis Singgung</>}
  description="Visualisasi lingkaran dengan pusat (-1, 3) dan jari-jari √8."
  showZAxis={false}
  cameraPosition={[0, 0, 15]}
  data={[
    {
      points: Array.from({ length: 100 }, (_, i) => {
        const angle = (i / 99) * 2 * Math.PI;
        return {
          x: -1 + Math.sqrt(8) * Math.cos(angle),
          y: 3 + Math.sqrt(8) * Math.sin(angle),
          z: 0,
        };
      }),
      color: getColor("PURPLE"),
      smooth: true,
      showPoints: false,
      labels: [{ text: "Lingkaran", at: 25, offset: [0.5, 0.5, 0] }],
    },
  ]}
/>

Jadi, persamaan garis singgungnya adalah <InlineMath math="x - y + 8 = 0" />.
```
