# MDX Components Reference

Complete reference for all available MDX components.

## Auto-Imported Components

These components are available in ALL MDX files without importing.

### BlockMath

Display math equations on their own line.

```mdx
<BlockMath math="x^2 + y^2 = r^2" />

<BlockMath math="\int_{a}^{b} f(x) \, dx = F(b) - F(a)" />
```

### InlineMath

Display math within text flow.

```mdx
Diketahui <InlineMath math="a = 5" /> dan <InlineMath math="b = 3" />.

Nilai <InlineMath math="(1)" /> menunjukkan...
```

### MathContainer

Wrap multiple BlockMath components for consecutive equations.

```mdx
<MathContainer>
  <BlockMath math="x^2 - 4 = 0" />
  <BlockMath math="x^2 = 4" />
  <BlockMath math="x = \pm 2" />
</MathContainer>
```

### CodeBlock

Multi-language code display with tabs.

```mdx
<CodeBlock
  data={[
    {
      language: "typescript",
      filename: "math.ts",
      code: `function add(a: number, b: number): number {
  return a + b;
}`,
    },
    {
      language: "python",
      filename: "math.py",
      code: `def add(a, b):
    return a + b`,
    },
  ]}
/>
```

### Mermaid

Create diagrams using Mermaid syntax.

```mdx
<Mermaid
  chart="graph TD;
    A[Start] --> B{Is it?};
    B -->|Yes| C[OK];
    C --> D[Rethink];
    D --> B;
    B -->|No| E[End];"
/>
```

### Youtube

Embed YouTube videos.

```mdx
<Youtube videoId="dQw4w9WgXcQ" />
```

### Standard Markdown Elements

All standard Markdown elements work with enhanced styling:

```mdx
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- List item 1
- List item 2

1. Ordered item 1
2. Ordered item 2

[Link text](https://example.com)

> Blockquote

| Table | Header |
|-------|--------|
| Cell  | Cell   |
```

## Content Components (Require Import)

Import from `@repo/design-system/components/contents/*`.

### LineEquation

3D line/curve visualization using Three.js.

```tsx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

<LineEquation
  title={<>Graph of f(x) = x²</>}
  description="Parabola opening upward"
  showZAxis={false}
  cameraPosition={[0, 0, 15]}
  data={[
    {
      points: Array.from({ length: 100 }, (_, i) => {
        const x = -5 + (i / 99) * 10;
        return { x, y: x * x, z: 0 };
      }),
      color: getColor("PURPLE"),
      smooth: true,
      showPoints: false,
      labels: [
        { text: "y = x²", at: 50, offset: [1, 0.5, 0] }
      ],
    },
  ]}
/>
```

**Props:**
- `title`: ReactNode - Card title
- `description`: ReactNode - Card description
- `showZAxis`: boolean - Show Z axis (default: true)
- `cameraPosition`: [number, number, number] - Camera position
- `data`: LineData[] - Array of line data

**LineData:**
- `points`: { x, y, z }[] - Points for the line
- `color`: string - Line color
- `smooth`: boolean - Smooth curve
- `showPoints`: boolean - Show point markers
- `labels`: Label[] - Labels along the line

### NumberLine

Visual number line with segments.

```tsx
import { NumberLine } from "@repo/design-system/components/contents/number-line";

<NumberLine
  min={-10}
  max={10}
  title="Interval Notation"
  description="x ≥ 3 or x < -2"
  segments={[
    {
      start: -10,
      end: -2,
      startInclusive: false,
      endInclusive: false,
      label: "x < -2",
      shaded: true,
    },
    {
      start: 3,
      end: 10,
      startInclusive: true,
      endInclusive: false,
      label: "x ≥ 3",
      shaded: true,
    },
  ]}
/>
```

**Props:**
- `min`: number - Minimum value
- `max`: number - Maximum value
- `title`: ReactNode - Card title
- `description`: ReactNode - Card description
- `segments`: Segment[] - Array of segments

**Segment:**
- `start`: number - Start value
- `end`: number - End value
- `startInclusive`: boolean - Include start point
- `endInclusive`: boolean - Include end point
- `startLabel`: ReactNode - Custom label for start
- `endLabel`: ReactNode - Custom label for end
- `label`: ReactNode - Segment label
- `shaded`: boolean - Shade the segment
- `showPoints`: boolean - Show endpoints
- `backgroundColor`: string - Custom background color

### Triangle

Interactive right triangle for trigonometry.

```tsx
import { Triangle } from "@repo/design-system/components/contents/triangle";

<Triangle
  title="Right Triangle"
  description="Triangle with angle θ"
  angle={Math.PI / 6}  // 30 degrees
  showLabels={true}
  showValues={true}
/>
```

### UnitCircle

Interactive unit circle for trigonometry.

```tsx
import { UnitCircle } from "@repo/design-system/components/contents/unit-circle";

<UnitCircle
  title="Unit Circle"
  description="Standard unit circle with angle θ"
  angle={Math.PI / 4}  // 45 degrees
  showAngle={true}
  showCoordinates={true}
  showTriangle={true}
/>
```

### Vector3d

3D vector visualization.

```tsx
import { Vector3d } from "@repo/design-system/components/contents/vector-3d";

<Vector3d
  title="Vector Addition"
  description="u + v = w"
  vectors={[
    { x: 3, y: 2, z: 0, color: getColor("BLUE"), label: "u" },
    { x: 2, y: 4, z: 0, color: getColor("GREEN"), label: "v" },
    { x: 5, y: 6, z: 0, color: getColor("RED"), label: "w" },
  ]}
/>
```

### VectorChart

2D vector diagram.

```tsx
import { VectorChart } from "@repo/design-system/components/contents/vector-chart";

<VectorChart
  title="2D Vectors"
  description="Vector representation in 2D"
  vectors={[
    { x: 3, y: 4, label: "a" },
    { x: -2, y: 1, label: "b" },
  ]}
/>
```

### FunctionChart

Line chart for functions.

```tsx
import { FunctionChart } from "@repo/design-system/components/contents/function-chart";

<FunctionChart
  title="Linear Function"
  description="y = 2x + 1"
  data={[
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ]}
/>
```

### ScatterDiagram

Scatter plot with regression line.

```tsx
import { ScatterDiagram } from "@repo/design-system/components/contents/scatter-diagram";

<ScatterDiagram
  title="Correlation Analysis"
  description="Scatter plot of X vs Y"
  data={[
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 5 },
  ]}
  showRegression={true}
/>
```

### BarChart

Bar or histogram chart.

```tsx
import { BarChart } from "@repo/design-system/components/contents/bar-chart";

<BarChart
  title="Frequency Distribution"
  description="Data frequency"
  data={[
    { label: "A", value: 10 },
    { label: "B", value: 20 },
    { label: "C", value: 15 },
  ]}
/>
```

### Inequality

Inequality region visualization.

```tsx
import { Inequality } from "@repo/design-system/components/contents/inequality";

<Inequality
  title="Linear Inequality"
  description="y > x + 1"
  inequality="y > x + 1"
  bounds={{ x: [-5, 5], y: [-5, 5] }}
/>
```

### AnimationBacterial

Bacterial growth animation.

```tsx
import { AnimationBacterial } from "@repo/design-system/components/contents/animation-bacterial";

<AnimationBacterial
  title="Bacterial Growth"
  description="Exponential growth model"
  initialCount={100}
  growthRate={0.5}
  timeSteps={10}
/>
```

## Color Reference

Available colors from `@repo/design-system/lib/color`:

| Color | Hex | Usage |
|-------|-----|-------|
| RED | #dc2626 | Avoid for lines |
| ORANGE | #ea580c | Good for emphasis |
| AMBER | #d97706 | Warnings |
| YELLOW | #ca8a04 | Highlights |
| LIME | #65a30d | Good alternative |
| GREEN | #16a34a | Avoid for lines |
| EMERALD | #059669 | Good for lines |
| TEAL | #0d9488 | Good for lines |
| CYAN | #0891b2 | Good for lines |
| SKY | #0284c7 | Good for lines |
| BLUE | #2563eb | Avoid for lines |
| INDIGO | #4f46e5 | Good for lines |
| VIOLET | #7c3aed | Good for lines |
| PURPLE | #9333ea | Good for lines |
| FUCHSIA | #c026d3 | Good for lines |
| PINK | #db2777 | Good for lines |
| ROSE | #e11d48 | Good for lines |

**Recommendation**: Use `INDIGO`, `TEAL`, `EMERALD`, `VIOLET`, `ORANGE`, `CYAN`, or `PURPLE` for lines.
