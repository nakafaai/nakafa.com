# Quick Reference

## Skill Location
`.agents/skills/nakafa-content/`

## When to Use
- Creating educational content (MDX)
- Creating exercises (questions, answers, choices)
- Editing existing content
- Adding visualizations/graphs

## Files Created

### Main Skill
- `SKILL.md` - Complete guidelines for content creation

### References
- `references/mdx-components.md` - All available components
- `references/exercise-patterns.md` - Exercise creation patterns

### Templates
- `templates/exercise-template.md` - Exercise folder template
- `templates/subject-template.md` - Subject content template

## Updated Rules Files
- `.trae/rules/content_creation.md` - Updated with correct component usage
- `.trae/rules/exercise_creation.md` - Added imports and patterns
- `.trae/rules/project_structure.md` - Fixed app names and added packages

## Key Patterns

### Math Components (NOT $ or $$)
```mdx
<InlineMath math="x + y" />
<BlockMath math="x^2 + y^2 = r^2" />
<MathContainer>...</MathContainer>
```

### Import Content Components
```typescript
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
```

### Generate Points (NEVER hard-code)
```typescript
points: Array.from({ length: 100 }, (_, i) => {
  const x = -5 + (i / 99) * 10;
  return { x, y: x * x, z: 0 };
})
```

### Colors
- Use: `getColor("INDIGO")`, `getColor("TEAL")`, `getColor("PURPLE")`
- NEVER: RED, GREEN, BLUE for lines

### Headings
- Start from h2, max h4
- No math or symbols: "Finding Value x" (not "Finding <InlineMath math='x' />")
- No parentheses: "Analysis 1" (not "Analysis (1)")

### Date Format
Always `MM/DD/YYYY` (e.g., "06/11/2025")

### Choices.ts
```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
// Math: $$...$$
// Text: plain
```

## Writing Style for Content

### Indonesian (id.mdx)
Use proper Indonesian grammar with natural, engaging tone:
- Use "kita" (we) and "kalian" (you all) to engage readers
- Write like you're explaining to a friend
- Keep it educational but not stiff
- Example: "Mari kita mulai dengan...", "Pernahkah kalian memperhatikan..."

### English (en.mdx)
Use proper English grammar with natural, engaging tone:
- Write clearly and conversationally
- Keep it educational but approachable

## Verification
All files pass `pnpm lint` ✅
