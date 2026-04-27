# Nakafa Content Skill

Quick reference for creating and editing educational MDX content in Nakafa.

## Files

- `SKILL.md`: primary workflow and rules.
- `references/mdx-components.md`: verified MDX and visualization component reference.
- `references/exercise-patterns.md`: exercise structure and answer-writing patterns.
- `templates/exercise-template.md`: compact exercise template.
- `templates/subject-template.md`: compact subject-content template.

## Source of Truth

- Root repo rules: `AGENTS.md`.
- Helpful content guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- MDX component map: `packages/design-system/components/markdown/mdx.tsx`.
- Math container implementation: `packages/design-system/components/markdown/math.tsx`.
- Visualization components: `packages/design-system/components/contents/`.
- Content data and nearby examples: `packages/contents/`.

## Language Rule

All skill documentation must be written in English.

Indonesian is allowed only inside snippets that intentionally demonstrate `id.mdx` content, localized labels, or real Indonesian source material. Actual `id.mdx` content must still be Indonesian.

## Core Patterns

Use MDX math components instead of raw `$...$` or `$$...$$` in MDX:

```mdx
<InlineMath math="x + y" />
<BlockMath math="x^2 + y^2 = r^2" />
<MathContainer>
  <BlockMath math="a = b" />
  <BlockMath math="c = d" />
</MathContainer>
```

Use Mermaid for flowcharts, dependency diagrams, timelines, decision paths, or process maps when a diagram makes the concept easier to understand:

```mdx
<Mermaid chart="graph TD; A[Read] --> B[Understand]; B --> C[Practice];" />
```

Import visual content components from the design system:

```typescript
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
```

Generate graph points from formulas instead of hard-coding point arrays:

```typescript
points: Array.from({ length: 100 }, (_, i) => {
  const x = -5 + (i / 99) * 10;
  return { x, y: x * x, z: 0 };
})
```

## Content Rules

- Start content headings at `##`.
- Do not go deeper than `###`.
- Do not put math, symbols, or parenthesized numbers in headings.
- Use `<InlineMath />` for math values in prose.
- Use math components for expressions, variables, quantities, units, coordinates, and calculated values.
- Keep math notation consistent every time the same concept appears.
- Prefer one expressive `<BlockMath />` for one connected derivation; use `<MathContainer>` when rows should stay visually separate.
- For card components whose `title` and `description` props accept `ReactNode`, use fragments with `<InlineMath />` when those props contain math.
- Verify prop types first; `BarChart` and `HistogramChart` currently accept strings.
- Make every subchapter understandable as a standalone page. Define abbreviations, acronyms, symbols, and potentially ambiguous terms on first use in each locale.
- Match the target grade and subject. Use age-appropriate language, familiar examples, and only the prerequisite knowledge that the lesson has introduced or the curriculum expects.
- Use analogies only when they clarify the concept. After the analogy, name the actual concept so the analogy does not become a substitute for understanding.
- Avoid vague references to previous lessons. If a prerequisite matters, briefly reintroduce it in the current page.
- Do not reuse the same section skeleton across adjacent lessons. Give each page its own flow, headings, examples, and closing rhythm.
- Use headings that are specific to the lesson, not generic labels that could appear unchanged on every subchapter.
- Use `getColor()` for visualization colors.
- Do not use em dash in content prose.
- Use Markdown creatively, including blockquotes, tables, emphasis, code blocks, Mermaid diagrams, and math blocks when they improve scanning.
- Do not use raw HTML elements in MDX. Avoid `<br />`, `<div>`, `<span>`, and HTML breaks inside Mermaid labels; restructure the Markdown or diagram instead.
- Keep table cells compact. Prefer one sentence per cell; move extra explanation to prose after the table.
- Keep each page useful enough that a student can make progress without searching again.
- Avoid repeated generic closing sections such as "Key Takeaway", "Summary", or localized equivalents. When a closing note is useful, make it specific and blend it into the final section.

## Verification

- Inspect nearby content before writing new content.
- Confirm the language, examples, analogies, and cognitive load match the target grade and subject.
- Confirm the page can stand alone for students arriving from search.
- Confirm no abbreviations, symbols, or context references are left unexplained.
- Confirm the section flow does not look copied from adjacent subchapters.
- Run `pnpm --filter @repo/contents typecheck` when content imports TSX/components.
- Run `pnpm lint` when the content change is ready for review.
