# Quick Reference

## Lokasi Skill
`.agents/skills/nakafa-content/`

## Kapan Dipake
- Bikin konten edukasi (MDX)
- Bikin latihan soal (soal, pembahasan, pilihan)
- Edit konten yang udah ada
- Nambahin visualisasi/grafik

## File yang Dibuat

### Skill Utama
- `SKILL.md` - Panduan lengkap bikin konten

### Referensi
- `references/mdx-components.md` - Semua komponen yang tersedia
- `references/exercise-patterns.md` - Pattern bikin latihan

### Template
- `templates/exercise-template.md` - Template folder latihan
- `templates/subject-template.md` - Template konten materi

## File Rules yang Difix
- `.trae/rules/content_creation.md` - Diupdate pake komponen yang bener
- `.trae/rules/exercise_creation.md` - Ditambahin import dan pattern
- `.trae/rules/project_structure.md` - Fix nama app dan nambahin packages

## Pattern Penting

### Komponen Math (BUKAN $ atau $$)
```mdx
<InlineMath math="x + y" />
<BlockMath math="x^2 + y^2 = r^2" />
<MathContainer>...</MathContainer>
```

### Import Komponen Konten
```typescript
import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
```

### Generate Points (JANGAN hard-code)
```typescript
points: Array.from({ length: 100 }, (_, i) => {
  const x = -5 + (i / 99) * 10;
  return { x, y: x * x, z: 0 };
})
```

### Warna
- Pake: `getColor("INDIGO")`, `getColor("TEAL")`, `getColor("PURPLE")`
- JANGAN: RED, GREEN, BLUE buat garis

### Heading
- Mulai dari h2, maksimal h4
- Ga ada math atau simbol: "Nyari Nilai x" (bukan "Nyari Nilai <InlineMath math='x' />")
- Ga ada kurung: "Analisis 1" (bukan "Analisis (1)")

### Format Tanggal
Selalu `MM/DD/YYYY` (contoh: "06/11/2025")

### Choices.ts
```typescript
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
// Math: $$...$$
// Teks: biasa
```

## Verifikasi
Semua file lolos `pnpm lint` ✅
