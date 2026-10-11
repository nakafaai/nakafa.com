# ADR 0010: Nina Learner Memory Is Opt-In, Curated, and Leaves With Its Sources

## Status

Superseded by ADR 0022.

## Context

Nina knew nothing about a learner beyond one page and one turn, although Nakafa
already holds the learner's onboarding answers, preferences, and try-out
results. Learners also tell Nina durable facts about themselves, such as their
grade or exam goals, and had to repeat them in every new chat. Many learners are
minors, so anything Nina keeps must be visible, deletable, and never collected
by default.

## Decision

Nina reads a learner profile derived on read from existing account data: the
onboarding focus and region, the preferred try-out country, and the latest
finished try-out with correct answers per section. The profile is never stored
with a turn. Role and curriculum preference stay frozen in the turn at
admission.

Learner memory is off until the learner turns it on in settings. While it is
on, the follow-up action after each completed turn asks the fast model whether
the learner's newest message reveals a durable fact about themself, and applies
at most three new facts, three rewrites, and five removals by key. The curator
sees the known facts and the account facts, so it neither repeats nor
contradicts them, and it is told never to record sensitive information or
anything about other people. Memory keeps at most 30 facts of at most 160
characters; the least recently saved leave first.

Every remembered fact sits in the system prompt, after the page and before the
question focus, within 1,500 tokens together with the profile. Saved facts are
few and apply to most turns, like a preference for worked examples, so Nina uses
all of them instead of retrieving them by similarity. The learner block then
stays stable across turns for provider prefix caching and adds no embedding
round trip before the first token. A vector index pays off for recall over
earlier conversations; that is a separate decision because it changes what
deleting a chat means.

Facts leave with their sources. Deleting a chat forgets what came from it,
turning memory off deletes the whole memory, the learner can forget one fact in
settings, and account deletion removes the memory. Curation usage accumulates
on the memory document, like summary usage, rather than in a turn's usage
ledger.

## Implementation Contract

- `ninaMemories` holds one document per learner while memory is on, indexed by
  user. Each fact carries its source chat, key, save time, and text.
- `nina/memory:get`, `enable`, `disable`, and `forget` are public, pass the
  session middleware, and act only on the signed-in learner. `nina/memory:read`
  and `nina/memory:apply` are internal.
- `apply` keeps nothing when memory was turned off meanwhile. It changes facts
  only for the memory document and revision the curation read, so a curation
  that raced a reset, a newer curation, or a fact the learner forgot changes
  nothing, and it adds no facts from a chat deleted meanwhile. The call's usage
  still counts.
- The prompt lists remembered facts newest first, so a bounded Learner block
  keeps the latest corrections.
- The chats trigger forgets a deleted chat's facts in the deleting transaction.
  Account cleanup deletes the memory before the chats.
- The settings route preloads memory so its card renders without layout shift,
  and memory mutations update it optimistically.
