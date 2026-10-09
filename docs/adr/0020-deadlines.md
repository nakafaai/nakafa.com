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
  answer to the session token read.
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

## Consequences

- A reviewer who finds a hook mutation without a deadline leaves it so, and
  checks what its success branch does when the answer arrives late. A call
  whose answer navigates, starts a clock, or redirects and has no guard yet is
  a defect to fix, not an exception.
- A new transient read calls `retryNetworkAttempt` and passes its own deadline
  failure. It does not copy the wiring.
- `packages/backend/client/content/transport.ts` keeps its own pipeline: one
  absolute clock over the send and the body, and it cancels the responses it
  discards, which the shared helper does not model.

## Rejected Alternatives

- A deadline on every hook mutation: it shows a failure while the write is
  still queued.
- One module for all request callers: their status rules, decoders, and error
  types differ, so it would be a thin wrapper with many options.
