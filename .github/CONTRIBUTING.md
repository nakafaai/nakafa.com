# Contributing to nakafa.com

Thank you for contributing! Every contribution helps improve educational content for millions of learners.

## Contribution License

Nakafa is source-available, not open source. Read `LICENSE`,
`CONTENT_LICENSE.md`, and `TRADEMARKS.md` before contributing.

You may create a GitHub fork only to prepare and submit contributions back to
Nakafa. The fork must not be used as a standalone project, hosted service,
mirror, product, rebrand, or distribution channel.

By submitting a pull request, patch, issue attachment, content correction,
translation, design, dataset, documentation change, or any other contribution,
you certify that:

- You have the right to submit the contribution.
- The contribution is your original work, or you have permission to submit it.
- The contribution does not include secrets, private data, copied proprietary
  material, or material with license terms that conflict with Nakafa.
- You grant PT. Nakafa Tekno Kreatif a perpetual, worldwide, non-exclusive,
  royalty-free, sublicensable, and transferable license to use, reproduce,
  modify, distribute, publicly display, publicly perform, create derivative
  works from, and relicense the contribution as part of Nakafa.
- PT. Nakafa Tekno Kreatif may use the contribution in source-available,
  commercial, proprietary, hosted, educational, and internal versions of Nakafa
  without owing you payment.

Do not submit a contribution if you cannot grant these rights.

## Getting Started

### Prerequisites
- Node.js 22+
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
pnpm --filter www typecheck # Type check the web app
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
