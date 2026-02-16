# Project Structure

Nakafa is an open-source educational platform built as a monorepo using Next.js and pnpm. The project is organized into apps and packages for modularity.

## Root Directory

- `README.md`: Main project documentation, installation, and quick start guide.
- `biome.json`: Configuration for Biome linter and formatter.
- `tsconfig.json`: Base TypeScript configuration.
- `pnpm-workspace.yaml`: Workspace configuration for pnpm monorepo.

## Apps Directory

Contains the main applications:

- **api**: REST API for content delivery.
  - Key files: `apps/api/app/contents/[...slug]/route.ts`
  
- **www**: Main web application. Handles frontend routing, components, and pages.
  - Key entry: `apps/www/app/[locale]/page.tsx`
  - Internationalization support for Indonesian and English
  
- **mcp**: Management and control panel application.
  - Port: 3001
  
- **email**: Email templates and sending service.

## Packages Directory

Shared packages used across apps:

### Core Packages

- **ai**: AI utilities and integrations
- **analytics**: Analytics integration (Vercel Analytics)
- **backend**: Convex backend functions and schema
  - Location: `packages/backend/convex/`
  - Use auth helpers from `packages/backend/convex/lib/`
  - NEVER use `ctx.auth` directly
  
- **connection**: API connection utilities and clients
- **contents**: Core educational content storage
  - Articles: `packages/contents/articles/`
  - Subjects: `packages/contents/subject/`
  - Exercises: `packages/contents/exercises/`
  - Types: `packages/contents/_types/`
  
- **design-system**: Shared UI components and styles
  - Components: `packages/design-system/components/`
  - Content components: `packages/design-system/components/contents/`
  - Math components: `packages/design-system/components/markdown/`
  - Colors: `packages/design-system/lib/color.ts`
  
- **internationalization**: i18n support with dictionaries
  - Supported locales: `id` (Indonesian), `en` (English)

### Configuration Packages

- **next-config**: Next.js configuration helpers
- **security**: Security utilities and middleware
- **seo**: SEO components and JSON-LD schemas
- **testing**: Testing utilities and shared Vitest config
- **typescript-config**: Shared TypeScript configurations
- **utilities**: Shared utility functions

## Key Development Notes

- **Package Manager**: Use pnpm for all package management
- **Development**: `pnpm dev` starts all apps (www:3000, mcp:3001, api:3002)
- **Linting**: `pnpm lint` runs Biome/Ultracite checks
- **Testing**: `pnpm test` runs Vitest across all packages
- **Formatting**: `pnpm format` fixes formatting issues

## Content Organization

### Subject Content Structure

```
packages/contents/subject/
├── high-school/
│   ├── 10/mathematics/{topic}/
│   ├── 11/mathematics/{topic}/
│   └── 12/mathematics/{topic}/
└── university/
    └── bachelor/
        └── ai-ds/{course}/{topic}/
```

Each topic folder contains:
- `id.mdx`: Indonesian version (Source of Truth)
- `en.mdx`: English translation
- `graph.tsx`: Shared graph component (optional)

### Exercise Structure

```
packages/contents/exercises/
├── high-school/
│   ├── tka/mathematics/{material}/{set}/{number}/
│   └── snbt/{subject}/{material}/{set}/{number}/
└── middle-school/
    └── grade-9/{subject}/{material}/{set}/{number}/
```

Each exercise number contains:
- `_question/id.mdx` and `_question/en.mdx`
- `_answer/id.mdx` and `_answer/en.mdx`
- `choices.ts`

## MDX Components

### Auto-Imported (No Import Required)

Available in all MDX files:
- `BlockMath`, `InlineMath`, `MathContainer` - Math rendering
- `CodeBlock` - Multi-language code display
- `Mermaid` - Diagrams
- `Youtube` - Video embedding

### Import Required

From `@repo/design-system/components/contents/*`:
- `LineEquation` - 3D graphs
- `NumberLine` - Number line visualization
- `Triangle`, `UnitCircle` - Trigonometry
- `Vector3d`, `VectorChart` - Vectors
- `FunctionChart`, `ScatterDiagram`, `BarChart` - Charts
- `Inequality` - Inequality regions
- `AnimationBacterial` - Animations

## Import Aliases

- `@/` - App-level imports
- `@repo/*` - Workspace package imports
  - `@repo/design-system`
  - `@repo/contents`
  - `@repo/backend`
  - etc.

## Commands Reference

```bash
# Development
pnpm dev                    # Start all apps
pnpm --filter www dev       # Start single app

# Building
pnpm build                  # Build all packages/apps

# Testing
pnpm test                   # Run all tests
pnpm --filter www test      # Run www tests only

# Linting & Formatting
pnpm lint                   # Check code
pnpm format                 # Fix code

# Utilities
pnpm dlx ultracite check    # Deep check
pnpm dlx ultracite fix      # Auto-fix issues
```

## Additional Documentation

For more details, refer to:
- [DeepWiki documentation](https://deepwiki.com/nakafaai/nakafa.com)
- Skill: `.agents/skills/nakafa-content/` (comprehensive content creation guide)
- AGENTS.md: Coding standards and best practices
