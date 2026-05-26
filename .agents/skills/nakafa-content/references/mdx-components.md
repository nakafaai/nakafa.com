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
<Mermaid
  title="Specific concept or process name"
  description="Explain what students should follow in this diagram and why it matters here."
  chart="graph TD; A[Start] --> B[Finish];"
/>
```

Use Mermaid for flowcharts, dependency diagrams, timelines, decision paths, and process maps. Do not use Mermaid as decoration when prose, a table, or math is clearer.

Every Mermaid diagram requires a pedagogical `title` and `description` in the MDX. Match the lesson locale, name the concept being shown, and explain how students should read the arrows or groups. Do not use a Mermaid code fence for lessons because the component copy must be explicit.

### Youtube

```mdx
<Youtube videoId="dQw4w9WgXcQ" />
```

### Standard Markdown

Use normal Markdown for paragraphs, lists, links, blockquotes, and tables. Content headings must start at `##` and must not go deeper than `###`.

Do not use raw HTML elements in MDX, including `<br />`, `<div>`, `<span>`, or HTML line breaks inside Mermaid labels. If a table cell or diagram label feels crowded, shorten the text, split it into separate rows or nodes, or use a supported MDX component.

Keep table cells compact. Prefer one sentence per cell, then move extra explanation into prose after the table.

### External Links

External Markdown links render as compact source chips. The linked text is not shown as normal prose. Do not wrap a concept word or required sentence fragment in an external link, such as `IUPAC defines [atom](...) as ...`. Write the concept in plain text first, then place the source link only after a complete sentence when the source itself is useful.

## Standalone Lesson Writing

Each subject lesson should work for students who arrive directly from search.

- Define abbreviations, acronyms, symbols, and uncommon terms on first use in each locale.
- Reintroduce prerequisite context briefly instead of pointing vaguely to earlier lessons.
- Avoid repeating the same section skeleton across nearby lessons.
- Use headings, examples, diagrams, and final notes that fit the current concept specifically.
- Add Mermaid, visual components, activities, or closing paragraphs only when they improve understanding.

## Imported Content Components

Import content components only when they directly improve the lesson. Keep this reference subject-neutral: discover the actual component API from the repo before using it.

- Find candidates with `rg --files packages/design-system/components/contents`.
- Read the component source before importing it. Verify required props, supported `ReactNode` fields, label types, responsive behavior, and theme expectations.
- Prefer an existing content component when it fits the concept exactly. Create a local TSX component only when the lesson needs a custom interaction or visual state.
- Keep imported component examples inside the lesson-specific task or local implementation notes, not in this generic skill map.
- Use `getColor()` from `@repo/design-system/lib/color` for deterministic visualization colors when a component expects explicit colors.

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
