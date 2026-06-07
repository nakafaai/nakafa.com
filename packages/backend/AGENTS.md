<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

Keep Convex route files focused on registered Convex functions. Move shared
domain implementation into capability folders using plain filenames like
`impl.ts`, `spec.ts`, or `internal.ts`; do not create prefix-suffixed files such
as `public.impl.ts` or `mutations.impl.ts`.

Use the Confect spec/impl split as structural inspiration, adapted to Convex
routing with folder-owned `spec.ts`, `impl.ts`, and `internal.ts` files instead
of prefix-suffixed filenames:

- https://confect.dev/concepts/spec-impl-model
- https://confect.dev/concepts/file-naming-conventions

Prefer one clear capability token per Convex folder or filename. CamelCase
domain terms such as `assistantResponses` or `contentAudios` are acceptable when
they name one established concept; ambiguous generic names or compound
prefix/suffix filenames are not.

Prefer direct imports from the owning module. Do not add barrel re-exports or
compatibility routes when callers can import the concrete capability directly.

Do not leave one-off migration, backfill, repair, maintenance, dead, redundant,
or legacy code/data paths behind. After verifying dev and prod data, delete the
obsolete Convex function and its tests before considering the work complete.

<!-- convex-ai-end -->
