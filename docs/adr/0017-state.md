# ADR 0017: Shared Client State Has Two Homes, And Streamed Content Keeps Its Context

## Decision

Shared client state lives in one of two places, chosen by what writes it.

- State that only its own actions or an external source (an observer, stream,
  timer, or browser API) writes, independent of render, lives in a Zustand
  store created once per provider instance with
  `useState(() => createStore(...))`, carried by a plain React context and read
  with `useStore(store, selector)`. A reader that did not select the changed
  value never runs.
- Everything a provider receives or computes during render (props, server
  data, Confect, Convex Agent, and Better Auth hook results), and state that
  follows props or a React transition, uses a plain React context read with
  `use()`. Split such a context by change frequency when some readers need
  only its slower part, and never copy it into a store through an effect.

Either kind is exposed through a `useX(selector)` hook, so readers never
depend on which one backs it. A context with no meaningful default starts as
`null` and its hook rejects a missing provider; a separate marker is used only
when `null` is a value the provider shares.

A provider that wraps streamed content keeps its context value unchanged after
hydration. React client-renders a Suspense boundary that is still streaming
when an ancestor context changes, in any lane, and discards the HTML the
server sent.

- State that resolves in the browser after hydration, such as the Better Auth
  session (read from its session atom, not its hook), Convex authentication,
  the viewport, and browser storage, lives in a store whose `useStore` server
  snapshot is the state the server rendered.
- A value derived from a Confect query is derived in the reading hook, where
  Convex serves every reader from one subscription.
- A callback in the value keeps one identity and reads the latest render
  through a ref mirrored in a layout effect.
- Convex authentication is read with `useConvexAuth` from
  `@/components/providers/convex` and its gates from `@/components/auth/gate`.
- A lesson renderer that loads with `next/dynamic` goes through
  `withHydrationBoundary` from `@/lib/content/renderer/client/boundary`, whose
  visible `Activity` lets the lesson hydrate, and answer presses, before the
  renderer's code arrives.

## Consequences

- `scripts/check/react.ts`, run by `pnpm check:tests`, rejects
  `use-context-selector`, React's `useContext`, and Zustand's module-level
  `create`. Biome's `noRestrictedImports` rejects the context-backed auth APIs
  of `convex/react` and `@convex-dev/better-auth`.
- `apps/www/e2e/content/hydration.browser.ts` proves cold lessons and articles keep
  their streamed content, signed out and signed in.

## Rejected Alternative

One context for everything re-renders every reader on each change, and a
context value that changes after hydration throws away streamed server HTML.
A module-level store shares state between provider instances and requests.
