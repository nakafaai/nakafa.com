# Math Formatting

Use this reference for MDX math notation, values, units, choices, and component labels.

## Components

- Inline math: `<InlineMath math="x + y" />`
- Block math: `<BlockMath math="x^2 + y^2 = r^2" />`
- Connected derivation: prefer one expressive `<BlockMath />`.
- Separate visual rows: use `<MathContainer>` only when rows should remain visually distinct.

```mdx
<BlockMath math="\begin{aligned}
2x + 3 &= 11 \\
2x &= 8 \\
x &= 4
\end{aligned}" />
```

## Consistency

- Use math components for every mathematical expression, variable, quantity, unit, coordinate, equation, inequality, numbered math reference, and calculated value.
- Do not write mathematical values as plain text when they are part of the concept, example, question, solution, chart title, chart description, label, or caption.
- If a concept is written with math notation in one place, use math notation everywhere that same concept appears.
- Years can be plain text when they are calendar context.
- Years must use math when they are formula values, table values, calculations, axis values, or data points.

## Numbers and Units

- Mathematical number in prose: `<InlineMath math="5" />`
- Numbered reference: `<InlineMath math="(1)" />`
- Unit value: `<InlineMath math="5 \text{ cm}" />`
- Indonesian decimals use comma in prose, such as `3,14`.

## Card Titles and Descriptions

Many content components accept `ReactNode` for `title` and `description`. Verify the prop type first. When the prop accepts `ReactNode`, use fragments with `<InlineMath />` if the text contains math.

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

`BarChart` and `HistogramChart` currently accept string titles and descriptions, so do not pass JSX there unless the component API changes.

## Escaping

MDX math props use a single backslash:

```mdx
<InlineMath math="\frac{a}{b}" />
<BlockMath math="\sqrt{x}" />
```

TypeScript strings in `choices.ts` use escaped backslashes:

```typescript
{ label: "$$\\frac{a}{b}$$", value: true }
```

## Code vs Math

- Programming syntax uses inline code, such as `` `const x = 5` ``.
- Math values use `<InlineMath />`.
- Math functions use `<InlineMath math="f(x)" />`.
- Programming functions use inline code, such as `` `functionName()` ``.
