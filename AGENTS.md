# Nakafa Codebase Agent Guide

This codebase will outlive you. Every shortcut you take becomes
someone else's burden. Every hack compounds into technical debt
that slows the whole team down.

You are not just writing code. You are shaping the future of this
project. The patterns you establish will be copied. The corners
you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

**Tech Stack**: Next.js 16, React 19, TypeScript, Convex, Biome linter

## Agent Tools

- **Context7**: When you need to search docs, use `context7` tools.
- **ultracite**: Returns Ultracite's core coding standards covering type safety, modern JavaScript/TypeScript patterns, React/JSX best practices, error handling, security, performance, and testing guidelines. use `ultracite` to get the rules.

## Commands

- `pnpm dev` - Start all apps (www:3000, mcp:3001, api:3002)
- `pnpm --filter www dev` - Start single app
- `pnpm build` - Build all packages/apps
- `pnpm test` - Run all tests (Vitest)
- `pnpm --filter www test` - Run www tests
- `pnpm --filter www exec vitest run <file-path>` - Run single test file
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
- For MDX content: use `InlineMath` for numbers/math, inline code for programming
- Convex backend in `packages/backend/convex/`, use auth helpers never `ctx.auth` directly, see `packages/backend/convex/lib` folder for shared utils functions
- MDX components available without import: `BlockMath`, `InlineMath`, `CodeBlock`, `MathContainer`, `Mermaid`
- Import required for: `NumberLine`, `LineEquation` from `@repo/design-system/components/contents/*`
- Import aliases: `@/` for app-level imports, `@repo/*` for workspace packages
- Allowed Biome exceptions: namespace imports, barrel files, higher cognitive complexity (40)
- Run lint/test after all changes

## MDX Content Guidelines

- Headings: start from h2 only, max h3 depth, descriptive (not "Step 1"), no symbols, no InlineMath
- Code vs Math: inline code (`print()`, `const x`) for programming, InlineMath (`<InlineMath math="5" />`) for math
- Math formatting: all math in InlineMath/BlockMath, use `MathContainer` to wrap consecutive blocks, units in `\text{}`
- CodeBlock: required `data` prop with unique languages per component, supports multiple file tabs
- NumberLine: import required, use InlineMath for all numbers, `startLabel`/`endLabel` for fractions
- 3D visualizations: generate points via Array.from() with math calculations (never hard-code), use `getColor()` for colors (not randomColor)
- Lists: use hyphens `-`, no nested lists, proper indentation
- Line breaks: blank line between text paragraphs and math blocks

## TypeScript Style

NEVER USE ASSERTION! Good typescript is when you can write code like javascript but still type safe.

## Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

- **Next.js**: Use `<Image>` component, App Router metadata API, Server Components for async data
- **React 19+**: Use ref as prop instead of `React.forwardRef`

---

## Testing

- Framework: Vitest with shared config from `@repo/testing`
- Write assertions inside `it()` or `test()` blocks
- Use `describe()` for grouping related tests
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting
- Test files: `__tests__/` directories or `.test.ts`/.tsx naming

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.
