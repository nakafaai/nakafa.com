# ADR 0020: Outbound Requests Have A Deadline, And Convex Hook Calls Do Not

## Decision

Every HTTP request that leaves a Nakafa process has a deadline that covers the
answer's body as well as its headers.

- `packages/backend/client/network.ts` owns the shared values and the wiring
  for transient reads: 10 seconds for one attempt, two retries after 500
  milliseconds and 1 second (31.5 seconds in all), the transport failures that
  are safe to repeat, and `retryNetworkAttempt`, which runs one attempt under
  the deadline and repeats it while it fails retryably.
- Only a failure that proves the request never reached the server is repeated,
  plus what one caller knows to be safe for its own request, such as a 5xx
  answer to the session token read and to the browser's read of the session
  (`readSession` in `apps/www/lib/auth/request.ts`), which Better Auth does not
  ask for again after a first read that failed until the learner returns to
  the tab.
- A caller keeps its own status rules, its decoder, and its error type. The
  shared part is the deadline, the retry, and the unwrap.
- A request that a person waits for can cut that budget: the content copy
  answers within 10 seconds in all.
- A request with a different shape sets its own limit beside its call, for
  example an SDK with its own timeout or a write that must not repeat.

Convex React hook calls get no client deadline.

- A live query is a subscription. It has no single request that can time out.
- The Convex client keeps a mutation pending while the socket is down and
  sends it again after it reconnects. It has no timeout option and no cancel.
  A client deadline would report a failure for a write that still happens, and
  a retry would queue a second copy.
- An action that was in flight when the connection dropped fails in the client.
  One that was not sent yet runs after the reconnect.
- The analytics consent write is the one bounded hook call. Its server write
  returns the stored decision when the decision already matches, and a newer
  decision interrupts the older save.
- A hook call whose answer starts a navigation, a clock, or a redirect starts
  only on a connected socket. `requireConvexOnline` in
  `apps/www/lib/convex/online.ts` stands in front of the call. It refuses at
  once when the browser reports no network. When the client has no connected
  socket it waits up to five seconds for one, because the first connection, a
  session refresh, and a first reconnect usually end within that time, and
  refuses after that. The call site then shows its usual failure. Nothing was
  queued, so that failure is true, and it is not reported as an exception. The
  call does not need a deadline.
- The guard reads what the browser and the client report. A socket that is
  dead but not yet closed, and a socket paused for a session token, still read
  as connected. A mutation started then is stored and delivered when the
  client recovers, and an action started then fails when the client notices,
  as before.
- A mutation that was already sent when the socket drops stays pending with
  its control, and the client delivers it after the reconnect. The guard does
  not end it: an error there would again report a failure for a write that
  still happens.
- A view that shows the connection state reads it with
  `useConvexConnectionState` and the rule `isConvexOffline`, as the try-out
  catalog does.

A Nina capability runs inside one step of the chat model, so it has a deadline
of its own, and every model call has a cap on its output.

- The chat step's timer starts with the step, and Nina's own call, which wrote
  the tool call, runs inside it before the tool starts. When that timer fires
  it aborts the tool without letting it settle. So a capability counts its time
  from the start of its step, not from its own. `generateResponse` marks the
  start of every step in `ChatStep`, and `streamCapability` gives a run the
  time until the end of that step (`purposes.chat.timeout.stepMs`) less a fixed
  margin for the tool result and the save of the step. Both live in
  `packages/backend/confect/nina/capability/`. A capability that starts when
  its step has no time left does not start.
- A run still going at that deadline is interrupted, which aborts the model
  calls it has in flight. It settles through the rule every run uses: cards
  that loaded stay, cards still loading end as errors, and the outcome is
  `partial` beside loaded evidence and `failed` without any.
- Inside the run, `CapabilityDeadline` tells each model call and provider call
  how much time is left, and each uses the shorter of that and its own budget.
  They end a little before the run does, so a capability can still report what
  it gathered. A call outside a capability run has only its own budget.
- Each purpose in `gateway/purpose.ts` sets the most one call may write, sent
  to the provider as `maxOutputTokens`: chat 16,384 tokens, specialist 6,144,
  background 4,096, suggestion 512, presentation 512. A call that ends at its
  cap finishes with `length`, which a chat turn already reads as
  `response-limit`. A specialist whose last step ends at its cap reports its
  result as `partial` and tells Nina that the answer was cut short
  (`specialistResult`), so a cut answer never reads as a whole one. So does a
  specialist whose loop ends at its step limit with a tool still called, since
  it wrote no answer.
- The cap is shared with the model's reasoning. Google's thinking guide counts
  thinking tokens in the output limit, and a call that reaches the limit while
  it still thinks stops with a cut or an empty answer. So each cap stands well
  above what a real call wrote, measured on Gemini 3.8 Flash through the
  gateway on the dev deployment on 11 October 2026, with a short system prompt
  and no cap:

  | Call | Effort | Output tokens | Of them reasoning |
  | --- | --- | --- | --- |
  | Chat: a history the learner asked to be very long | high | 9,593 | 2,055 |
  | Chat: a functional equation with a full proof | high | 5,842 | 4,366 |
  | Chat: two proofs and an integral | high | 3,384 | 1,369 |
  | Chat: a counting problem | high | 3,017 | 1,578 |
  | Chat: a lesson with three worked examples | high | 2,765 | 1,296 |
  | Background: a summary of sixteen turns | low | 1,042 | 0 |
  | Background: memory capture | low | 113 | 0 |
  | Suggestion: five follow-up questions | low | 85 | 0 |
  | Specialist: three checked calculations | low | 904 | 0 |

  The first draft of the caps (chat 8,192, background 1,024) would have cut
  the first chat answer and the summary. A summary could hold 1,200 tokens
  (`NINA_BUDGET.summary`) when the caps were set, and Nina reads at most 6,000
  tokens of a specialist's answer (`NINA_BUDGET.evidence`), which is where the
  background and specialist caps come from. Since 12 October 2026 a summary may
  hold 2,000 tokens, and the reasoning of its call counts against the same cap,
  so the background cap is 4,096. A summary that still ends at the cap is not
  saved: the previous summary stays and the next settled turn folds again.
  Measure again before a cap is lowered or raised, or the model changes.
- A link to Nakafa's own site goes to the Nakafa capability and never to web
  research. The capability forces the read tool, step after step, until the
  model has asked for every address the learner sent. A message with more
  addresses than research may read outside sources (8) gets the `limit`
  outcome and nothing is read, so the learner is told one limit for both. A
  page that signed content does not hold is reported as not found, Nina tells
  the learner that the page could not be read, and nothing falls back to a web
  fetch of Nakafa's own site.
- No capability repeats a model call after the SDK rejects its answer. The
  math repair call sends the validation error back, so it is not the same
  prompt.
- A math run takes at most as many steps as the specialist's step deadline
  fits in its total deadline (`MATH_STEPS`, four). A step is one call of the
  specialist's model. The repair of a tool call that came out invalid is one
  more call inside its step and is not counted, so this number bounds the
  steps, and the capability's deadline bounds the time of every call. The last
  step may call no tool, so the run ends with its answer. Its prompt tells the
  model the number, asks for the fewest tool calls that check what the request
  asks, and asks it to name any calculation the steps left unchecked. Using
  every step is no shortfall, since a run that has checked all it needs writes
  its answer in the last step too, so such a run is reported like any other. A
  provider that still calls a tool in the last step is cut by the cap and
  reported as `partial`. Before, the cap was the number of math operations
  (54). On 11 October a request for a derivative and its value was seen to run
  five steps on production, one of them an expansion that nobody had asked for.

## Consequences

- A reviewer who finds a hook mutation without a deadline leaves it so, and
  checks what its success branch does when the answer arrives late. A call
  whose answer navigates, starts a clock, or redirects and has no guard yet is
  a defect to fix, not an exception.
- A new transient read calls `retryNetworkAttempt` and passes its own deadline
  failure. It does not copy the wiring.
- A new capability is defined with `defineCapability`, which runs it through
  `streamCapability`, so every capability gets this deadline. A new model call
  inside one cuts its deadline with `limitDeadline`, a new provider call cuts
  its limit to `timeLeft`, and a specialist that reports a written answer does
  so through `specialistResult`.
- `packages/backend/client/content/transport.ts` keeps its own pipeline: one
  absolute clock over the send and the body, and it cancels the responses it
  discards, which the shared helper does not model.

## Rejected Alternatives

- A deadline on every hook mutation: it shows a failure while the write is
  still queued.
- One module for all request callers: their status rules, decoders, and error
  types differ, so it would be a thin wrapper with many options.
