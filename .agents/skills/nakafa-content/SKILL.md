---
name: nakafa-content
description: Create educational content (MDX) and exercises for Nakafa platform. Use when creating or editing subject materials, exercises, questions, answers/explanations, or any educational content in MDX format.
---

# Nakafa Content Creation

Guidelines for creating educational content and exercises for the Nakafa platform.

## Language

### For This Skill (Documentation)
Use normal English - clear and straightforward.

### For Actual Content (MDX Files)
- **Indonesian (id.mdx)**: Use proper Indonesian grammar with natural, engaging tone
  - Use "kita" (we) and "kalian" (you all) to engage readers
  - Write like you're explaining to a friend, but keep it educational
  - Example: "Mari kita mulai dengan...", "Pernahkah kalian memperhatikan..."
  
- **English (en.mdx)**: Use proper English grammar with natural, engaging tone
  - Write clearly and conversationally
  - Keep it educational but not stiff

## Content Types

### 1. Subject Content (`packages/contents/subject/`)

Educational materials organized by level:

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

Each topic contains:
- `id.mdx`: Indonesian version (Source of Truth) - natural, engaging tone
- `en.mdx`: English translation - natural, engaging tone
- `graph.tsx`: Shared graph component (if needed)

### 2. Exercises (`packages/contents/exercises/`)

```
exercises/
├── high-school/
│   ├── tka/mathematics/{material}/{set}/{number}/
│   └── snbt/{subject}/{material}/{set}/{number}/
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
```

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
import { AnimationBacterial } from "@repo/design-system/components/contents/animation-bacterial";
```

### Color System

Always use `getColor()` for deterministic colors:

```typescript
import { getColor } from "@repo/design-system/lib/color";

// Available colors: RED, ORANGE, AMBER, YELLOW, LIME, GREEN, EMERALD,
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

**Never use default RED, GREEN, or BLUE for lines.**

## Math Formatting Rules

### Components

- **Inline math**: `<InlineMath math="x + y" />`
- **Block math**: `<BlockMath math="x^2 + y^2 = r^2" />`
- **Multiple blocks**: Wrap with `<MathContainer>`

### Numbers

- Use `<InlineMath math="5" />` for numbers in text (not plain `5`)
- Use `<InlineMath math="(1)" />` for numbered references
- Units: `<InlineMath math="5 \text{ cm}" />`

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
- Maximum depth: h4 (`####`)
- Descriptive titles (NOT "Step 1")
- **NO symbols or math** in headings
- **NO parentheses** in headings (use "Analysis 1" not "Analysis (1)")

**Correct:**
```md
## Finding the Value of x

#### Analysis 1
```

**Incorrect:**
```md
## Step 1: Finding <InlineMath math="x" />

#### Analysis (1)
```

### Lists

Use hyphens `-`:

```md
- First item
- Second item
- Third item
```

No nested lists. No blank lines between items.

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

#### Analisis Soal

Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

<MathContainer>
  <BlockMath math="a + b = 5 + 3" />
  <BlockMath math="a + b = 8" />
</MathContainer>

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
  title={<>Graph of f(x)</>}
  description="Visualization of the function"
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

Ensure labels don't overlap:

```tsx
labels: [
  { text: "y = x²", at: 50, offset: [1, 0.5, 0] }
]
```

## Code vs Math

- **Programming code**: Use inline code (`` `const x = 5` ``)
- **Math values**: Use `<InlineMath math="5" />`
- **Math functions**: Use `<InlineMath math="f(x)" />`
- **Programming functions**: Use inline code (`` `function()` ``)

## Quality Checklist

Before submitting content:

- [ ] Math notation consistent between question and answer
- [ ] All numbers use `<InlineMath />`
- [ ] Headings don't contain math or symbols
- [ ] Date format is MM/DD/YYYY
- [ ] Colors use `getColor()` not hard-coded values
- [ ] 3D points generated via `Array.from()`, not hard-coded
- [ ] No option letters (A, B, C) in explanations
- [ ] Explanations are clear and unambiguous
- [ ] Graph descriptions end with period
- [ ] Run `pnpm lint` before submitting
