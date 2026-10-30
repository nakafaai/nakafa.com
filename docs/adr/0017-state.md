# ADR 0017: Shared Client State Has Two Homes, And Streamed Content Keeps Its Context

> Superseded in part by [ADR 0037](0037-cloudflare.md) and [ADR 0036](0036-boundary.md): the hosting and framework statements of this record describe the earlier stack. Cloudflare Workers through Alchemy and the TanStack Start boundary replace them.

## Status

Accepted. Amended on 13 October 2026: the assessment player and the school
working set are two more instances of the store rule (Instances Of The Store
Rule). Amended on 17 October 2026: the pending actions of the chat stay out of
transitions (Pending Actions Are Not Transitions). Amended on 30 October 2026:
a press before hydration is kept and replayed (A Press Before Hydration).

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
- A lesson renderer that loads with `React.lazy` goes through
  `withHydrationBoundary` from `@/lib/content/renderer/client/boundary`, whose
  visible `Activity` lets the lesson hydrate, and answer presses, before the
  renderer's code arrives.

## Pending Actions Are Not Transitions

A send, a stop, a retry, a new-chat admission, and the attachment tray that
waits for one keep their pending state as plain state, not as a React
transition. Two facts of the installed packages make a transition wrong for
them. React entangles every transition that starts while an async action is
pending with that action (`entangleAsyncAction` in react-dom 19.3.0), and
TanStack Router loads a navigation inside `startTransition`
(`src/Transitioner.tsx` in `@tanstack/react-router`). A transition
that held a send would therefore hold the learner's next navigation until the
server answered. The chat store (`apps/www/src/components/ai/chat/store.ts`)
holds the pending flags of a send, a stop, or a retry. The admission
(`apps/www/src/components/ai/chat/admission.tsx`) holds its prompt, and the tray
(`apps/www/src/components/ai/input.tsx`) holds the files that wait for it. The
navigation tests in `apps/www/e2e/chat/leave.browser.ts` check that a learner
can leave while an admission is pending. Rename, sharing, and delete need no pending state: they
update the loaded lists optimistically and roll back on failure.

## A Press Before Hydration

A static page starts its scripts only after it paints (`deferStaticScripts` in
`apps/www/src/lib/static/scripts.ts`), and React hydrates it once they arrive:
under a second on a fast connection, several seconds on a low-end phone. A
control that the server drew reaches no handler in between, and React replays
only the events that arrive after `hydrateRoot` runs. A press in that window is
kept, so no first press is a dead click.

- A control whose state belongs in the address is a real link or form, which
  works before hydration.
- Any other control spreads the props of `useEarlyPress` from
  `apps/www/src/lib/press/replay.ts`. The pre-paint script `EARLY_PRESS_SCRIPT`
  (`apps/www/src/lib/press/prepaint.ts`), which the root document runs from its
  head beside the theme, currency, and signed-in hint scripts, listens in the
  capture phase and marks the nearest pressed `[data-press]` control with
  `data-pressed`. The control shows the pressed look at once
  (`apps/www/src/styles/globals.css`). When React mounts it, the hook clears the
  mark and runs the press, and after that the control's own `onClick` runs it
  and clears the mark the script set.
- The mark lives on the control, so a control that adopts the mechanism needs
  no other code. The hook hydrates the control with `suppressHydrationWarning`,
  because the mark is an attribute React did not render.

Nina's entry on lessons, articles, and Quran pages is the first control that
keeps its press: `apps/www/e2e/chat/sheet.browser.ts` presses it right after
the page loads.

## Instances Of The Store Rule

### The player

The player of a running try-out section (`apps/www/src/components/player`) is the
one player for try-outs and, in program wave B, for school exams (ADR 0031). It
follows both homes. What only the learner and the player's observers write,
namely the current question, the view, the open overlay, and the request to
reveal a question, lives in a store that `PlayerProvider` creates once per
player. What the questions hold, such as their answers, travels in props from
the binding to the parts that use it, because the signed question bodies stream
in a Suspense boundary below the provider. A context that changed when the live
attempt arrived would make React discard the HTML the server sent for that
boundary, while the store never changes, so it can sit above it.

### The working set

Program wave B adds the working set of the school shell. It does not exist on
main yet.

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

- `scripts/check/react.ts`, run by `bun run check:tests`, rejects
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
