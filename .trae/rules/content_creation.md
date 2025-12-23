# Content Creation Guidelines

**Language**: Indonesian (Bahasa Indonesia) is the primary language for content.
**Format**: MDX (Markdown + React Components).

## MDX Guidelines

1. **Components**: Use provided components (e.g., `LineEquation`, `Graph`, `Table`).
2. **File Structure**:
    - `id.mdx`: Indonesian version (Source of Truth).
    - `en.mdx`: English version (Translation).
    - `graph.tsx`: Shared graph component (if applicable).

## Math Formatting

1. **LaTeX**: Use single `$` for inline math and `$$` for block math.
    - Example: `$x^2 + y^2 = r^2$`
2. **Clarity**: Ensure variables are italicized in text if they refer to math symbols (e.g., *x* and *y*).
3. **Decimals**: Use comma `,` for decimals in Indonesian text (e.g., `3,14`).

## Language Guidelines (Indonesian)

1. **Formal Tone**: Use formal and academic Indonesian (Baku).
    - Avoid slang or colloquialisms.
2. **Terminology**: Use standard mathematical terms.
    - "Equation" -> "Persamaan"
    - "Function" -> "Fungsi"
    - "Graph" -> "Grafik"

## Graph/Illustration Guidelines

- **Color Palette**: NEVER use default `RED`, `GREEN`, or `BLUE` for lines or shapes.
  - Use softer or more professional colors from `@repo/design-system/lib/color` like `INDIGO`, `TEAL`, `EMERALD`, `VIOLET`, `ORANGE`, or `CYAN`.
  - Example: `color: getColor("INDIGO")`.
- **Labels**: Ensure labels are clear and do not overlap with lines.
- **Perspective**: For 2D graphs, set the camera position appropriately (e.g., `[0, 0, 15]`) to avoid perspective distortion unless intended.
