---
alwaysApply: false
---
# Exercise Creation Guidelines

When creating exercises, you are converting visual content (images of questions, choices, and explanations) into structured MDX and TypeScript code.

## Core Principles

1. **Source Fidelity**: Accurately transcribe questions, choices, and explanations from provided images.
2. **Neutrality & Continuity**: The text must flow naturally. Avoid disjointed sentences.
3. **Conciseness**: Be direct and to the point, but ensure sufficient detail for understanding.
4. **Structure**: Follow the strict file structure for exercises.
5. **Ambiguity Resolution**: If the source image is unclear or ambiguous, you are authorized to clarify it. The goal is to make the content unambiguous.

## File Structure

For each exercise set (e.g., `set-4`), each number (e.g., `1`) has its own directory:

```text
{number}/
├── _question/
│   ├── id.mdx        # Indonesian question
│   └── en.mdx        # English question
├── _answer/
│   ├── id.mdx        # Indonesian explanation
│   └── en.mdx        # English explanation
└── choices.ts        # Answer choices (both languages)
```

## Question Guidelines (`_question/`)

### Metadata

```typescript
export const metadata = {
  title: "Soal {N}",           // or "Question {N}" for English
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",          // Month/Day/Year format
};
```

### Content

- Write the question clearly and unambiguously.
- Use `InlineMath` for **all** mathematical expressions, including standalone numbers.
- Ensure variable names are consistent with the source.
- If the question text is ambiguous, rephrase it to be clear and precise.
- **Numbered References**: ALWAYS use `InlineMath` with parentheses included:
  - Correct: `<InlineMath math="(1)" />`, `<InlineMath math="(2)" />`
  - Incorrect: `(1)`, `(2)`, `(<InlineMath math="1" />)`
- **Lists**: Use standard Markdown ordered lists (`1.`, `2.`) instead of manual numbering like `(1)`.
- **Graph Descriptions**: If using a graph component, ensure the `description` prop always ends with a period `.`.

### Example: Question

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

## Answer/Explanation Guidelines (`_answer/`)

### Metadata

```typescript
export const metadata = {
  title: "Pembahasan Soal {N}",  // or "Solution to Question {N}" for English
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};
```

### Writing Style

- **CRITICAL: No Ambiguity**: The explanation MUST be 100% clear and unambiguous. Even if the source is vague, elaborate and clarify so students understand the *why* and *how* completely.
- **Continuous Flow**: Write as a coherent narrative.
- **No "Step 1"**: Avoid generic step labels. Use descriptive text or H4 headings if absolutely necessary.
- **Headings**: If used, start at **H4** (`####`), be concise, and **NO symbols or Math**. Use plain text only:
  - Correct: "Mencari Nilai x", "Analisis Pernyataan 1"
  - Incorrect: "Mencari Nilai <InlineMath math='x' />", "Analisis Pernyataan (1)"
- **No Option Letters**: NEVER refer to options as (A), (B), (C), etc. in the explanation or conclusion. The UI does not display letter labels.
  - Incorrect: "Jadi jawabannya adalah (C)."
  - Correct: "Jadi, persamaan garis singgungnya adalah <InlineMath math='x - y + 8 = 0' />."
- **Concise but Detailed**: Explain *why*, not just *what*. Make it easy for students to follow.
- **Math Formatting**:
  - Use `MathContainer` to wrap consecutive `BlockMath` elements.
  - Use `BlockMath` for equations on their own lines.
  - Use `InlineMath` for math within text.

### Example: Answer

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

#### Simplifikasi Ekspresi

Diketahui: <InlineMath math="a = \\frac{1}{2}" />, <InlineMath math="b = 2" />, <InlineMath math="c = 1" />

Sederhanakan eksponen negatif terlebih dahulu:

<MathContainer>
  <BlockMath math="\\frac{a^{-2}bc^3}{ab^2c^{-1}} = \\frac{bc^3 \\cdot c}{ab^2 \\cdot a^2}" />
  <BlockMath math="= \\frac{bc^4}{a^3b^2}" />
</MathContainer>

Substitusi nilai-nilai yang diketahui:

<MathContainer>
  <BlockMath math="= \\frac{2 \\cdot 1^4}{\\left(\\frac{1}{2}\\right)^3 \\cdot 2^2}" />
  <BlockMath math="= \\frac{2}{\\frac{1}{8} \\cdot 4}" />
  <BlockMath math="= \\frac{2}{\\frac{1}{2}} = 4" />
</MathContainer>

Jadi, nilai dari ekspresi tersebut adalah <InlineMath math="4" />.
```

### Using Graph Components

Import components when needed:

```mdx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export const metadata = {
  title: "Pembahasan Soal 25",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "06/11/2025",
};

#### Visualisasi Grafik

<LineEquation
  title={<>Grafik Fungsi</>}
  description="Visualisasi parabola y = x²."
  showZAxis={false}
  cameraPosition={[0, 0, 15]}
  data={[{
    points: Array.from({ length: 100 }, (_, i) => {
      const x = -5 + (i / 99) * 10;
      return { x, y: x * x, z: 0 };
    }),
    color: getColor("PURPLE"),
    smooth: true,
    showPoints: false,
  }]}
/>

Jadi, titik puncaknya adalah <InlineMath math="(0, 0)" />.
```

**Important for Graphs:**
- Always use `getColor()` for colors (NOT hard-coded colors)
- Generate points with `Array.from()` (NOT hard-coded arrays)
- Use `showZAxis={false}` and `cameraPosition={[0, 0, 15]}` for 2D
- Ensure description ends with a period

## Choices Guidelines (`choices.ts`)

### Structure

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "...", value: false },
    { label: "...", value: true },   // correct answer
    { label: "...", value: false },
    { label: "...", value: false },
    { label: "...", value: false },
  ],
  en: [
    { label: "...", value: false },
    { label: "...", value: true },
    { label: "...", value: false },
    { label: "...", value: false },
    { label: "...", value: false },
  ],
};

export default choices;
```

### Math in Labels

- **Math expression or number**: Use `$$...$$` delimiters
- **Normal text**: Use plain text (no delimiters)

### Examples

**Numeric choices:**
```typescript
id: [
  { label: "$$1$$", value: false },
  { label: "$$2$$", value: false },
  { label: "$$3$$", value: false },
  { label: "$$4$$", value: true },
  { label: "$$5$$", value: false },
]
```

**Fraction choices:**
```typescript
id: [
  { label: "$$-\\frac{5}{2}$$", value: true },
  { label: "$$\\frac{5}{2}$$", value: false },
  { label: "$$10$$", value: false },
  { label: "Tidak ada solusi", value: false },  // plain text
  { label: "$$\\infty$$", value: false },
]
```

**Equation choices:**
```typescript
id: [
  { label: "$$x - y = 0$$", value: false },
  { label: "$$x - y + 8 = 0$$", value: true },
  { label: "$$x + y - 8 = 0$$", value: false },
  { label: "$$x + y = 0$$", value: false },
  { label: "Tidak ada jawaban yang tepat", value: false },
]
```

## Consistency Checklist

Before submitting, verify:

- [ ] Math notation in Question matches Answer
- [ ] Choices are consistent with calculated result
- [ ] Language is natural and grammatically correct
- [ ] All math expressions use `InlineMath`/`BlockMath`
- [ ] Date format is `MM/DD/YYYY`
- [ ] Explanation is completely unambiguous
- [ ] No reference to option letters (A, B, C)
- [ ] Headings don't contain math or symbols
- [ ] Graph colors use `getColor()`
- [ ] Points are generated with `Array.from()`
- [ ] Run `pnpm lint` and fix any issues

## Common Anti-Patterns to Avoid

### WRONG: Using (A), (B), (C) in explanations

```mdx
> Jadi jawabannya adalah (C).  // NEVER DO THIS
```

### CORRECT: Refer to content

```mdx
> Jadi, persamaan garis singgungnya adalah <InlineMath math="x - y + 8 = 0" />.
```

### WRONG: Math in headings

```mdx
#### Mencari Nilai <InlineMath math="x" />  // NEVER DO THIS
```

### CORRECT: Plain text headings

```mdx
#### Mencari Nilai x
```

### WRONG: Parentheses in headings

```mdx
#### Analisis Pernyataan (1)  // NEVER DO THIS
```

### CORRECT: Plain numbers

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
