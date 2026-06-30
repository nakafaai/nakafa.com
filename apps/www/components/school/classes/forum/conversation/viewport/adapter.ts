import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type Effect, Schema } from "effect";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import type {
  ViewportMeasurement,
  ViewportPlacement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

/** Expected failure while syncing the latest visible Forum post read marker. */
export class ViewportReadError extends Schema.TaggedError<ViewportReadError>()(
  "ViewportReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while saving one local Forum Conversation scroll snapshot. */
export class ViewportSessionError extends Schema.TaggedError<ViewportSessionError>()(
  "ViewportSessionError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Adapter Interface for the virtualized Transcript scroll surface. */
export interface ViewportScroller {
  captureView: () => ConversationView | null;
  isViewReached: (view: ConversationView) => boolean;
  isViewSettled: (view: ConversationView) => boolean;
  measure: () => ViewportMeasurement | null;
  place: (placement: ViewportPlacement) => boolean;
}

/** Adapter Interface for persisting one Forum Conversation Snapshot. */
export interface ViewportSession {
  saveSnapshot: (
    snapshot: ConversationScrollSnapshot
  ) => Effect.Effect<void, ViewportSessionError>;
}

/** Adapter Interface for marking the latest visible Transcript post as read. */
export interface ViewportRead {
  markPostRead: (
    postId: Id<"schoolClassForumPosts">
  ) => Effect.Effect<void, ViewportReadError>;
}

/** Adapter Interface for debounce and highlight timing. */
export interface ViewportTimer {
  sleep: (milliseconds: number) => Effect.Effect<void, never>;
}

/** External Adapter set required by the Effect-owned Viewport Module. */
export interface ViewportAdapters {
  read: ViewportRead;
  scroller: ViewportScroller;
  session: ViewportSession;
  timer: ViewportTimer;
}
