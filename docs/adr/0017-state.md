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
server sent. A provider wraps no streamed content when no Suspense boundary
below it can still be streaming from the server, so its context may change as a
Confect hook answers, as the reader of the Memory page does: the only boundary
below it is the editor's, which mounts in the browser after the learner opens
it.

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
- Better Auth answers for the session one request after a page loads. The
  browser remembers the id of its last session (`@/lib/auth/known`, read with
  `useSyncExternalStore`, whose server snapshot knows none), so Convex asks for
  that session's token at once and holds every function call until it has an
  answer. A change made in the first moment after a load is therefore sent
  signed in, and a signed-in page authenticates one request sooner. Readers
  still see the session as pending until Better Auth answers.
- A lesson renderer that loads with `next/dynamic` goes through
  `withHydrationBoundary` from `@/lib/content/renderer/client/boundary`, whose
  visible `Activity` lets the lesson hydrate, and answer presses, before the
  renderer's code arrives.

## Player

The player of a running try-out section (`apps/www/components/player`) follows
both homes. What only the learner and the player's observers write, namely the
current question, the view, the open overlay, and the request to reveal a
question, lives in a store that `PlayerProvider` creates once per player. What
the questions hold, such as their answers, travels in props from the binding to
the parts that use it, because the signed question bodies stream in a Suspense
boundary below the provider. A context that changed when the live attempt
arrived would make React discard the HTML the server sent for that boundary,
while the store never changes, so it can sit above it.

## Consequences

- `scripts/check/react.ts`, run by `pnpm check:tests`, rejects
  `use-context-selector`, React's `useContext`, and Zustand's module-level
  `create`. Biome's `noRestrictedImports` rejects the context-backed auth APIs
  of `convex/react` and `@convex-dev/better-auth`.
- `apps/www/e2e/content/hydration.browser.ts` proves cold lessons and
  articles keep their streamed content, signed out and signed in.
- `apps/www/e2e/account/session.browser.ts` holds Better Auth's answer back
  after a reload and proves a change made in that moment is saved signed in.

## Rejected Alternative

One context for everything re-renders every reader on each change, and a
context value that changes after hydration throws away streamed server HTML.
A module-level store shares state between provider instances and requests.
