import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Effect,
  type Fiber,
  Queue,
  Ref,
  type Scope,
  SubscriptionRef,
} from "effect";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import {
  type deriveViewportState,
  initialViewportState,
  type ViewportEvent,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";

export const HIGHLIGHT_DURATION_MS = 5000;
export const PERSIST_DELAY_MS = 160;
const VIEWPORT_EVENT_CAPACITY = 64;

export type ActiveTranscript = ActiveTranscriptModel | null;
export type ForumPostId = Id<"schoolClassForumPosts">;
export type RuntimeFiber = Fiber.Fiber<void, never>;
export type ViewportStateDraft = Parameters<typeof deriveViewportState>[0];

/** Creates the mutable Effect refs and event queue that one open viewport service owns. */
export const makeViewportRuntime = Effect.fn("www.forum.viewport.runtime")(
  function* (adapters: ViewportAdapters, scope: Scope.Scope) {
    const eventQueue = yield* Queue.bounded<ViewportEvent>(
      VIEWPORT_EVENT_CAPACITY
    );
    return {
      activeTranscriptRef: yield* Ref.make<ActiveTranscript>(null),
      adapters,
      eventQueue,
      highlightFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
      highlightTokenRef: yield* Ref.make(0),
      lastMeasurementRef: yield* Ref.make<ViewportMeasurement | null>(null),
      lastReadPostIdRef: yield* Ref.make<ForumPostId | null>(null),
      persistFiberRef: yield* Ref.make<RuntimeFiber | null>(null),
      scope,
      stateRef: yield* SubscriptionRef.make(initialViewportState),
    };
  }
);

/** Mutable Effect refs and adapters owned by one open viewport service. */
export type ViewportRuntime = Effect.Success<
  ReturnType<typeof makeViewportRuntime>
>;
