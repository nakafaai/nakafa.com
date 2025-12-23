# Exercise Creation Guidelines

When creating exercises, you are converting visual content (images of questions, choices, and explanations) into structured MDX and TypeScript code.

## Core Principles

1. **Source Fidelity**: Accurately transcribe questions, choices, and explanations from provided images.
2. **Neatness & Continuity**: The text must flow naturally. Avoid disjointed sentences.
3. **Conciseness**: Be direct and to the point, but ensure sufficient detail for understanding.
4. **Structure**: Follow the strict file structure for exercises.
5. **Ambiguity Resolution**: If the source image (question, choices, or explanation) is unclear or ambiguous, you are authorized to clarify it. The goal is to make the content unambiguous.

## File Structure

For each exercise set (e.g., `set-4`), each number (e.g., `1`) has its own directory:

```text
1/
├── _answer/
│   ├── en.mdx
│   └── id.mdx
├── _question/
│   ├── en.mdx
│   └── id.mdx
└── choices.ts
```

## Question Guidelines (`_question/`)

- **Metadata**:
  - Include `title`, `authors`, and `date`.
  - **Date Format**: MUST be `MM/DD/YYYY` (Month/Day/Year), e.g., "12/25/2025".
- **Content**:
  - Write the question clearly.
  - Use `InlineMath` for all mathematical expressions, **including standalone numbers** in the text (e.g., use `<InlineMath math="2" />` instead of just `2` if it represents a value).
  - Ensure variable names are consistent (e.g., if image uses $x_1$, use $x_1$).
  - **Clarification**: If the question text in the image is ambiguous, rephrase it to be clear and precise.
  - **Numbered References**: ALWAYS use `InlineMath` for numbered references with parentheses included.
    - Correct: `<InlineMath math="(1)" />`, `<InlineMath math="(2)" />`
    - Incorrect: `(1)`, `(2)`, `(<InlineMath math="1" />)`
  - **Lists**: Use standard Markdown ordered lists (e.g., `1.`, `2.`) for numbered items instead of manual numbering like `(1)`.
  - **Graph Descriptions**: If using a graph component, ensure the `description` prop always ends with a period `.`.

**Example:**

```mdx
export const metadata = {
  title: "Soal 1",
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "11/26/2025",
};

Jika <InlineMath math="f(x) = 2x - 1" /> dan nilai <InlineMath math="x = 5" /> ...
```

## Answer/Explanation Guidelines (`_answer/`)

- **Metadata**:
  - Include `title` (e.g., "Pembahasan Soal 1"), `authors`, and `date`.
  - **Date Format**: MUST be `MM/DD/YYYY` (Month/Day/Year).
- **Writing Style**:
  - **CRITICAL: No Ambiguity**: The explanation MUST be 100% clear and unambiguous. Even if the source explanation is vague, you must elaborate and clarify it so the student understands the *why* and *how* completely.
  - **Continuous Flow**: Write as a coherent narrative.
  - **No "Step 1"**: Avoid generic step labels. Use descriptive text or H4 headings if absolutely necessary.
  - **Headings**: If used, start at **H4** (`####`), be concise, and **NO symbols or Math**. MUST use plain text only (e.g., "Finding the Value of x", NOT "Finding `<InlineMath math='x' />`").
    - **Numbered References in Headings**: Use plain text `1`, `2`. Do NOT use parentheses `(1)` or `InlineMath` in headings.
      - Incorrect: "Analisis Pernyataan (1)"
      - Correct: "Analisis Pernyataan 1"
  - **No Option Letters**: NEVER refer to options as (A), (B), (C), etc. in the explanation text or conclusion. The UI does not display letter labels.
    - Incorrect: "Therefore, the answer is (C)."
    - Correct: "Therefore, **statement (1) is sufficient**."
  - **Concise but Detailed**: Explain *why*, not just *what*. Make it easy for a student to follow.
  - **Math Formatting**:
    - Use `MathContainer` to wrap `BlockMath` elements.
    - Use `BlockMath` for equations on their own lines.
    - Use `InlineMath` for math within text.

**Example:**

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Author Name" }],
  date: "11/26/2025",
};

Diketahui fungsi <InlineMath math="f(x) = ..." />. Kita akan mencari...

<MathContainer>
  <BlockMath math="..." />
</MathContainer>

Jadi, hasilnya adalah...
```

## Choices Guidelines (`choices.ts`)

- **Type**: `ExercisesChoices`.
- **Structure**: Object with `id` (Indonesian) and `en` (English) arrays.
- **Math in Labels**:
  - IF the label is a math expression or a number: Use standard LaTeX delimiters `$$...$$`.
  - IF the label is normal text: Use plain text (no delimiters).
- **Correctness**: Mark the correct answer with `value: true`.
- **Clarification**: Ensure choices are distinct and clearly formatted.

**Example:**

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$-\\frac{5}{2}$$", value: true }, // Math expression -> use $$...$$
    { label: "$$10$$", value: false },            // Number -> use $$...$$
    { label: "Tidak ada solusi", value: false },  // Normal text -> plain text
  ],
  en: [
    // ... same for English
  ],
};

export default choices;
```

## Consistency Checklist

- [ ] Does the math notation in the Question match the Answer?
- [ ] Are the choices consistent with the calculated result?
- [ ] Is the language natural and grammatically correct (Indonesian/English)?
- [ ] Are all math expressions properly componentized (`InlineMath`/`BlockMath`)?
- [ ] Is the date format `MM/DD/YYYY`?
- [ ] **Is the explanation completely unambiguous?**

## Graph/Illustration Guidelines

- **Color Palette**: NEVER use default `RED`, `GREEN`, or `BLUE` for lines or shapes.
  - Use softer or more professional colors from `@repo/design-system/lib/color` like `INDIGO`, `TEAL`, `EMERALD`, `VIOLET`, `ORANGE`, or `CYAN`.
  - Example: `color: getColor("INDIGO")`.
- **Labels**: Ensure labels are clearly positioned and do not overlap with the curve or other elements.
- **Perspective**: For 2D graphs, ensure the camera is positioned directly perpendicular to the plane (e.g., `[0, 0, 15]`) and `showZAxis={false}`.
