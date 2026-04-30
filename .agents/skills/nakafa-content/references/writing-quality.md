# Writing Quality

Use this reference for lesson voice, headings, prose structure, comparisons, and final content checks.

## Language

Skill documentation, reference files, and template instructions stay in English.

Localized code snippets should match the file they demonstrate:

- `id.mdx` snippets use Indonesian prose.
- `en.mdx` snippets use English prose.
- Locale-neutral TypeScript snippets may stay in English unless they demonstrate localized labels.

For actual content:

- Indonesian `id.mdx` uses proper Indonesian grammar and natural classroom pronouns.
- English `en.mdx` uses clear, natural English.
- Write like a teacher guiding students in class, not like a stiff textbook author or internal content note.
- Match the student's level. Define technical words before using them as shortcuts.
- Use familiar examples, concrete situations, and short comparisons only when they make the concept easier to understand.
- If a comparison needs extra explanation to make sense, remove it and explain the concept directly.
- Avoid visible meta-labels before comparisons. Prefer seamless phrasing such as `Imagine...` or `Picture...`.
- Reserve colons for tables, ratios, code, math, metadata, or genuinely clearer lists.

## Headings

- Start at `##`.
- Do not go deeper than `###`.
- Use `###` only when one `##` contains distinct sibling ideas.
- Do not force `###` into every lesson.
- Do not put math, symbols, or parenthesized numbers in headings.
- Use headings that are specific to the lesson, not reusable labels that could appear unchanged in every nearby lesson.

## Prose and Lists

- Use short paragraphs with clear transitions.
- Use hyphen bullets only.
- Do not use nested lists.
- Do not use em dash in prose.
- Do not use raw HTML elements in MDX, including `<br />`, `<div>`, `<span>`, or HTML line breaks inside Mermaid labels.
- Keep table cells compact. Prefer one sentence per cell, then move extra explanation into prose after the table.
- Avoid repeated generic closing sections such as "Key Takeaway", "Summary", or localized equivalents.

## Lesson Independence

- Each lesson must be understandable from a direct search visit.
- Reintroduce prerequisite terms, notation, or context when the lesson needs them.
- Avoid vague pointers when the referent is not immediately visible. Name the concept directly.
- If another lesson is truly needed, link to it with a specific label and route.
- Do not reuse the same section skeleton across adjacent lessons.
- Give each lesson its own learning path, such as a concrete phenomenon, misconception, small investigation, worked example, or interactive model.

## Practice and Worked Examples

- Do not write content-management phrases inside lessons or defensive phrases that describe what a section is not.
- If a table, prompt, or activity is a worked example, say that directly and show enough calculation or reasoning for students to verify at least one row.
- If a lesson asks students to solve something, include the answer, explanation, or an immediately visible self-check.
- Use human labels such as "worked example", "completed example", "sample data", or a precise concept heading.

## Quality Checklist

- Nearby content patterns were inspected.
- Source material and target scope are clear.
- Language, examples, comparisons, and cognitive load match the target grade and subject.
- The voice sounds like a teacher guiding students.
- The lesson works as a standalone page.
- Abbreviations, symbols, and potentially ambiguous terms are defined on first use.
- Section flow is specific to the lesson and not copied from nearby lessons.
- Visuals, Mermaid diagrams, activities, and closings are included only when they improve understanding.
- Prose has no meta-jargon or ambiguous practice.
- Math notation is consistent.
- Headings start at `##`, do not go deeper than `###`, and contain no math or symbols.
- No raw HTML or em dash appears in prose.
