# Nakafa

[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nakafaai/nakafa.com)

## Overview

**Nakafa** is an open-source educational platform providing structured learning content across multiple educational levels (elementary, middle, high school, university) with political analysis articles.

**Live Site**: [nakafa.com](https://nakafa.com)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Git

### Installation

```bash
# Clone & install
git clone https://github.com/nakafaai/nakafa.git
cd nakafa
pnpm install

# Start development
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
pnpm dev          # Development server (Turbopack)
pnpm build        # Production build
pnpm start        # Production server
pnpm lint         # Lint & format check
pnpm test         # Run tests
pnpm clean        # Clean dependencies
```

## Development

### Project Documentation

Detailed technical documentation available on [DeepWiki](https://deepwiki.com/nakafaai/nakafa.com) - covers architecture, design decisions, and development patterns.

### Adding Content

1. Navigate to appropriate level in `packages/contents/subject/`
2. Create MDX files following existing structure
3. Update data files in `_data/` directories
4. Test locally with `pnpm dev`

### Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/name`
3. Make changes following established patterns
4. Run `pnpm lint` and `pnpm test`
5. Submit pull request

## License

**AGPL-3.0** - Copyleft license requiring source disclosure for network use.

For commercial licensing inquiries: <nakafaai@gmail.com>

## Contact

**Nabil Fatih** - [@nabilfatih](https://twitter.com/nabilfatih_) - <nakafaai@gmail.com>

---

Built with ❤️ for learners everywhere
