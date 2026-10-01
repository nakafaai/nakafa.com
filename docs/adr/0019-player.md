# ADR 0019: One Shared Player Runs Try-Outs and School Assessments

## Status

Accepted.

## Context

A running try-out section rendered every question in one list under a header
that wrapped to a second row on phones and a finish button that showed a
spinner. Learners could not flag a question to revisit, jump to a number, or
work one question at a time. School assessments (CBT) need the same surface
with tenant rules, such as a locked view, so building a second player would
split every fix in two.

## Decision

One generic player lives in `apps/www/components/player`. A provider builds a
session with three parts and passes it to `PlayerProvider`:

- state: the questions, each with its response, flag, and actions bound to its
  own placement, plus `locked` while time runs out or the section finishes;
- actions: `finish` and `prepareFinish`;
- meta: title, back link, an optional locked view, and the response registry.

The consumer try-out provider (`components/tryout/player`) builds the session
from the live Convex runtime. The School provider will implement the same
interface. The session is computed during render, so it travels in a plain
context; the view state that only the player writes (current question, view
mode, open overlay, jump requests) lives in a Zustand store created once per
provider, following the shared state rule in `AGENTS.md`.

The player composes explicit parts instead of boolean modes: a one-row header
(back, title, timer, Selesai), `PlayerList` and `PlayerSingle`, a sticky footer
(previous, flag, position, next), and the navigator as a sidebar from the
large breakpoint and a sheet below it. Shortcuts: arrows step, F flags, 1 to 5
pick an option, G opens or focuses the navigator; none fire while typing or
inside a widget that owns arrow keys.

The view is either the list or one question at a time. The server resolves it
before the first render: an assessment lock, then `?view=`, then the
`player_view` cookie, then the list. Switching updates the store at once and
then writes the cookie and replaces `?view=`, so reloads render the same view
without a flash. An unknown `?view=` is an invalid URL and returns 404. Single
mode keeps hidden questions mounted inside React Activity, which the server
does not render.

Each response kind renders through a registry keyed by the kinds of the
response contract, checked with `satisfies`, so a new kind fails the build
until its renderer is registered. An entry may map digit keys to a selection.

Every mutation is optimistic with rollback: answers and flags patch both
runtime queries at once, and a failure shows one toast with a retry. Flags are
presence rows in `tryoutFlags` (ADR 0003). Finishing runs in a transition that
holds the running player with `useOptimistic` until the destination commits,
so the section summary never flashes; the button never changes text or shows
a spinner. Scoring stays on the server.

## Consequences

- The CBT lane adds a School provider and `assessmentFlags` behind
  `PlayerQuestion.flag`, and passes its lock to the view resolution.
- New response kinds land as new renderer files registered in
  `components/tryout/runtime/response/registry.ts`.
- The list follows the reading position with two intersection observers and
  no layout reads on scroll; a jump keeps its question current until the
  reader scrolls by hand.
