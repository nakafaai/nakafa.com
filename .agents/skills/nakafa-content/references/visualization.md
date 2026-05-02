# Visualization

Use this reference when a lesson needs Mermaid, imported content components, custom TSX, React Three Fiber, or layout changes.

## Discovery Before Coding

- Map the component surface with `rg --files packages/design-system/components/contents`.
- Read the sibling folder, shared helpers, and comparable cross-domain components before choosing an implementation pattern.
- For R3F or Three.js, inspect `packages/design-system/components/three/`, shared color utilities, UI primitives, theme files, and the relevant `r3f-*` skill.
- Check recent git history and current diff for touched content and design-system paths before structural changes.

## Strategy

- Use the simplest visual that fully explains the concept.
- Use plain MDX, compact tables, Mermaid, or existing content components when the idea remains readable.
- Prefer R3F or Three.js when a custom illustration needs many layered shapes, labels, hover states, animation paths, or responsive fixes.
- Prefer "show, then explain": let the visual carry the concept first, then add short prose or footer facts.
- Avoid dense left-right explanation panels, card-inside-card, and background blocks that only separate information.
- Avoid large explanatory titles inside the scene. If labels are needed, keep them small, camera-facing, and secondary to the model.
- Keep text-heavy footer facts at one or two columns; do not force four columns when content needs reading width.
- For interactive visuals, the first render must explain the core idea before the user drags, zooms, or rotates.

## R3F Patterns

- Use shared `ThreeCanvas`, camera controls, scene labels, theme-aware colors, materials, and existing scene utilities where they fit.
- Use `threeSceneFrameVariants()` from `packages/design-system/components/three/scene-frame.ts` for educational R3F lab containers unless the scene has a documented reason not to. When applying it, verify first-render framing at mobile and desktop; add or reuse a narrow-camera position with `isNarrowThreeScene` when square mobile would otherwise crop the model.
- Use `SceneLabel`, `THREE_FONT_SIZE`, `resolveThreeFontSize`, and `getThreeParticleLabelFontSize` from `packages/design-system/components/three/data/constants.ts` before introducing any 3D text sizing.
- Keep orbit, pan, and zoom available; tune the default camera instead of requiring interaction to understand the model.
- Labels must stay readable while rotating or zooming. Follow existing scene-label patterns instead of placing raw text that blends into the background.
- Derive geometry from structured data. Do not hard-code repeated particles, points, rows, columns, labels, or visual states by hand.

```typescript
points: Array.from({ length: 100 }, (_, i) => {
  const angle = (i / 99) * 2 * Math.PI;
  return { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
})
```

## Colors and Styling

- Use semantic UI classes such as `bg-card`, `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, and `text-secondary-foreground`.
- Do not use palette utility classes such as `text-white`, `bg-blue-*`, or `bg-rose-*` in reusable content UI unless a visualization truly needs measured category colors and the foreground remains readable in every theme.
- Do not use arbitrary Tailwind values for common typography or spacing when scale utilities exist, such as `text-xs`, `text-sm`, `gap-2`, or `p-3`.
- Use `getColor()` for deterministic visualization colors.
- Avoid default red, green, or blue for generic lines. Pick colors that support the explanation.

## Mermaid

- Use Mermaid for flowcharts, dependency diagrams, timelines, decision paths, and process maps.
- Do not use Mermaid as decoration when prose, a table, or math is clearer.
- Keep labels short and readable at mobile, tablet, and desktop sizes.
- Do not use raw HTML or HTML line breaks inside Mermaid labels.

## Verification

- Check mobile, tablet, and desktop.
- Check overflow, toggle shape, label readability, first-render camera framing, and whether the concept is understandable without extra interaction.
- Remove temporary screenshots, Playwright traces, unused exports, dead code, and fallback paths after verification.
