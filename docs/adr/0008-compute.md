# ADR 0008: Admit And Bound Paid Work

## Decision

Convex reserves a chat turn's model credits in the same transaction that creates
its hold and usage ledger entry. Provider generation starts only after that
transaction commits. Concurrent requests cannot spend the same balance. A native
Convex token bucket independently limits admission to a burst of five starts and
ten starts per minute per user, including requests whose credits are refunded.

The admission mutation reserves after its authentication, chat ownership,
busy-chat and model checks, before resolving learning context. Reservation,
context resolution, the saved prompt, the turn, and its scheduled generation
commit in one transaction, so a rejected admission leaves no hold to refund.

Nina's provider context follows ADR 0001: the Agent fetch reads at most the
newest 50 messages, and the context module keeps whole turns within its token
budgets, so empty and non-text histories cannot trigger unbounded pagination.
Whole turns preserve tool-call and tool-result parts together. The full
transcript remains available for browsing.

Successful persistence closes the hold and completes its existing ledger entry.
Failure refunds it at most once. A refund can restore only the allowance from
which the hold was taken: both the reset timestamp and the plan grant identity
must still match. Upgrades, downgrades, account deletion, and calendar resets
cannot turn an old hold into extra credits.

A recovery sweep settles a turn that cannot finish on its own. A turn still
queued or running past its deadline settles as failed with `response-timeout`
and refunds. The deadline is the chat call's total budget in
`confect/gateway/purpose.ts` plus one minute, counted from the start of the
run, or from admission for a turn that never started. A cron every five minutes
finds these turns through the `by_phase` index and settles each one in its own
scheduled mutation, through the settlement a failed run uses. One turn that
cannot settle never blocks the others, and the next sweep tries it again.
Admission schedules no per-turn check. Only an active turn settles, so a late
result, a second sweep, or a cancel that races a completion changes nothing and
never refunds twice.

A learner may have two turns queued or running at once. A third is refused with
`RATE_LIMITED` before any credit is held. A turn holds its place from admission
until its deadline passes. After that it can no longer run and waits only for
the sweep, so a settlement that keeps failing cannot lock the learner out of
Nina.

The scheduled generation action owns one stream deadline with time left for
settlement within Convex's action limit. Cancelling a queued turn settles it at
once, since no run exists. Cancelling a running turn cuts off its Agent stream,
marks its prompt failed, and records the request. The refund, the state change,
and the chat unlock wait until the run has exited, so a stream that is still
running is never paid back. The run checks its turn every second and aborts its
generation when the turn was stopped or settled elsewhere, which also stops a
silent provider call. A run that is gone never exits, so the stop also schedules
a settlement after a short grace, `STOP_GRACE` in `confect/nina/settlement.ts`,
and stopping always frees the chat. The web shows the turn as running until it
settles: the composer stays locked until the run's next check, or for a run that
is gone until the grace has passed. A saved answer wins a race with a cancel and
settles as complete.

Deleting a chat is the one route that settles a running turn at once. The chat
and its Agent journal go in the same transaction, so nothing a run that is still
alive writes can survive and no new turn can start on the chat. The hold is paid
back without waiting for the run, whose next check finds its turn settled and
stops its provider call. Keeping the turn until its run exits would need its row
to outlive the chat cleanup and its prompt message to outlive the thread
deletion.

A generation that ends because its turn was stopped or settled elsewhere is no
failure to report. The settlement that follows every run is reported whenever it
fails, and the grace settlement of a stopped turn or the sweep tries it again.

The abort propagates through the main AI SDK stream, specialist agents, tool
repair, and abortable HTTP clients. Titles, follow-up suggestions, the rolling
summary, and learner memory curation run later, concurrently, in a separate
action with their own deadlines, so optional work never discards a completed
answer. External services remain responsible for stopping work after
cancellation; each remote calculation also has its own execution limit.

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

Popularity retention follows two separate consumer horizons. Viewer keys only
deduplicate the current server-assigned UTC day, so prior-day keys can expire.
Queued work carries its own complete event payload. Applying that payload,
updating daily signals, lifetime and finite counters, updating Aggregate, and
removing the queue row commit in the same mutation. Account deletion removes
pending personal queue rows and viewer keys without reversing processed totals.

Daily aggregate signals remain until every finite-window maintenance cycle has
completed the current UTC day. Only signals older than the 365-day window then
expire. Late queue processing excludes those days from finite counters and
daily signals while still updating lifetime. Lifetime counters and their ranking
entries are never deleted by retention.

One hourly cron prunes bounded indexed pages and atomically schedules a next
page when needed. Each page derives the current day again, so a chain crossing
midnight waits for the new day's maintenance before deleting daily inputs.
Maintenance rows are read only when an expired daily input exists. Missing or
incomplete cycles retain those inputs while viewer-key expiration continues.
The remaining indexed rows are the resume position; there is no separate
checkpoint table, migration endpoint or compatibility handler. Retrying or
overlapping pages is safe under Convex transaction serialization.

This supersedes the earlier suspension, which incorrectly required complete
historical forensic evidence before expiring operational inputs. Historical
viewer keys are not a permanent event ledger and cannot reconstruct lifetime
totals, including after account deletion. That limitation does not invalidate
the authoritative counters or require retaining personal deduplication keys
forever. Regression tests verify the transaction, window cutoff, delayed queue,
restart and midnight behavior rather than treating cycle completion as a claim
of historical data completeness.

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
