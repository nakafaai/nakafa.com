# Exercise Patterns Reference

Verified against `packages/contents/exercises/` and `packages/contents/_types/exercises/choices.ts`.

## Supported Exercise Paths

```text
packages/contents/exercises/
├── high-school/
│   ├── tka/mathematics/try-out/{year}/{set}/{number}/
│   └── snbt/{subject}/try-out/{year}/{set}/{number}/
└── middle-school/
```

Examples:

- `packages/contents/exercises/high-school/tka/mathematics/try-out/2026/set-1/1/`
- `packages/contents/exercises/high-school/snbt/general-reasoning/try-out/2026/set-2/1/`

## Per-Question Structure

```text
{number}/
├── _question/
│   ├── id.mdx
│   └── en.mdx
├── _answer/
│   ├── id.mdx
│   └── en.mdx
└── choices.ts
```

## Question MDX

The example shows an `id.mdx` file, so the prose is Indonesian.

```mdx
export const metadata = {
  title: "Soal 1",
  authors: [{ name: "Author Name" }],
  date: "06/11/2025",
};

Diketahui <InlineMath math="a = \frac{1}{2}" /> dan <InlineMath math="b = 2" />.

Nilai dari ekspresi berikut adalah ....

<BlockMath math="\frac{a^{-2}b}{ab^2}" />
```

Rules:

- Date format is `MM/DD/YYYY`.
- Use `<InlineMath />` for every mathematical expression, variable, quantity, unit, coordinate, and calculated value in prose.
- Use `<BlockMath />` for standalone formulas.
- Keep wording unambiguous.
- Define abbreviations, acronyms, symbols, and uncommon terms inside the question when the item depends on them.
- Do not include answer-option letters in the question text unless the original format truly requires them.

## Answer MDX

The example shows an `_answer/id.mdx` file, so the prose is Indonesian and the first heading uses `###`.

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Author Name" }],
  date: "06/11/2025",
};

### Membaca Nilai yang Diketahui

Diketahui <InlineMath math="a = \frac{1}{2}" /> dan <InlineMath math="b = 2" />.

<BlockMath math="\begin{aligned}
\frac{a^{-2}b}{ab^2}
  &= \frac{b}{a^3b^2} \\
  &= \frac{1}{a^3b} \\
  &= \frac{1}{\left(\frac{1}{2}\right)^3 \cdot 2} \\
  &= 4
\end{aligned}" />

Jadi, nilai ekspresi tersebut adalah <InlineMath math="4" />.
```

Rules:

- Exercise answer headings default to `###`; do not add an `##` before them unless nearby exercise files already use that structure.
- Use descriptive headings, not "Step 1".
- Do not put math, symbols, or parenthesized numbers in headings.
- Do not refer to option letters such as `(A)`, `(B)`, or `(C)` in explanations.
- State the final answer by content, not by option letter.
- Keep notation consistent with the question.
- Do not assume students remember a previous question or lesson. Restate the needed context inside the explanation.
- Prefer one expressive `<BlockMath />` for one connected derivation.
- Use `<MathContainer>` only when rows should remain visually separate.
- Do not use em dash in prose.
- Do not use raw HTML elements such as `<br />`, `<div>`, or `<span>` in MDX.

## Choices File

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$1$$", value: false },
    { label: "$$2$$", value: false },
    { label: "$$3$$", value: false },
    { label: "$$4$$", value: true },
    { label: "Tidak ada jawaban yang tepat", value: false },
  ],
  en: [
    { label: "$$1$$", value: false },
    { label: "$$2$$", value: false },
    { label: "$$3$$", value: false },
    { label: "$$4$$", value: true },
    { label: "None of the above", value: false },
  ],
};

export default choices;
```

Rules:

- Both `id` and `en` arrays are required.
- Use `$$...$$` for math labels in `choices.ts`.
- Escape LaTeX backslashes in TypeScript strings, for example `$$\\frac{a}{b}$$`.
- Use plain strings for non-math labels.
- Keep exactly one `value: true` per language unless the exercise format explicitly allows otherwise.

## Common Anti-Patterns

### Wrong: option-letter answers

```mdx
The correct answer is C.
```

### Correct: content-based answers

```mdx
The correct expression is <InlineMath math="x - y + 8 = 0" />.
```

### Wrong: math in headings

```mdx
### Finding <InlineMath math="x" />
```

### Correct: plain text headings

```mdx
### Finding the Unknown Value
```

### Wrong: raw numbers in math prose

```mdx
Given a = 5 and b = 3.
```

### Correct: math components in math prose

```mdx
Given <InlineMath math="a = 5" /> and <InlineMath math="b = 3" />.
```

### Wrong: splitting one equation chain without a reason

```mdx
<MathContainer>
  <BlockMath math="2x + 3 = 11" />
  <BlockMath math="2x = 8" />
  <BlockMath math="x = 4" />
</MathContainer>
```

### Correct: one connected derivation in one block

```mdx
<BlockMath math="\begin{aligned}
2x + 3 &= 11 \\
2x &= 8 \\
x &= 4
\end{aligned}" />
```

## Quality Checklist

- [ ] Question is clear and unambiguous.
- [ ] Any abbreviation, symbol, or uncommon term needed for the item is defined.
- [ ] Metadata includes title, authors, and date.
- [ ] Date uses `MM/DD/YYYY`.
- [ ] Math in prose always uses `<InlineMath />`.
- [ ] Standalone equations use `<BlockMath />`.
- [ ] One connected derivation uses one expressive `<BlockMath />` when clearer.
- [ ] Separate derivation rows use `<MathContainer>` only when they should stay visually separate.
- [ ] Exercise answer headings use `###` by default without a preceding `##`.
- [ ] No em dash appears in prose.
- [ ] No raw HTML elements appear in MDX.
- [ ] Answer explains the reasoning, not only the final result.
- [ ] Explanation can stand alone without relying on another question or lesson.
- [ ] Explanation does not reference option letters.
- [ ] `choices.ts` has both `id` and `en`.
- [ ] Choice labels escape LaTeX correctly.
- [ ] Exactly one choice is correct per language unless intentionally different.
