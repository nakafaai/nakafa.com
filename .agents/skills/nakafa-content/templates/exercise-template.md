# Exercise Template

Use this template for one exercise folder under `packages/contents/exercises/`.

## File Structure

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

## `_question/id.mdx`

```mdx
export const metadata = {
  title: "Soal {number}",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

Hitunglah nilai dari <InlineMath math="a + b" />.
```

## `_question/en.mdx`

```mdx
export const metadata = {
  title: "Question {number}",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

Given <InlineMath math="a = 5" /> and <InlineMath math="b = 3" />.

Find the value of <InlineMath math="a + b" />.
```

## `_answer/id.mdx`

```mdx
export const metadata = {
  title: "Pembahasan Soal {number}",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

### Membaca Nilai yang Diketahui

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

<BlockMath math="\begin{aligned}
a + b &= 5 + 3 \\
&= 8
\end{aligned}" />

Jadi, nilai <InlineMath math="a + b" /> adalah <InlineMath math="8" />.
```

## `_answer/en.mdx`

```mdx
export const metadata = {
  title: "Solution to Question {number}",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

### Analyze the Known Values

Given <InlineMath math="a = 5" /> and <InlineMath math="b = 3" />.

<BlockMath math="\begin{aligned}
a + b &= 5 + 3 \\
&= 8
\end{aligned}" />

Therefore, the value of <InlineMath math="a + b" /> is <InlineMath math="8" />.
```

## `choices.ts`

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$7$$", value: false },
    { label: "$$8$$", value: true },
    { label: "$$9$$", value: false },
    { label: "$$10$$", value: false },
    { label: "Tidak ada jawaban yang tepat", value: false },
  ],
  en: [
    { label: "$$7$$", value: false },
    { label: "$$8$$", value: true },
    { label: "$$9$$", value: false },
    { label: "$$10$$", value: false },
    { label: "None of the above", value: false },
  ],
};

export default choices;
```

## Checks

- Use `MM/DD/YYYY` dates.
- Exercise answer headings default to `###`; do not add an `##` before them unless the nearby exercise pattern already requires it.
- Make each question and answer standalone.
- Define abbreviations, symbols, and uncommon terms when the item depends on them.
- Use `<InlineMath />` for math in prose.
- Do not use raw HTML elements such as `<br />`, `<div>`, or `<span>` in MDX.
- Use one expressive `<BlockMath />` for one connected derivation.
- Use `<MathContainer>` only when rows should stay visually separate.
- Do not reference option letters in the explanation.
- Do not use em dash in prose.
- Escape LaTeX backslashes in `choices.ts`, for example `$$\\frac{a}{b}$$`.
