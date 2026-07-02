# ADR 0002: Effect-Owned Forum Conversation Viewport

## Status

Accepted for the PR #196 replacement plan.

## Context

Forum Conversation scrolling currently spreads state across React refs, Zustand stores, Virtua callbacks, debounced hooks, and session persistence. That split makes initial restore, user scroll, jump-to-post, back navigation, latest scrolling, and snapshot persistence hard to reason about together.

## Decision

Nakafa will replace the Forum Conversation scroll controller with one Effect-owned service instance per opened Forum Conversation. The service owns the Transcript Viewport lifecycle as explicit events and state transitions; React dispatches events and subscribes to state, while Virtua, session storage, read mutation, and timers are Adapters.

Pure deterministic helpers such as Transcript row construction, geometry, bottom-distance calculation, and restore-target selection stay pure. Effect is used at the real stateful and effectful Seams, not as ceremony around pure math.

## Consequences

- The current split controller, leftover compatibility paths, duplicated state ownership, and legacy scroll hooks should be deleted instead of preserved.
- Viewport state, Placement intent, back navigation, latest-edge detection, read sync, and Snapshot persistence must be coordinated by one state machine.
- Latest-control visibility is derived from the Effect-owned Viewport state. Virtua, Zustand, and in-flight Placement refs do not directly decide whether the latest button is shown.
- React UI Modules consume a small provider/context Interface with state, actions, and meta. The provider is the only React Module that knows the Viewport Implementation is Effect-owned.
- The React-facing Interface exposes explicit semantic actions. The Effect Implementation may use a typed internal event union, but callers do not construct raw events for normal UI interactions.
- The Viewport lifecycle is modeled as a discriminated state internally. Boolean render facts are derived at the React Interface instead of stored as independent sources of truth.
- User scroll intent wins over prior latest affinity. Once measured user scrolling detaches from the latest edge, in-flight latest Placement is interrupted or cancelled instead of pulling the Viewport back down.
- New posts preserve the current visual anchor while the lifecycle is detached from latest. Incoming Transcript rows must not convert detached state back to latest; the latest control stays visible until the user explicitly returns to latest or measurement confirms latest again.
- Viewport measurements use one normalized contract owned by the Effect Viewport Module. The Virtua Adapter reads raw Virtua state and emits measured facts such as offset, viewport size, scroll size, bottom distance, visible anchor, visible range, and monotonic measurement sequence.
- Snapshot persistence uses a semantic anchor as the source of truth. Optional Virtua cache may be stored as a performance hint, but restore validates the Forum Conversation, Transcript shape, anchor, and measured metadata first; conflicting cache is discarded.
- The Effect Viewport Module depends on four external Adapters: Scroller for measurement and Placement execution, Session for Snapshot persistence, Read for Convex read synchronization, and Timer for debounced settling, highlight expiry, and frame scheduling. React, Virtua, Convex hooks, browser storage, and raw timers stay behind those Adapter Interfaces.
- Navigation History stores semantic Viewport positions instead of raw offsets. Back navigation restores the previous semantic entry through the same Placement flow as normal navigation and commits entries only after measurement confirms settled Placement.
- Every Placement path uses smooth motion, including explicit navigation, fresh open restore, Snapshot restore, unread Placement, anchor preservation, and layout correction. Smooth motion is explicit in the Placement command, not inferred from stale refs or hidden auto/smooth switching.
- Latest Affinity is confirmed by normalized measurement. If the Viewport is at latest and new Transcript rows arrive, the Module creates smooth latest Placement; if the current user sends while detached, sending also creates smooth latest Placement; if another user sends while detached, the Module preserves the current anchor and keeps the latest control visible.
- The latest control hides only after normalized measurement confirms the bottom distance is within one explicit threshold, currently `<= 2px`.
- The Viewport Implementation uses one `SubscriptionRef<ViewportState>` as the only mutable state owner and one bounded Effect `Queue` for serialized lifecycle events. React subscribes through the provider, UI actions and Adapter callbacks enqueue typed events, and one scoped lifecycle fiber consumes events sequentially.
- Placement work may fork scoped interruptible fibers, but every resulting state transition re-enters through the same event queue. Zustand stores and React refs do not own Transcript Viewport lifecycle state; refs are limited to DOM or Virtua handles inside the Scroller Adapter.
- `ConversationViewportProvider` is the only React Module that runs the Effect runtime for the Viewport. It owns one scoped runtime instance per opened Forum Conversation, creates live Adapters, subscribes to `SubscriptionRef.changes`, and maps state, actions, and meta into the React Interface.
- Provider cleanup on unmount or Forum Conversation change closes the scope, shuts down the event queue, and interrupts Placement, read, and timer fibers. UI Modules never import Effect runtime primitives, and tests instantiate the Effect Viewport Module with fake Adapters without React.
- React Effects in this area are limited to synchronizing the provider with the external Effect runtime and subscription lifecycle. Derived render state, navigation decisions, and scroll behavior stay in the Effect Module or React event handlers, not ad hoc `useEffect` chains.
- Fresh open restore order is valid Snapshot, then unread Placement, then latest Placement. Snapshot validity must be tied to the same Forum Conversation and compatible Transcript shape.
- Tests should cover the Effect Viewport Module through its Interface with fake Scroller, Session, Read, and Timer Adapters. Pure helpers keep colocated `{file}.test.ts` tests, lifecycle tests cover state transitions and typed failures, provider tests only verify React Interface wiring when necessary, and Browser e2e verifies the pinned panel, page scroll, chat scroll, latest control, smooth Placement, and desktop/mobile behavior.
- Legacy controller, hook, and Zustand store tests should be removed with the deleted Implementation instead of preserved as compatibility coverage.
