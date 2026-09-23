# ADR 0008: Admit And Bound Paid Work

## Decision

Convex reserves a chat turn's model credits in the same transaction that creates
its hold and usage ledger entry. Provider generation starts only after that
transaction commits. Concurrent requests cannot spend the same balance. A native
Convex token bucket independently limits admission to a burst of five starts and
ten starts per minute per user, including requests whose credits are refunded.

The HTTP route reserves after required origin, request, locale, model and auth
checks, before content verification, profile, curriculum and pinned-context
reads. All later preparation belongs to the refund scope. A rejected turn does
not perform optional preparation, and the route does not recheck a balance that
reservation has already debited.

Nina loads at most the newest 50 complete messages before applying its text-token
budget. This is a conversation-context policy, independent of token count, so
empty and non-text histories cannot trigger unbounded pagination. Whole messages
preserve tool-call and tool-result parts together. The full transcript remains
available for browsing, and compression retains the current message.

Successful persistence closes the hold and completes its existing ledger entry.
Failure refunds it at most once. A refund can restore only the allowance from
which the hold was taken: both the reset timestamp and the plan grant identity
must still match. Upgrades, downgrades, account deletion, and calendar resets
cannot turn an old hold into extra credits. An abandoned hold expires after ten
minutes, beyond the HTTP function's five-minute maximum. The native scheduled
recovery is intentionally retained even when it becomes an idempotent no-op.

The HTTP request owns one work deadline with time left for durable persistence.
Request cancellation and reader cancellation propagate through the main AI SDK
stream, specialist agents, tool repair, suggestions, and abortable HTTP clients.
The failure adapter registers Vercel `waitUntil` immediately and waits for local
generation settlement before returning credits. An optional suggestion timeout
must not discard an already completed main answer. External services remain
responsible for stopping work after cancellation; each remote calculation also
has its own execution limit.

CAS runs each calculation in the owned Python worker process. A twenty-second
deadline kills and reaps that worker. Two local slots reject excess work instead
of creating a waiting queue. Request, operand, collection, matrix, derivative,
and serialized-result limits bound input and output. Linux workers additionally
limit address space to 512 MiB because small symbolic inputs can allocate large
intermediate integers. This leaves headroom in the verified standard 2 GiB
production instance. Process startup adds latency, so normal arithmetic,
calculus, and matrix results are part of worker acceptance.

## Convex Ownership

Popularity counter operations own their Aggregate insert, replace, and delete in
the same Convex transaction. Updates reuse the document already read for the
counter calculation. There is no second trigger facade. The transaction rolls
back both changes if either write fails. Read-only ranking consumers keep the
same Aggregate contract.

Popularity audit-row deletion is suspended. Completed finite-window cycles do
not prove admitted-event coverage, authorized account withdrawals, contiguous
queue progress, lifetime inclusion or rank-index consistency. Historical viewer
rows have already been retired, so current counter totals cannot retroactively
supply that proof. The remaining signals, durable lifetime counters and every
public ranking window are preserved. Reintroducing deletion requires prospective
accounting and a bounded, resumable integrity proof that detects concurrent
writes and checks the counter/index relationship in both directions.

The retired retention cron and scheduler entrypoints are removed. The frozen
`learningPopularityRetention` checkpoint remains historical evidence; it neither
schedules deletion nor certifies data completeness.

Mutations that write only tables without registered triggers use native Convex
builders. Mutations that own message, subscription, score, or other registered
trigger invariants keep trigger-aware builders. Explicit table IDs alone are
not a cost optimization: the installed trigger writer can read old and new rows
even for unregistered tables. Verify complete write ownership before changing a
builder, and preserve the measured database-read budgets.

Active Pro plan lookup reads one indexed matching subscription. Try-out access
separately enforces a live period through the existing end-date index. Polar
ingestion normalizes dates with `toISOString()`, and the current production rows
were verified before using the lexicographic date range. IRT lookup selects
current records inside the index rather than filtering historical rows after
reading them. Prefix indexes remain when their implicit creation-time ordering
is part of a consumer's contract.

## Persistence Contract

Assistant persistence requires an existing credit hold. A completed or expired
hold makes a delayed retry a no-op. There is no post-generation charging path
and no second user-balance write on successful completion.

Only the HTTP server calls the scheduled persistence actions. The browser sends
the same chat request through the AI SDK's ordinary fetch transport, without a
deployment pin. Next.js Skew Protection does not pin these custom fetches. The
release therefore observes the predecessor server's five-minute maximum
request lifetime and pending scheduled persistence before removing its optional
hold contract. Future changes must recheck both transport and scheduler
ownership instead of treating promotion alone as proof that old callers stopped.

## References

- [Convex transactions and concurrency](https://docs.convex.dev/database/advanced/occ)
- [Convex scheduled mutation guarantees](https://docs.convex.dev/scheduling/scheduled-functions)
- [Convex best-practice rules](https://docs.convex.dev/eslint)
- [Convex index ranges](https://docs.convex.dev/database/reading-data/indexes/)
- [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Skew Protection request ownership](https://vercel.com/docs/skew-protection#how-it-works)
- [Python subprocess deadline behavior](https://docs.python.org/3/library/subprocess.html#subprocess.run)
- [Python address-space limits](https://docs.python.org/3/library/resource.html#resource.RLIMIT_AS)
