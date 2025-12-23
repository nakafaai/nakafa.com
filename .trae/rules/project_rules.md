# Nakafa Project Rules

**Tech Stack**: Next.js Monorepo, pnpm, Biome, Convex (Backend).
**Language**: TypeScript.

## Critical Guidelines

1. **Project Structure**: See `.trae/rules/project_structure.md`.
2. **Authentication & Users**: See `.trae/rules/auth_and_user.md`.
    - NEVER access `ctx.auth` directly. Use helpers in `authHelpers.ts`.
3. **Content Creation**: See `.trae/rules/content_creation.md`.
    - Follow strict MDX, Math, and Indonesian language guidelines.
4. **Exercise Creation**: See `.trae/rules/exercise_creation.md`.
    - Guidelines for creating exercise sets (Questions, Answers, Choices).
5. **Marketing**: See `.trae/rules/marketing.md`.
    - Guidelines for LinkedIn marketing and content promotion.
6. **Contributing**: See `.trae/rules/contributing.md`.

## Key Commands

- `pnpm dev`: Start development server.
- `pnpm format`: Run Biome formatter.

## General Principles

- **DRY**: Don't repeat yourself.
- **Clean Code**: Modular, well-typed.
