# MDX Components Reference

Verified against `packages/design-system/components/markdown/mdx.tsx` and `packages/design-system/components/contents/`.

## Auto-Imported Components

These components are available in MDX without imports.

### Math

```mdx
Inline math: <InlineMath math="x + y" />

<BlockMath math="x^2 + y^2 = r^2" />

<BlockMath math="\begin{aligned}
x^2 - 4 &= 0 \\
x^2 &= 4 \\
x &= \pm 2
\end{aligned}" />
```

Prefer one expressive `BlockMath` when the formulas are one connected derivation. Use `MathContainer` when separate rows should remain visually distinct.

```mdx
<MathContainer>
  <BlockMath math="a^m \cdot a^n = a^{m+n}" />
  <BlockMath math="\frac{a^m}{a^n} = a^{m-n}" />
</MathContainer>
```

### CodeBlock

```mdx
<CodeBlock
  data={[
    {
      language: "typescript",
      filename: "example.ts",
      code: "const value = 1;",
    },
  ]}
/>
```

### Mermaid

```mdx
<Mermaid chart="graph TD; A[Start] --> B[Finish];" />
```

Use Mermaid for flowcharts, dependency diagrams, timelines, decision paths, and process maps. Do not use Mermaid as decoration when prose, a table, or math is clearer.

### Youtube

```mdx
<Youtube videoId="dQw4w9WgXcQ" />
```

### Standard Markdown

Use normal Markdown for paragraphs, lists, links, blockquotes, and tables. Content headings must start at `##` and must not go deeper than `###`.

Do not use raw HTML elements in MDX, including `<br />`, `<div>`, `<span>`, or HTML line breaks inside Mermaid labels. If a table cell or diagram label feels crowded, shorten the text, split it into separate rows or nodes, or use a supported MDX component.

Keep table cells compact. Prefer one sentence per cell, then move extra explanation into prose after the table.

## Standalone Lesson Writing

Each subject lesson should work for students who arrive directly from search.

- Define abbreviations, acronyms, symbols, and uncommon terms on first use in each locale.
- Reintroduce prerequisite context briefly instead of pointing vaguely to earlier lessons.
- Avoid repeating the same section skeleton across adjacent subchapters.
- Use headings, examples, diagrams, and final notes that fit the current concept specifically.
- Add Mermaid, visual components, activities, or closing paragraphs only when they improve understanding.

## Imported Content Components

Import these only when the lesson needs the visualization.

### LineEquation

```tsx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

<LineEquation
  title={<>Graph of <InlineMath math="f(x) = x^2" /></>}
  description={
    <>
      The curve passes through <InlineMath math="(0, 0)" />.
    </>
  }
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
      labels: [{ text: "y = x^2", at: 75, offset: [0.3, 0.5, 0] }],
    },
  ]}
/>
```

### NumberLine

```tsx
import { NumberLine } from "@repo/design-system/components/contents/number-line";

<NumberLine
  title={<>Solution Set for <InlineMath math="x \ge 3" /></>}
  description={
    <>
      The shaded ray starts at <InlineMath math="3" /> and extends to the right.
    </>
  }
  segments={[
    {
      start: 3,
      end: Number.POSITIVE_INFINITY,
      startInclusive: true,
      label: <InlineMath math="x \ge 3" />,
    },
  ]}
/>
```

### Triangle

```tsx
import { Triangle } from "@repo/design-system/components/contents/triangle";

<Triangle
  title={<>Right Triangle with <InlineMath math="30^\circ" /></>}
  description={
    <>
      The angle measure is <InlineMath math="30^\circ" />.
    </>
  }
  angle={30}
  labels={{
    opposite: "opposite",
    adjacent: "adjacent",
    hypotenuse: "hypotenuse",
  }}
/>
```

### UnitCircle

```tsx
import { UnitCircle } from "@repo/design-system/components/contents/unit-circle";

<UnitCircle
  title={<>Unit Circle at <InlineMath math="45^\circ" /></>}
  description={
    <>
      The terminal point has equal <InlineMath math="x" /> and <InlineMath math="y" /> coordinates.
    </>
  }
  angle={45}
  trigValues={{ sin: "\\frac{\\sqrt{2}}{2}", cos: "\\frac{\\sqrt{2}}{2}" }}
/>
```

### Vector3d

```tsx
import { Vector3d } from "@repo/design-system/components/contents/vector-3d";
import { getColor } from "@repo/design-system/lib/color";

<Vector3d
  title={<>Vectors <InlineMath math="\vec{u}" /> and <InlineMath math="\vec{v}" /></>}
  description={
    <>
      Both vectors start at <InlineMath math="(0, 0, 0)" />.
    </>
  }
  vectors={[
    { to: [3, 2, 0], color: getColor("TEAL"), label: "u" },
    { to: [2, 4, 0], color: getColor("INDIGO"), label: "v" },
  ]}
/>
```

### VectorChart

```tsx
import { VectorChart } from "@repo/design-system/components/contents/vector-chart";
import { getColor } from "@repo/design-system/lib/color";

<VectorChart
  title={<>Components of <InlineMath math="\vec{u}" /></>}
  description={
    <>
      The endpoint is <InlineMath math="(3, 4)" />.
    </>
  }
  vectors={[
    {
      id: "u",
      name: "u",
      color: getColor("TEAL"),
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
    },
  ]}
/>
```

### FunctionChart

```tsx
import { FunctionChart } from "@repo/design-system/components/contents/function-chart";

<FunctionChart
  title={<>Exponential Function <InlineMath math="f(x) = 2^x" /></>}
  description={
    <>
      The initial value is <InlineMath math="1" /> and the base is <InlineMath math="2" />.
    </>
  }
  p={1}
  a={2}
  n={8}
/>
```

### ScatterDiagram

```tsx
import { ScatterDiagram } from "@repo/design-system/components/contents/scatter-diagram";
import { getColor } from "@repo/design-system/lib/color";

<ScatterDiagram
  title={<>Scatter Plot for <InlineMath math="(x, y)" /> Data</>}
  description={
    <>
      The regression line summarizes the relationship between <InlineMath math="x" /> and <InlineMath math="y" />.
    </>
  }
  calculateRegressionLine={true}
  datasets={[
    {
      name: "Sample",
      color: getColor("INDIGO"),
      points: [
        { x: 1, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 5 },
      ],
    },
  ]}
/>
```

### BarChart and HistogramChart

```tsx
import { BarChart } from "@repo/design-system/components/contents/bar-chart";

const chartConfig = {
  value: {
    label: "Frequency",
    color: "var(--chart-1)",
  },
};

<BarChart
  title="Frequency Distribution"
  description="Frequency by category."
  yAxisLabel="Frequency"
  chartConfig={chartConfig}
  data={[
    { name: "A", value: 10 },
    { name: "B", value: 20 },
    { name: "C", value: 15 },
  ]}
/>
```

### Inequality

```tsx
import { Inequality } from "@repo/design-system/components/contents/inequality";
import { getColor } from "@repo/design-system/lib/color";

<Inequality
  title={<>Linear Inequality <InlineMath math="x + y \le 5" /></>}
  description={
    <>
      The shaded region represents <InlineMath math="x + y \le 5" />.
    </>
  }
  data={[
    {
      is2D: true,
      boundaryLine2D: [1, 1, -5],
      color: getColor("TEAL"),
      boundaryColor: getColor("INDIGO"),
      label: { text: "x + y <= 5", position: [1, 1, 0] },
    },
  ]}
/>
```

### BacterialGrowth

```tsx
import { BacterialGrowth } from "@repo/design-system/components/contents/animation-bacterial";

<BacterialGrowth
  initialCount={1}
  ratio={2}
  maxGenerations={6}
  labels={{
    title: "Bacterial Growth",
    bacterial: "Bacteria",
    initialBacteria: "Initial bacteria",
  }}
/>
```

## Math Consistency

- Use `<InlineMath />` or `<BlockMath />` for mathematical expressions, variables, quantities, units, coordinates, equations, inequalities, and calculated values.
- Keep the same math notation everywhere the same concept appears.
- Use plain text for calendar years only when the year is contextual, such as `2026 school year`.
- Use math for years when they are formula values, data values, table values, or axis values.
- Many card-based visual components accept React nodes for `title` and `description`; use fragments with `<InlineMath />` whenever those props contain math.
- Verify prop types before using JSX in props. `BarChart` and `HistogramChart` currently accept string titles and descriptions.
- Some visualization labels are string-only. Use clear plain math notation there, and keep surrounding prose formatted with math components.
- Do not use em dash in prose.
- Do not use raw HTML elements in MDX prose, tables, or Mermaid labels.
- Keep table cells compact and avoid multiple sentences in one cell.

## Color Reference

Use `getColor()` from `@repo/design-system/lib/color`.

Available keys: `RED`, `ORANGE`, `AMBER`, `YELLOW`, `LIME`, `GREEN`, `EMERALD`, `TEAL`, `CYAN`, `SKY`, `BLUE`, `INDIGO`, `VIOLET`, `PURPLE`, `FUCHSIA`, `PINK`, `ROSE`, `SLATE`, `GRAY`, `ZINC`, `NEUTRAL`, `STONE`.

Avoid generic `RED`, `GREEN`, or `BLUE` for ordinary lines. Prefer deterministic colors that support the explanation, such as `INDIGO`, `TEAL`, `EMERALD`, `VIOLET`, `ORANGE`, `CYAN`, or `PURPLE`.
