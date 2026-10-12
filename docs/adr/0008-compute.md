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

Nina's provider context follows ADR 0001: the thread read lists the complete
turns after the summary 16 at a time, newest first, and pages back through the
thread, 50 messages at a time, only as far as those turns reach. It stops after
the page that brings the turns past the history budget, or once it has passed
32 askings that retries replaced, and the context module keeps whole
turns within its token budgets, so a long thread cannot trigger unbounded
pagination. Whole turns preserve tool-call and tool-result parts together. The
full transcript remains available for browsing.

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
Nina. A turn the learner stopped holds no place either, because their next
prompt settles it first.

The scheduled generation action owns one stream deadline with time left for
settlement within Convex's action limit. Cancelling a queued turn settles it at
once, since no run exists. Cancelling a running turn cuts off its Agent stream,
marks its prompt failed, and records the request. The page shows the turn as
cancelled from the moment of the stop, so the composer is free at once. The turn
itself settles, which pays the refund back and unlocks the chat, at the first of
three moments: its run has exited, a short grace has passed (`STOP_GRACE` in
`confect/nina/settlement.ts`, for a run that is gone and never exits), or the
learner sends their next prompt. That prompt settles every turn the learner
stopped, in any chat, in the same transaction that admits it, before the busy
check, the open-turn count and the credit hold. The cut-off stream can no longer
save output, so that refund is the one the run's exit would give a moment later,
and a prompt in a chat whose turn was not stopped is still refused as busy. The
run checks its turn every second and aborts its generation when the turn was
stopped or settled elsewhere, which also stops a silent provider call.
Whichever settlement comes first, the turn ends as cancelled at the time of the
stop, and the later ones find it settled and change nothing. A saved answer wins
a race with a cancel and settles as complete.

Deleting a chat settles its open turn in the deleting transaction, whether or
not the learner stopped it, and no new turn can start on a chat that is gone.
The hold is paid back without waiting for the run, whose next check finds its
turn settled and stops its provider call. Agent deletes the journal page by
page, the first page in that transaction and the rest in the mutations it
schedules. Keeping the turn until its run exits would need its row to outlive
the chat cleanup and its prompt message to outlive the thread deletion.

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

The pipeline maintains exactly the ranking the homepage reads: material
lessons, in the global scope, over the last seven UTC days. A view of an article
writes no popularity row, a lesson reached through a curriculum placement counts
once like any other visit, and no other window or lifetime total is kept. The
cost of keeping a counter that nothing reads was measured in Database I/O, which
is why a new window or scope needs a reader first.

Popularity retention follows two separate consumer horizons. Viewer keys only
deduplicate the current server-assigned UTC day, so prior-day keys can expire.
Queued work carries its own complete event payload. Applying that payload,
updating the daily signal and the counter, updating Aggregate, and removing the
queue row commit in the same mutation. Account deletion removes pending personal
queue rows and viewer keys without reversing processed totals.

Daily aggregate signals remain until the window's maintenance cycle has
completed the current UTC day. Only signals older than the seven-day window then
expire, because the daily pass reads the one signal leaving the window for each
counter and the weekly pass reads the signals inside it, so an older signal has
no reader. Late queue processing excludes a day outside the window from
counters and signals altogether.

The weekly pass recomputes each existing counter from its daily signals and
removes one that no signal backs. It does not recreate a counter that is gone:
the next view of that lesson creates it, holding only that view, and the next
weekly pass restores its score from the signals. The pipeline writes a signal
and its counter in one transaction, so a counter missing while its signals are
live is not a state the pipeline produces.

One hourly cron prunes bounded indexed pages and atomically schedules a next
page when needed. Each page derives the current day again, so a chain crossing
midnight waits for the new day's maintenance before deleting daily inputs.
Maintenance rows are read only when an expired daily input exists. Missing or
incomplete cycles retain those inputs while viewer-key expiration continues.
The remaining indexed rows are the resume position; there is no separate
checkpoint table or migration endpoint. Retrying or overlapping pages is safe
under Convex transaction serialization.

This supersedes the earlier suspension, which incorrectly required complete
historical forensic evidence before expiring operational inputs. Historical
viewer keys are not a permanent event ledger and cannot reconstruct totals,
including after account deletion. That limitation does not invalidate the
authoritative counters or require retaining personal deduplication keys
forever. Regression tests verify the transaction, window cutoff, delayed queue,
restart and midnight behavior rather than treating cycle completion as a claim
of historical data completeness.

Two temporary contract steps remain from the change that narrowed the pipeline
to one ranking. This ADR owns them, and they end together. Until they do, the
same hourly pass retires the counters, ranking entries and maintenance
watermarks of the windows and the scope that earlier versions kept (its index
ranges are its resume position, so a pass with nothing left to retire reads no
document), and `getTrendingSubjects` accepts and ignores the `windowKey`
argument that an older web deployment still sends. The exit is met when dev and
production report no retired counter and no retired watermark from the hourly
pass, and the production deploy is 8 days old (the window plus the day its
maintenance runs, the longest an older signal lives), with no older web
deployment taking requests. The cleanup is one change: delete
`contents/metrics/retire.ts` with its call and tests, drop `retiredCounters` and
`retiredCycles` from the prune result, narrow the stored window and scope values
of popularity rows, and the `applied` windows of daily signals, to the
maintained ones, and delete the `windowKey` argument with its compatibility
test.

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
