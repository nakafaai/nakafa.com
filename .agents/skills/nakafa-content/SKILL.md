---
name: nakafa-content
description: Create educational content (MDX) and exercises for Nakafa platform. Use when creating or editing subject materials, exercises, questions, answers/explanations, or any educational content in MDX format.
---

# Nakafa Content Creation

Guidelines for creating educational content and exercises for the Nakafa platform.

## Source of Truth

- Repo rules: read the root `AGENTS.md` before content work.
- Google helpful-content guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Local content patterns: inspect nearby files in `packages/contents/` before writing.
- Local MDX components: verify against `packages/design-system/components/markdown/mdx.tsx`.
- Visual components: verify against `packages/design-system/components/contents/` and the component's prop types.

## Skill Package Files

- `README.md`: quick reference and verification checklist.
- `references/mdx-components.md`: verified MDX and visualization component examples.
- `references/exercise-patterns.md`: exercise folder structure, answer rules, and anti-patterns.
- `templates/exercise-template.md`: compact scaffold for one exercise.
- `templates/subject-template.md`: compact scaffold for one subject lesson.

## Source Material Workflow

When the user provides official curriculum pages, book screenshots, or teacher references:

- Treat screenshots as reference material, not final copy.
- Extract the learning objective, concept sequence, formulas, examples, and common misconceptions.
- Write original explanations in Nakafa's voice instead of copying long textbook prose.
- Keep facts, formulas, terminology, and curriculum scope aligned with the official source.
- Fix obvious source mistakes only when the math or reasoning is verifiably wrong, and make the correction in the final content.
- Ask the user when grade level, curriculum version, target locale, topic scope, or source meaning is unclear.
- Calibrate every explanation to the exact level, subject, and lesson context. Use only the prior knowledge that the target students are expected to have, and briefly reintroduce prerequisites when the page needs them.
- Prefer one complete, useful page over many shallow pages. Google explicitly warns against mass-producing many topics only to attract search traffic.
- Every lesson must stand alone. Do not assume students already opened the previous subchapter, even when the route order suggests it.
- Define abbreviations, acronyms, symbols, and localized terms the first time they appear in each `id.mdx` and `en.mdx` file.

## Language

### For This Skill Package
Write all skill documentation in clear English.

Indonesian is allowed only inside snippets that intentionally demonstrate `id.mdx` content, localized labels, or real Indonesian source material.

### For Actual Content (MDX Files)
- **Indonesian (id.mdx)**: Use proper Indonesian grammar with natural, engaging tone
  - Use "kita" (we) and "kalian" (you all) to engage readers
  - Write like you're explaining to a friend, but keep it educational
  - Match the student's level. Use familiar examples, small analogies, and concrete situations when they make the concept easier to understand.
  - Keep analogies honest. State the real concept clearly and avoid analogies that hide important limits.
  - Example: "Mari kita mulai dengan...", "Pernahkah kalian memperhatikan..."
  
- **English (en.mdx)**: Use proper English grammar with natural, engaging tone
  - Write clearly and conversationally
  - Keep it educational but not stiff
  - Match the student's level. Use familiar examples, small analogies, and concrete situations when they make the concept easier to understand.
  - Keep analogies honest. State the real concept clearly and avoid analogies that hide important limits.

## Content Types

### 1. Subject Content (`packages/contents/subject/`)

Educational materials organized by level:

```
subject/
├── high-school/
│   ├── 10/mathematics/{topic}/
│   ├── 11/mathematics/{topic}/
│   └── 12/mathematics/{topic}/
├── middle-school/
│   └── {grade}/mathematics/{topic}/
└── university/
    └── bachelor/
        └── ai-ds/
```

Each lesson folder usually contains:
- `id.mdx`: Indonesian version (Source of Truth) - natural, engaging tone
- `en.mdx`: English translation - natural, engaging tone
- optional local `.tsx` visualization component when the lesson needs custom interaction

### 2. Exercises (`packages/contents/exercises/`)

```
exercises/
├── high-school/
│   ├── tka/mathematics/try-out/{year}/{set}/{number}/
│   └── snbt/{subject}/try-out/{year}/{set}/{number}/
└── middle-school/
```

Exercise structure per number:
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

### Auto-Imported (No Import Required)

Available in all MDX files without importing:

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

<Youtube videoId="youtube-video-id" />
```

Use Mermaid for flowcharts, dependency diagrams, timelines, decision paths, or process maps when a diagram makes the concept easier to understand. Keep Mermaid charts readable and avoid using them as decoration.

### Content Components (Import Required)

From `@repo/design-system/components/contents/*`:

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
import { BacterialGrowth } from "@repo/design-system/components/contents/animation-bacterial";
```

### Color System

Always use `getColor()` for deterministic colors:

```typescript
import { getColor } from "@repo/design-system/lib/color";

// Available colors: RED, ORANGE, AMBER, YELLOW, LIME, GREEN, EMERALD,
// TEAL, CYAN, SKY, BLUE, INDIGO, VIOLET, PURPLE, FUCHSIA, PINK, ROSE,
// SLATE, GRAY, ZINC, NEUTRAL, STONE

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

Avoid default RED, GREEN, or BLUE for generic lines. Pick deterministic colors that support the explanation.

## Math Formatting Rules

### Components

- **Inline math**: `<InlineMath math="x + y" />`
- **Block math**: `<BlockMath math="x^2 + y^2 = r^2" />`
- **Related equation chain**: Prefer one expressive `<BlockMath />` when the lines form one connected derivation.
- **Separate visual rows**: Use `<MathContainer>` when each row should remain its own card row.

### Card Titles and Descriptions

Many card-based content components accept React nodes for `title` and `description`. Verify the component prop type first. When the prop accepts `ReactNode`, use fragments with `<InlineMath />` when labels contain math.

`BarChart` and `HistogramChart` currently accept string titles and descriptions, so do not pass JSX there unless the component API changes.

```tsx
<LineEquation
  title={<>Graph of <InlineMath math="f(x) = x^2" /></>}
  description={
    <>
      The curve passes through <InlineMath math="(0, 0)" />.
    </>
  }
  data={[...]}
/>
```

### Math Consistency

- Use math components for every mathematical expression, variable, quantity, unit, coordinate, equation, inequality, numbered math reference, and calculated value.
- Do not write mathematical values as plain text when they are part of the concept, example, question, solution, chart title, chart description, label, or caption.
- Years can be plain text when they are calendar context, such as `2026 school year`.
- Years must use math when they are part of a formula, table value, calculation, axis value, or data point.
- If a concept is written with math notation in one place, use math notation everywhere that same concept appears.
- Prefer richer LaTeX expressions where they improve readability, such as aligned or piecewise structures inside one `BlockMath`.

```mdx
<BlockMath math="\begin{aligned}
2x + 3 &= 11 \\
2x &= 8 \\
x &= 4
\end{aligned}" />
```

### Numbers

- Use `<InlineMath math="5" />` for mathematical numbers in text (not plain `5`)
- Use `<InlineMath math="(1)" />` for numbered references
- Units: `<InlineMath math="5 \text{ cm}" />`
- Calendar years can stay plain text when they are only calendar context.

### Variables in Text

Italicize variables: *x*, *y*, *f(x)*

### Decimals (Indonesian)

Use comma: `3,14` (not `3.14`)

### Backslash Escaping

**MDX files (InlineMath/BlockMath)**: Use single backslash
```mdx
<InlineMath math="\frac{a}{b}" />
<BlockMath math="\sqrt{x}" />
```

**choices.ts (TypeScript strings)**: Use escaped double backslash
```typescript
{ label: "$$\\frac{a}{b}$$", value: true }
```

## Writing Guidelines

### Headings

- Start at h2 (`##`)
- Maximum depth: h3 (`###`)
- Descriptive titles (NOT "Step 1")
- **NO symbols or math** in headings
- **NO parentheses** in headings (use "Analysis 1" not "Analysis (1)")

**Correct:**
```md
## Finding the Value of x

### Analysis 1
```

**Incorrect:**
```md
## Step 1: Finding <InlineMath math="x" />

### Analysis (1)
```

### Lists

Use hyphens `-`:

```md
- First item
- Second item
- Third item
```

No nested lists. No blank lines between items.

### Be Creative and Concise

- **Be Creative**: Use various Markdown formatting and LaTeX math syntax creatively to present content engagingly
- **NO Bloated Explanations**: Get straight to the point. Avoid unnecessary introductory text
- **NO Excessive Lists**: Lists are okay but don't overuse them. **NEVER use nested lists**
- **NO Em Dash**: Do not use em dash in content prose.
- **Use Markdown Well**: Use blockquotes, tables, emphasis, callout-like prose, code blocks, Mermaid diagrams, and math blocks when they genuinely make the lesson easier to scan.
- **Images are Reference Only**: If you find errors in questions or calculations from source images, fix them directly. The source is just a reference for the calculation method, not absolute truth
- **Provide Context**: Explain the reasoning and context so students understand WHY, not just WHAT
- **People-first**: Each page must leave students feeling they learned enough to make progress without searching again.
- **Original value**: Add worked examples, intuition, checks, or common mistakes beyond a plain rewrite of the source.
- **No Formulaic Closings**: Avoid repeated generic closing sections such as "Key Takeaway", "Summary", or localized equivalents on every lesson. If a closing note helps, make it specific to the lesson and weave it naturally into the final section.

### Grade-Level Fit

- Read the path and metadata before writing. The route often tells you the target level, grade, subject, topic, and lesson.
- Keep the cognitive load appropriate for that level. Define technical words before using them as shortcuts.
- Prefer concrete school-age examples before abstract generalizations.
- Use analogies when they reduce confusion, not as decoration. After an analogy, name the actual concept so students do not confuse the analogy with the lesson concept.
- If a source uses advanced language, translate the idea into the target level while preserving the verified fact, formula, and curriculum scope.

### Lesson Independence and Voice

- **Standalone Subchapters**: Each subchapter must be understandable from a direct search visit. Briefly reintroduce prerequisite terms, notation, or context when the lesson needs them.
- **First-Use Definitions**: Expand abbreviations and acronyms on first use in each file. Example: write "International System of Units (SI)" before using "SI" alone.
- **No Ambiguous References**: Avoid vague pointers such as "this", "that formula", or "the previous concept" when the referent is not immediately visible. Name the concept directly.
- **No Repeated Skeletons**: Do not reuse the same section pattern across every lesson, such as always opening with definition, then example, then check, then takeaway. Let the structure follow the concept.
- **Specific Headings**: Use headings that could only belong to that lesson. Avoid reusable headings when a more precise heading would help scanning.
- **Original Learning Path**: Give each lesson its own angle, such as a concrete phenomenon, a misconception, a comparison, a small investigation, a worked example, or an interactive model.
- **No Forced Sections**: Do not add an activity, visualization, Mermaid chart, recap, or closing paragraph unless it genuinely improves understanding.
- **Human Rhythm**: Vary paragraph length, examples, transitions, and final notes so adjacent subchapters do not read like they came from one rigid template.

### Paragraphs and Math

Always add blank line between text and math:

```mdx
Some text here.

<BlockMath math="x = 5" />

More text here.
```

## Exercise Creation

### Question File (`_question/id.mdx`)

```mdx
export const metadata = {
  title: "Soal 1",
  authors: [{ name: "Author Name" }],
  date: "06/11/2025",  // MM/DD/YYYY format
};

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

Hitunglah nilai dari <InlineMath math="a + b" />.
```

### Answer File (`_answer/id.mdx`)

```mdx
export const metadata = {
  title: "Pembahasan Soal 1",
  authors: [{ name: "Author Name" }],
  date: "06/11/2025",
};

### Analisis Soal

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

<BlockMath math="\begin{aligned}
a + b &= 5 + 3 \\
&= 8
\end{aligned}" />

Jadi, nilai <InlineMath math="a + b" /> adalah <InlineMath math="8" />.
```

### Choices File (`choices.ts`)

```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    { label: "$$7$$", value: false },
    { label: "$$8$$", value: true },   // correct answer
    { label: "$$9$$", value: false },
    { label: "$$10$$", value: false },
    { label: "Tidak ada jawaban", value: false },  // plain text
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

**Math in choices:** Use `$$...$$` for math expressions and numbers, plain text for normal labels.

**Important:** In TypeScript strings, backslashes must be escaped with an additional backslash. For example:

```typescript
// CORRECT - escape the backslash
{ label: "$$\\frac{a}{b}$$", value: true }
{ label: "$$\\sqrt{x}$$", value: false }
{ label: "$$\\infty$$", value: false }

// WRONG - unescaped backslash causes error
{ label: "$$\frac{a}{b}$$", value: true }
```

### Key Rules for Exercises

1. **Date Format**: Must be `MM/DD/YYYY` (e.g., "06/11/2025")
2. **Clarity**: Explanations must be clear and unambiguous
3. **NO Option Letters**: Never refer to (A), (B), (C) in explanations
4. **Consistent Math**: Use same notation in question and answer
5. **Numbered References**: Use `<InlineMath math="(1)" />` not `(1)`

## 3D Visualization Patterns

### Generating Points

**Never hard-code points**. Use `Array.from()` with math calculations:

```typescript
// For a parabola y = x^2 from x=-5 to x=5
points: Array.from({ length: 100 }, (_, i) => {
  const x = -5 + (i / 99) * 10;  // Range from -5 to 5
  const y = x * x;
  return { x, y, z: 0 };
})

// For a circle
points: Array.from({ length: 100 }, (_, i) => {
  const angle = (i / 99) * 2 * Math.PI;
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  return { x, y, z: 0 };
})
```

### 2D Graph Settings

For 2D visualizations:

```tsx
<LineEquation
  title={<>Graph of <InlineMath math="f(x)" /></>}
  description={
    <>
      The graph is drawn on the <InlineMath math="xy" />-plane.
    </>
  }
  showZAxis={false}
  cameraPosition={[0, 0, 15]}  // Perpendicular to plane
  data={[{
    points: [...],
    color: getColor("TEAL"),
    smooth: true,
    showPoints: false,
  }]}
/>
```

### Labels

Ensure labels do not overlap. If a component only accepts string labels, use clear plain math notation in the label and keep the surrounding prose mathematically formatted.

```tsx
labels: [
  { text: "y = x^2", at: 50, offset: [1, 0.5, 0] }
]
```

## Code vs Math

- **Programming code**: Use inline code (`` `const x = 5` ``)
- **Math values**: Use `<InlineMath math="5" />`
- **Math functions**: Use `<InlineMath math="f(x)" />`
- **Programming functions**: Use inline code (`` `function()` ``)

## Quality Checklist

Before submitting content:

- [ ] Nearby content patterns were inspected
- [ ] Source material and target scope are clear
- [ ] The language, examples, analogies, and cognitive load match the target grade and subject
- [ ] The lesson works as a standalone page for students arriving from search
- [ ] Abbreviations, acronyms, symbols, and potentially ambiguous terms are defined on first use in each locale
- [ ] The section flow is specific to this lesson and does not copy a repeated template from adjacent lessons
- [ ] Headings are specific enough that they do not feel reusable across every subchapter
- [ ] Visualizations, Mermaid diagrams, activities, and closings are included only when they improve the lesson
- [ ] Content is original, useful, and aligned with Google helpful-content guidance
- [ ] Math notation consistent between question and answer
- [ ] All math expressions, variables, quantities, units, coordinates, and calculated values use math components
- [ ] Calendar years are plain text only when they are calendar context, not formula/data values
- [ ] Card titles and descriptions use ReactNode fragments with `<InlineMath />` when they contain math and the component supports ReactNode props
- [ ] Related derivations use one expressive `<BlockMath />` when that is clearer than separate rows
- [ ] Mermaid diagrams are used for flow, dependency, timeline, decision, or process explanations when they improve clarity
- [ ] Headings don't contain math or symbols
- [ ] Headings start at `##` and do not go deeper than `###`
- [ ] No em dash appears in prose
- [ ] Date format is MM/DD/YYYY
- [ ] Colors use `getColor()` not hard-coded values
- [ ] 3D points generated via `Array.from()`, not hard-coded
- [ ] No option letters (A, B, C) in explanations
- [ ] Explanations are clear and unambiguous
- [ ] Graph descriptions end with period
- [ ] Run targeted content checks or `pnpm --filter @repo/contents typecheck` when content imports TSX/components
- [ ] Run `pnpm lint` before submitting when the change is ready
