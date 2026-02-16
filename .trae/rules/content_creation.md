---
alwaysApply: false
---
# Content Creation Guidelines

**Language**: Indonesian (natural, engaging) or English (natural, engaging) for actual content.
**Format**: MDX (Markdown + React Components).

**Note**: This documentation uses normal English. The actual content in MDX files should use proper grammar but natural, engaging tone.

## MDX Components

### Auto-Imported (No Import Required)

Available in all MDX files:
- `BlockMath` - Display math equations
- `InlineMath` - Inline math expressions
- `MathContainer` - Wrapper for consecutive math blocks
- `CodeBlock` - Multi-language code display
- `Mermaid` - Diagram rendering

### Import Required

From `@repo/design-system/components/contents/*`:
- `LineEquation` - 3D line/curve graphs
- `NumberLine` - Number line visualization
- `Triangle` - Interactive right triangle
- `UnitCircle` - Interactive unit circle
- `Vector3d` - 3D vector visualization
- `VectorChart` - 2D vector diagrams
- `FunctionChart` - Function line charts
- `ScatterDiagram` - Scatter plots with regression
- `BarChart` - Bar/histogram charts
- `Inequality` - Inequality regions
- `AnimationBacterial` - Bacterial growth animation

## Math Formatting

### Components (NOT LaTeX delimiters)

- **Inline**: `<InlineMath math="x^2 + y^2 = r^2" />`
- **Block**: `<BlockMath math="x^2 + y^2 = r^2" />`
- **Multiple blocks**: Wrap with `<MathContainer>`

### Numbers

Always use `InlineMath` for numbers in text:
- Correct: `<InlineMath math="5" />`
- Incorrect: `5`

### Numbered References

Use `<InlineMath math="(1)" />` for references, NOT `(1)` or `(<InlineMath math="1" />)`.

### Variables in Text

Italicize variables: *x*, *y*, *f(x)*

### Decimals (Indonesian)

Use comma: `3,14` (not `3.14`)

## Language Guidelines

### Indonesian (id.mdx)
Use proper Indonesian grammar with natural, engaging tone:
- Use "kita" (we) and "kalian" (you all) to engage readers
- Write like you're explaining to a friend
- Keep it educational but not stiff
- Example: "Mari kita mulai dengan...", "Pernahkah kalian memperhatikan..."

### English (en.mdx)
Use proper English grammar with natural, engaging tone:
- Write clearly and conversationally
- Keep it educational but approachable

## File Structure

### Subject Content

```
subject/{level}/{grade}/{subject}/{topic}/
├── id.mdx          # Indonesian (Source of Truth)
├── en.mdx          # English translation
└── graph.tsx       # Shared graphs (optional)
```

### Exercises

```
exercises/{category}/{type}/{material}/{set}/{number}/
├── _question/
│   ├── id.mdx
│   └── en.mdx
├── _answer/
│   ├── id.mdx
│   └── en.mdx
└── choices.ts
```

## Graph/Illustration Guidelines

### Color Palette

**NEVER use default RED, GREEN, or BLUE for lines.**

Use softer colors from `@repo/design-system/lib/color`:
- `INDIGO`, `TEAL`, `EMERALD`, `VIOLET`, `ORANGE`, `CYAN`, `PURPLE`

Example:
```typescript
import { getColor } from "@repo/design-system/lib/color";

color: getColor("INDIGO")
```

### Generating Points

**NEVER hard-code points.** Use `Array.from()`:

```typescript
points: Array.from({ length: 100 }, (_, i) => {
  const x = -5 + (i / 99) * 10;
  const y = x * x;
  return { x, y, z: 0 };
})
```

### 2D Graphs

Set appropriate camera for 2D:
```tsx
showZAxis={false}
cameraPosition={[0, 0, 15]}
```

### Labels

Ensure labels are clear and don't overlap with lines or other elements.

## Writing Guidelines

### Headings

- Start at h2 (`##`), max h4 (`####`)
- Descriptive (NOT "Step 1", "Bagian 1")
- **NO symbols or math** in headings
- **NO parentheses** (use "Analisis 1" not "Analisis (1)")

**Correct:**
```md
## Konsep Dasar Fungsi
#### Menentukan Nilai x
```

**Incorrect:**
```md
## Bagian 1: Konsep <InlineMath math="f(x)" />
#### Analisis (1)
```

### Lists

Use hyphens `-`:
```md
- Item 1
- Item 2
- Item 3
```

No nested lists, no blank lines between items.

### Paragraphs and Math

Always add blank line between text and math blocks.

### Code vs Math

- **Programming**: Use inline code (`` `const x = 5` ``)
- **Math values**: Use `<InlineMath math="5" />`
- **Math functions**: Use `<InlineMath math="f(x)" />`
- **Programming functions**: Use inline code (`` `function()` ``)

## Metadata

All content files must export metadata:

```typescript
export const metadata = {
  title: "Judul Materi",
  description: "Deskripsi singkat",
  authors: [{ name: "Nama Penulis" }],
  date: "MM/DD/YYYY",  // Month/Day/Year format
};
```

## Running Lint

Always run `pnpm lint` before submitting changes.
