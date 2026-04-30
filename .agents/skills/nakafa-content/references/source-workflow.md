# Source Workflow

Use this reference when creating or editing subject lessons from screenshots, curriculum pages, teacher notes, or existing Nakafa content.

## Source of Truth

- Root repo rules: `AGENTS.md`.
- Helpful-content guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Local content patterns: nearby files in `packages/contents/`.
- Local MDX component map: `packages/design-system/components/markdown/mdx.tsx`.
- Visual components: `packages/design-system/components/contents/`.
- Three.js utilities: `packages/design-system/components/three/`.
- Theme and utility files: `packages/design-system` theme, color, UI, and shared helper files used by nearby components.

## Working From Source Material

- Treat source screenshots as reference material, not final copy.
- Extract the learning objective, concept order, formulas, examples, and likely misconceptions.
- Write original explanations in Nakafa's voice instead of copying long textbook prose.
- Keep facts, formulas, terminology, and curriculum scope aligned with the source.
- Fix a source mistake only when the math or reasoning is verifiably wrong.
- Ask the user when grade level, curriculum version, target locale, topic scope, or source meaning is unclear.

## Lesson Scope

- Calibrate every explanation to the route, subject, grade, and lesson context.
- Use only prerequisite knowledge that the target students are expected to have, and briefly reintroduce it when needed.
- Prefer one complete, useful page over many shallow pages.
- Every lesson must stand alone. Do not assume students opened another page first.
- Define abbreviations, acronyms, symbols, and localized terms the first time they appear in each `id.mdx` and `en.mdx`.

## Content Locations

Subject lessons usually live under `packages/contents/subject/`:

```text
subject/
├── high-school/
│   ├── 10/{subject}/{topic}/
│   ├── 11/{subject}/{topic}/
│   └── 12/{subject}/{topic}/
├── middle-school/
│   └── {grade}/{subject}/{topic}/
└── university/
    └── bachelor/
```

Each lesson folder usually contains:

- `id.mdx`: Indonesian source lesson.
- `en.mdx`: English version.
- Optional local `.tsx` visualization component when the lesson needs custom interaction.
