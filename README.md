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

## Architecture

### Customer Sync Flow (Convex + Polar)

The platform uses [Polar](https://polar.sh) for payments with bidirectional sync to Convex database.

#### Signup Flow

```mermaid
flowchart LR
    A[User Signup] --> B[Auth Trigger]
    B --> C[syncCustomer]
    C --> D[ensureCustomer]
    D <--> E[(Polar API)]
    D --> F[upsertCustomer]
    F --> G[(Convex DB)]
```

#### Checkout Flow

```mermaid
flowchart LR
    A[User Click] --> B[generateCheckoutLink]
    B --> C[requireCustomer]
    C --> D[ensureCustomer]
    D <--> E[(Polar API)]
    C --> F[upsertCustomer]
    F --> G[(Convex DB)]
    B --> H[createCheckoutSession]
    H --> E
    E --> I[Checkout URL]
```

#### Webhook Flow

```mermaid
flowchart LR
    A[(Polar API)] -->|webhook| B[Webhook Handler]
    B -->|created/updated| C[upsertCustomer]
    B -->|deleted| D[deleteCustomerById]
    C --> E[(Convex DB)]
    D --> E
```

#### Flow Summary

| Flow | Trigger | Steps |
|------|---------|-------|
| **Signup** | User registers | Auth trigger → `syncCustomer` → `ensureCustomer` → `upsertCustomer` |
| **Checkout** | User clicks buy | `requireCustomer` → `createCheckoutSession` → Redirect to Polar |
| **Portal** | User opens settings | `requireCustomer` → `createCustomerPortalSession` → Redirect |
| **Webhook** | Polar event | `upsertCustomer` or `deleteCustomerById` |

#### Key Design Decisions

- **Polar is source of truth** - Local DB is cache for fast queries
- **Idempotent operations** - All mutations safe to retry
- **Race condition handling** - `ensureCustomer` retries on create failure
- **Edge case recovery** - Deleted from Polar → recreated on next checkout

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
