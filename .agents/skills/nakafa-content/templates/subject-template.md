# Subject Content Template

Use this template for subject lessons under `packages/contents/subject/`.

## File Structure

```text
{lesson-slug}/
├── id.mdx
├── en.mdx
└── optional-local-visualization.tsx
```

Local visualization files do not need a fixed name. Match the nearby content pattern, such as `virus-chart.tsx`.

## Structure Guardrails

Do not copy this section sequence literally into every lesson. The template only shows valid syntax.

Before writing, choose a lesson-specific flow:

- Match the target grade and subject. Use familiar examples and analogies only when they make the concept easier to understand.
- Define prerequisite terms, abbreviations, and notation on first use.
- Use headings that match this exact lesson, not generic labels reused across the topic.
- Pick an angle that fits the concept, such as a phenomenon, misconception, comparison, investigation, worked example, or interactive model.
- Skip recap or takeaway sections unless the closing note can be specific and naturally connected to the final example.

## Common Locations

- High school: `packages/contents/subject/high-school/{grade}/{subject}/{topic}/{lesson}/`
- Middle school: `packages/contents/subject/middle-school/{grade}/mathematics/{topic}/{lesson}/`
- University: `packages/contents/subject/university/bachelor/{major}/{course}/{lesson}/`

## `id.mdx`

```mdx
export const metadata = {
  title: "Judul Materi",
  description: "Deskripsi singkat yang menjelaskan manfaat materi.",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

## Mengenali Pola Utama

Paragraf pembuka yang langsung menjelaskan konsep utama, konteksnya, dan istilah yang wajib dipahami di halaman ini.

Gunakan <InlineMath math="x" /> untuk nilai atau simbol matematika di dalam kalimat.

<BlockMath math="f(x) = ax^2 + bx + c" />

### Saat Nilai Masukan Berubah

Tentukan nilai fungsi ketika <InlineMath math="x = 2" />.

<BlockMath math="\begin{aligned}
f(2) &= a(2)^2 + b(2) + c \\
&= 4a + 2b + c
\end{aligned}" />

Jadi, nilai fungsi bergantung pada koefisien <InlineMath math="a" />, <InlineMath math="b" />, dan <InlineMath math="c" />.
```

## `en.mdx`

```mdx
export const metadata = {
  title: "Lesson Title",
  description: "A short description that explains the lesson value.",
  authors: [{ name: "Author Name" }],
  date: "MM/DD/YYYY",
};

## Reading the Main Pattern

Open with the core concept, its context, and any term that must be understood on this page.

Use <InlineMath math="x" /> for mathematical values or symbols inside prose.

<BlockMath math="f(x) = ax^2 + bx + c" />

### When the Input Changes

Find the function value when <InlineMath math="x = 2" />.

<BlockMath math="\begin{aligned}
f(2) &= a(2)^2 + b(2) + c \\
&= 4a + 2b + c
\end{aligned}" />

Therefore, the value depends on the coefficients <InlineMath math="a" />, <InlineMath math="b" />, and <InlineMath math="c" />.
```

## Optional Visualization

```tsx
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export function QuadraticGraph() {
  return (
    <LineEquation
      title={<>Graph of <InlineMath math="f(x) = x^2" /></>}
      description={
        <>
          The graph shows a smooth parabola through <InlineMath math="(0, 0)" />.
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
  );
}
```

Then import it from the MDX file:

```mdx
import { QuadraticGraph } from "./quadratic-graph";

<QuadraticGraph />
```

## Checks

- Inspect nearby content before writing.
- Match the target grade and subject in language, examples, analogies, and cognitive load.
- Keep skill docs in English; write `id.mdx` content in Indonesian.
- Make the lesson standalone. Define abbreviations, symbols, and required context on first use.
- Replace template headings with lesson-specific headings.
- Avoid repeating the same section skeleton across adjacent subchapters.
- Start content headings at `##`; do not go deeper than `###`.
- Do not put math or parenthesized numbers in headings.
- Use `<InlineMath />`, `<BlockMath />`, and `<MathContainer>` consistently.
- Use one expressive `<BlockMath />` for one connected derivation.
- Use `<MathContainer>` only when rows should stay visually separate.
- Use ReactNode fragments with `<InlineMath />` in card props that support React nodes.
- Verify prop types before using JSX in component props.
- Do not use em dash in prose.
- Add original examples, intuition, checks, or common mistakes beyond the source screenshot.
- Add visualizations, Mermaid diagrams, activities, and closings only when they genuinely improve understanding.
- Keep the page useful enough that students can make progress without searching again.
- Run `pnpm --filter @repo/contents typecheck` when TSX components are added or changed.
