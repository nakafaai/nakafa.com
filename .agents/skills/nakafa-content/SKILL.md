---
name: nakafa-content
description: Create educational content (MDX) and exercises for Nakafa platform. Use when creating or editing subject materials, exercises, questions, answers/explanations, or any educational content in MDX format.
---

# Nakafa Content

Use this file as the routing map. Load only the references needed for the current task.

## First Steps

- Read the repo `AGENTS.md` and any nested instructions in touched paths.
- Inspect nearby content in `packages/contents/` before writing.
- For visual or component work, trace `packages/design-system/components/contents/`, related `packages/design-system/components/three/`, UI primitives, theme files, and utilities before coding.
- Skim recent git history and the current diff for touched content or design-system paths before structural changes.
- Treat screenshots and curriculum pages as references, not copy.

## Reference Map

- New or edited subject lessons: read `references/source-workflow.md`, `references/writing-quality.md`, and `references/math-formatting.md`.
- MDX component contracts and import examples: read `references/mdx-components.md`.
- Visual content, custom TSX, R3F, Three.js, layout, and colors: read `references/visualization.md`.
- Exercises, choices, answer explanations, and self-checks: read `references/exercise-patterns.md` and use `templates/exercise-template.md` when scaffolding.
- New subject lesson scaffolds: use `templates/subject-template.md`.

## Always Enforce

- Lessons stand alone for direct visits. Define terms, symbols, abbreviations, and prerequisites on first use in each locale.
- Localized content uses natural teacher voice for that locale; Indonesian lessons should feel like a teacher speaking to students, not formal textbook prose.
- Use concrete examples or comparisons only when they immediately clarify the concept. Avoid meta-labels before comparisons; phrase them naturally.
- Do not add activities, Mermaid diagrams, visuals, or closing sections unless they improve understanding.
- Prefer show-over-tell visuals: avoid oversized explanatory scene titles or dense overlays when the model, interaction, and short captions can carry the concept.
- Use shared 3D typography helpers and tokens instead of hard-coded WebGL font sizes; keep labels subordinate to the visual.
- Keep text-heavy lab footers readable instead of dense; prefer one or two columns unless each fact is very short.
- Use `InlineMath`, `BlockMath`, and `MathContainer` consistently for math. If notation appears once, keep it consistent everywhere.
- Keep headings at `##` or `###`, specific to the lesson, with no math or symbols.
- Avoid raw HTML, em dash, card-inside-card, hard-coded palette classes, arbitrary typography or spacing when Tailwind scale utilities exist, dead code, redundant wrappers, legacy fallbacks, and leftover artifacts.
- If a lesson asks students to solve something, include the answer, explanation, or visible self-check.
- Verify with `pnpm format`; run `pnpm --filter @repo/contents typecheck` when content imports components; run `pnpm lint` when ready.
