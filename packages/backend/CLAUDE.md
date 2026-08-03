# Backend agent guide

Read [`AGENTS.md`](AGENTS.md) before changing this package. It owns the local
workflow, package architecture, and isolated Convex Agent Mode requirements.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Nakafa keeps one canonical Convex skill surface in root `.agents/skills`.
Do not install package-local skill copies.

<!-- convex-ai-end -->
