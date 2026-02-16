# Exercise Patterns Reference

Detailed patterns for creating exercises at Nakafa.

## Exercise Categories and Types

### Categories

- `high-school`: SMA/SMK/MA level
- `middle-school`: SMP/MTs level

### Types

**High School:**
- `tka`: Tes Kemampuan Akademik
- `snbt`: Seleksi Nasional Berbasis Tes

**Middle School:**
- `grade-9`: Kelas 9 (preparation for high school entrance)

### Materials (Subjects)

**TKA:**
- `mathematics`: Mathematics

**SNBT:**
- `quantitative-knowledge`: Pengetahuan Kuantitatif
- `mathematical-reasoning`: Penalaran Matematika
- `general-reasoning`: Penalaran Umum
- `indonesian-language`: Bahasa Indonesia
- `english-language`: Bahasa Inggris
- `general-knowledge`: Pengetahuan Umum
- `reading-and-writing-skills`: Literasi Membaca dan Menulis

## File Structure Pattern

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

## Question File Pattern

### Basic Structure

```mdx
export const metadata = {
  title: "Soal {number}",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

{Question text with <InlineMath math="..." /> for all math}

<BlockMath math="..." />
```

### Example: Simple Math

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

### Example: With Graph

```mdx
export const metadata = {
  title: "Soal 25",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui persamaan lingkaran <InlineMath math="x^2 + y^2 + 2x - 6y + 2 = 0" />. Persamaan garis singgung pada lingkaran yang sejajar dengan garis <InlineMath math="x - y + 3 = 0" /> adalah ...
```

### Key Points

1. **Date Format**: Always `MM/DD/YYYY`
2. **Math Everywhere**: All numbers must use `<InlineMath math="..." />`
3. **BlockMath**: For equations that stand alone
4. **Numbered References**: `<InlineMath math="(1)" />` not `(1)`
5. **Lists**: Use standard Markdown lists

## Answer File Pattern

### Structure

```mdx
export const metadata = {
  title: "Pembahasan Soal {number}",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

#### {Descriptive Heading 1}

Explanation text with <InlineMath math="..." />.

<MathContainer>
  <BlockMath math="..." />
  <BlockMath math="..." />
</MathContainer>

#### {Descriptive Heading 2}

More explanation...

Jadi, {conclusion}.
```

### Example: Step-by-Step Solution

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

### Example: With Graph Component

```mdx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export const metadata = {
  title: "Pembahasan Soal 25",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

Diketahui lingkaran <InlineMath math="L = x^2 + y^2 + 2x - 6y + 2 = 0" /> sejajar dengan garis <InlineMath math="x - y + 3 = 0" />.

#### Menentukan Jari-Jari Lingkaran

Bentuk umum lingkaran <InlineMath math="(x - a)^2 + (y - b)^2 = r^2" /> dapat ditentukan dari persamaan <InlineMath math="L" />

<MathContainer>
<BlockMath math="x^2 + y^2 + 2x - 6y + 2 = 0" />

<BlockMath math="(x + 1)^2 - 1 + (y - 3)^2 - 9 = -2" />

<BlockMath math="(x + 1)^2 + (y - 3)^2 = 8" />
</MathContainer>

Sehingga pusat lingkaran di <InlineMath math="(-1, 3)" /> dan jari-jari <InlineMath math="r = \sqrt{8} = 2\sqrt{2}" />.

#### Menentukan Gradien

Karena <InlineMath math="y = mx + c" /> dan garis sejajar dengan garis singgung, maka gradiennya adalah

<MathContainer>
<BlockMath math="x - y + 3 = 0 \Leftrightarrow y = x + 3" />

<BlockMath math="m_g = m = 1" />
</MathContainer>

#### Persamaan Garis Singgung

Rumus persamaan garis singgung lingkaran dengan gradien <InlineMath math="m" />

<BlockMath math="y - b = m(x - a) \pm r\sqrt{1 + m^2}" />

Substitusi nilai yang diketahui

<MathContainer>
<BlockMath math="y - 3 = 1(x + 1) \pm \sqrt{8} \cdot \sqrt{1 + (1)^2}" />

<BlockMath math="y - 3 = x + 1 \pm \sqrt{8} \cdot \sqrt{2}" />

<BlockMath math="y - 3 = x + 1 \pm 4" />
</MathContainer>

Diperoleh dua persamaan

<MathContainer>
<BlockMath math="y = x + 4 + 4 \quad \text{atau} \quad y = x + 4 - 4" />

<BlockMath math="y = x + 8 \quad \text{atau} \quad y = x" />
</MathContainer>

Bentuk umumnya

<BlockMath math="x - y + 8 = 0 \quad \text{atau} \quad x - y = 0" />

Jawaban yang paling tepat adalah <InlineMath math="x - y + 8 = 0" />.
```

## Choices File Pattern

### Structure

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    // Indonesian choices
  ],
  en: [
    // English choices
  ],
};

export default choices;
```

### Examples

**Numeric Choices:**

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

**Fraction Choices:**

**Important:** In TypeScript strings, backslashes must be escaped as `\\`.

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

**Mixed Math and Text:**

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

## Common Anti-Patterns

### WRONG: Using (A), (B), (C) in explanations

```mdx
> Jadi jawabannya adalah (C).  // NEVER DO THIS
```

### CORRECT: Refer to content

```mdx
> Jadi, persamaan garis singgungnya adalah <InlineMath math="x - y + 8 = 0" />.
```

### WRONG: Using math in headings

```mdx
#### Mencari Nilai <InlineMath math="x" />  // NEVER DO THIS
```

### CORRECT: Plain text headings

```mdx
#### Mencari Nilai x
```

### WRONG: Using parentheses in headings

```mdx
#### Analisis Pernyataan (1)  // NEVER DO THIS
```

### CORRECT: Plain numbers in headings

```mdx
#### Analisis Pernyataan 1
```

### WRONG: Plain numbers in text

```mdx
Diketahui a = 5 dan b = 3.  // NEVER DO THIS
```

### CORRECT: InlineMath for numbers

```mdx
Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.
```

### WRONG: Hard-coded points in graphs

```tsx
points: [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 },
  { x: 2, y: 4, z: 0 },
  // ... 97 more points  // NEVER DO THIS
]
```

### CORRECT: Generated points

```tsx
points: Array.from({ length: 100 }, (_, i) => {
  const x = (i / 99) * 5;
  return { x, y: x * x, z: 0 };
})
```

## Quality Checklist

### Content

- [ ] Question is clear and unambiguous
- [ ] All math expressions use proper components
- [ ] Numbers use `<InlineMath />`
- [ ] Block equations use `<BlockMath />`
- [ ] Multiple equations wrapped in `<MathContainer />`

### Structure

- [ ] Metadata includes title, authors, date
- [ ] Date format is MM/DD/YYYY
- [ ] Headings are descriptive (no "Step 1")
- [ ] Headings contain no math or symbols
- [ ] Headings use plain numbers (not parentheses)

### Answer

- [ ] Explanation is complete and unambiguous
- [ ] No reference to option letters (A, B, C)
- [ ] Conclusion clearly states the answer
- [ ] Math notation matches question

### Choices

- [ ] Type imported from `@repo/contents/_types/exercises/choices`
- [ ] Both `id` and `en` arrays present
- [ ] Math uses `$$...$$`
- [ ] Text uses plain strings
- [ ] Exactly one `value: true` per language

### Graphs (if applicable)

- [ ] Components imported correctly
- [ ] `getColor()` used for colors
- [ ] Points generated with `Array.from()`
- [ ] `showZAxis={false}` for 2D graphs
- [ ] `cameraPosition={[0, 0, 15]}` for 2D
- [ ] Labels don't overlap
- [ ] Description ends with period
