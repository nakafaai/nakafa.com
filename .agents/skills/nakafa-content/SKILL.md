---
name: nakafa-content
description: Create educational content (MDX) and exercises for Nakafa platform. Use when creating or editing subject materials, exercises, questions, answers/explanations, or any educational content in MDX format.
---

# Nakafa Content

Use this file as the routing map. Load only the references needed for the current task.

## When To Apply

Use this skill when creating or editing:

- Subject lesson MDX.
- Exercise prompts, answer explanations, and choices.
- Educational metadata, SEO text, or discovery surfaces.
- Lesson visuals, custom content components, Mermaid diagrams, R3F, or Three.js scenes.

## First Steps

- Read the repo `AGENTS.md` and any nested instructions in touched paths.
- Inspect nearby content in `packages/contents/` before writing.
- For visual or component work, trace `packages/design-system/components/contents/`, related `packages/design-system/components/three/`, UI primitives, theme files, and utilities before coding.
- Skim recent git history and the current diff for touched content or design-system paths before structural changes.
- Treat screenshots and curriculum pages as references, not copy.

## Reference Map By Work Type

| Work type | Read |
| --- | --- |
| New or edited subject lessons | `references/source-workflow.md`, `references/writing-quality.md`, `references/math-formatting.md` |
| SEO, metadata, search discovery, crawlability, or AI discovery | `references/seo.md` |
| MDX components, component imports, and content component contracts | `references/mdx-components.md` |
| Visual content, custom TSX, R3F, Three.js, layout, and colors | `references/visualization.md` |
| Exercises, choices, answer explanations, and self-checks | `references/exercise-patterns.md`, `templates/exercise-template.md` |
| New subject lesson scaffolds | `templates/subject-template.md` |

## Always Enforce

- Lessons stand alone for direct visits. Define terms, symbols, abbreviations, and prerequisites on first use in each locale.
- Localized content uses natural teacher voice for that locale; Indonesian lessons should feel like a teacher speaking to students, not formal textbook prose.
- SEO must support the lesson, not distort it: keep titles, descriptions, headings, and visible content accurate, helpful, and natural for students.
- Every lesson section must teach a real idea. Do not ship thin sections, one-line heading fillers, or reusable skeletons that could be copied across nearby lessons.
- If a `##` section contains `###` subsections, the `##` must first include a substantive bridge paragraph before the first `###`. The bridge should explain the section's teaching role, connect the upcoming sibling ideas, and give enough context that the section feels rich and intentional instead of a thin heading wrapper.
- Adjacent lessons must have distinct learning paths. Vary the structure only when it improves understanding, and make each route's phenomenon, misconception, example, or visual focus specific to that route.
- Use concrete examples or comparisons only when they immediately clarify the concept. Avoid meta-labels before comparisons; phrase them naturally.
- Do not add activities, Mermaid diagrams, visuals, or closing sections unless they improve understanding.
- Prefer show-over-tell visuals: avoid oversized explanatory scene titles or dense overlays when the model, interaction, and short captions can carry the concept.
- Treat 3D and custom visuals as premium optional teaching aids, not a coverage quota. Do not add or keep a visual unless it clearly improves the lesson and can meet the quality bar for that domain.
- Remove weak, unfinished, generic, or forced visuals instead of patching around them. Use prose, a compact table, Mermaid, or no visual when a custom visual would be ambiguous, broken, symbolic, or lower quality than the lesson around it.
- Use shared 3D typography helpers and tokens instead of hard-coded WebGL font sizes; keep labels subordinate to the visual.
- Keep text-heavy lab footers readable instead of dense; prefer one or two columns unless each fact is very short.
- Derive chart points, 3D coordinates, animation positions, ticks, repeated particles, and visual markers from formulas or structured scenario data. Do not hand-code coordinate lists or sampled data points when a mathematical generator can produce them.
- Use `InlineMath`, `BlockMath`, and `MathContainer` consistently for math. If notation appears once, keep it consistent everywhere.
- Keep subject lesson headings at `##` or `###`, specific to the lesson, with no math components or formula symbols.
- For exercise answers, follow `references/exercise-patterns.md`: the app renders the top answer heading at `###`, so MDX answer sections start at `####` and may use `#####` for real nested analysis.
- Keep raw MDX readable: leave a blank line after headings across all content; follow `references/math-formatting.md` for math block spacing.
- Avoid raw HTML, em dash, card-inside-card, hard-coded palette classes, arbitrary typography or spacing when Tailwind scale utilities exist, dead code, redundant wrappers, legacy fallbacks, and leftover artifacts.
- If a lesson asks students to solve something, include the answer, explanation, or visible self-check.
- Verify with `pnpm format`; run `pnpm --filter @repo/contents typecheck` when content imports components; run `pnpm lint` when ready.
