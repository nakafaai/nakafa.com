# Contributing to nakafa.com

Thank you for contributing! Every contribution helps improve educational content for millions of learners.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- Git

### Development Setup
```bash
# Clone and install
git clone https://github.com/YOUR-USERNAME/nakafa.com.git
cd nakafa.com
pnpm install

# Start development
pnpm dev
```

Visit http://localhost:3000

## Project Structure
- apps/www - Main Next.js application
- packages/contents - Educational content & MDX files
- packages/design-system - UI components & design tokens
- packages/internationalization - i18n configuration
- packages/analytics - Analytics utilities

## Making Changes

### Development Commands
```bash
pnpm test         # Run tests
pnpm lint         # Check code quality
pnpm format       # Format code
pnpm type-check   # Type check
```

### Code Standards
- TypeScript strict mode enabled
- Use functional components with hooks
- Export as named exports
- No type assertions
- MDX for educational content with InlineMath for math
- Import from @repo/* for internal packages, @/ for app-level

### Submitting Changes
1. Branch from main: `git checkout -b feature/change-name`
2. Make changes with clear commit messages
3. Ensure tests pass and no linting errors
4. Push and create a pull request

## Finding Issues
Look for labels: `good first issue`, `help wanted`, or browse open issues.

## Get Help
- Discord: https://discord.gg/CPCSfKhvfQ
- GitHub Discussions: https://github.com/nakafaai/nakafa.com/discussions
- Security: https://github.com/nakafaai/nakafa.com/security/advisories/new
