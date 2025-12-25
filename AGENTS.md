# Nakafa Codebase Agent Guide

**Tech Stack**: Next.js 16, React 19, TypeScript, Convex, Biome linter

## Commands

- `pnpm dev` - Start all apps (www:3000, mcp:3001, api:3002)
- `pnpm --filter www dev` - Start single app
- `pnpm build` - Build all packages/apps
- `pnpm test` - Run all tests (Vitest)
- `pnpm --filter www test` - Run www tests, use `vitest run <file>` for single test
- `pnpm lint` - Ultracite check
- `pnpm format` - Ultracite fix

## Code Style

- **Formatter**: Biome (Ultracite presets)
- **Quotes**: Double quotes only (`"text"`)
- **Indentation**: Spaces (2 or 4, check existing files)
- **Comments**: None unless explicitly requested
- **TypeScript**: Strict mode enabled, always type-check changes
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Imports**: Use `@repo/*` for internal packages, absolute imports with `@/` alias
- **Error handling**: Use try-catch, throw proper Error objects, handle edge cases

## Key Patterns

- Check existing patterns before creating new components
- Use shared packages (`@repo/design-system`, `@repo/ai`, etc.) instead of duplicating code
- For MDX content: use `InlineMath` for numbers and math, inline code for programming elements
- Convex backend in `packages/backend/convex/`, use auth helpers never `ctx.auth` directly
- Run lint/test after all changes
