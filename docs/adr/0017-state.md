# ADR 0017: Shared Client State Has Two Homes, And Streamed Content Keeps Its Context

## Status

Accepted. Amended on 13 October 2026: the assessment player and the school
working set are two more instances of the store rule (Instances Planned For The
School).

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

## Instances Planned For The School

Program wave B adds two instances of the first rule. Neither exists on main yet.

### The assessment player

`AssessmentPlayer` is the one player for try-outs and school exams (ADR 0031).
Its mode, its navigator, its keyboard handling, its scroll position, and its
tools are written by its own actions and by browser events, and not by render. So
they live in a Zustand store created once for each player instance, carried by a
plain context and read with `useStore(store, selector)`. Two players share
nothing. What the player receives, the attempt, the exam profile, and the items,
comes through a plain context read with `use()`, as the second rule says. An
answer is written optimistically in the same frame, and a failed write returns
the screen to the server's value (ADR 0013).

### The working set

The open tabs of a member in a school, and the active tab, are one stored row for
each member and school. The provider of the school shell creates the store once,
starting from that row. A change of tabs shows at once in the store, and the
write follows after a delay. If the write fails, the tabs return to the stored
row. The stored row never flows back into the store through an effect, and the
context value of the provider never changes after hydration, because the shell
wraps streamed content.

The browser test: open three tabs, reload, and the order and the active tab are
the same.

## Consequences

- `scripts/check/react.ts`, run by `pnpm check:tests`, rejects
  `use-context-selector`, React's `useContext`, and Zustand's module-level
  `create`. Biome's `noRestrictedImports` rejects the context-backed auth APIs
  of `convex/react` and `@convex-dev/better-auth`. Neither looks at
  `createStore`, so a store that `createStore` makes at module level passes both.
  Two players or two working sets would share such a store, so review rejects
  it.
- `apps/www/e2e/content/hydration.browser.ts` proves cold lessons and
  articles keep their streamed content, signed out and signed in.
- `apps/www/e2e/account/session.browser.ts` holds Better Auth's answer back
  after a reload and proves a change made in that moment is saved signed in.

## Rejected Alternative

One context for everything re-renders every reader on each change, and a
context value that changes after hydration throws away streamed server HTML.
A module-level store shares state between provider instances and requests.
