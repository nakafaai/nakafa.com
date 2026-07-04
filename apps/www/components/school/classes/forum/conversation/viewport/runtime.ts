import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Fiber, Queue, Ref, Scope, SubscriptionRef } from "effect";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import type {
  ViewportEvent,
  ViewportMeasurement,
  ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";

export const HIGHLIGHT_DURATION_MS = 5000;
export const PERSIST_DELAY_MS = 160;
export const VIEWPORT_EVENT_CAPACITY = 64;

export type ActiveTranscript = ActiveTranscriptModel | null;
export type ForumPostId = Id<"schoolClassForumPosts">;
export type RuntimeFiber = Fiber.RuntimeFiber<void, never>;
export type ViewportStateDraft = Omit<ViewportState, "jumpControl"> & {
  jumpControl?: ViewportState["jumpControl"];
};

/** Mutable Effect refs and adapters owned by one open viewport service. */
export interface ViewportRuntime {
  activeTranscriptRef: Ref.Ref<ActiveTranscript>;
  adapters: ViewportAdapters;
  eventQueue: Queue.Queue<ViewportEvent>;
  highlightFiberRef: Ref.Ref<RuntimeFiber | null>;
  highlightTokenRef: Ref.Ref<number>;
  lastMeasurementRef: Ref.Ref<ViewportMeasurement | null>;
  lastReadPostIdRef: Ref.Ref<ForumPostId | null>;
  persistFiberRef: Ref.Ref<RuntimeFiber | null>;
  scope: Scope.CloseableScope;
  stateRef: SubscriptionRef.SubscriptionRef<ViewportState>;
}
