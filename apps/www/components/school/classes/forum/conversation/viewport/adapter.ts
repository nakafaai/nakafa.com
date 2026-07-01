import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Context, type Effect, Schema } from "effect";
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
  /** Captures the semantic view currently represented by the scroll position. */
  captureView: () => ConversationView | null;
  /** Returns whether the scroll position has reached the semantic view. */
  isViewReached: (view: ConversationView) => boolean;
  /** Returns whether the semantic view is currently visible. */
  isViewVisible: (view: ConversationView) => boolean;
  /** Measures the current virtualized transcript geometry. */
  measure: () => ViewportMeasurement | null;
  /** Imperatively places the virtualized scroller at a semantic target. */
  place: (placement: ViewportPlacement) => boolean;
}

/** Adapter Interface for persisting one Forum Conversation Snapshot. */
export interface ViewportSession {
  /** Saves the latest restorable semantic scroll snapshot for the forum. */
  saveSnapshot: (
    snapshot: ConversationScrollSnapshot
  ) => Effect.Effect<void, ViewportSessionError>;
}

/** Adapter Interface for marking the latest visible Transcript post as read. */
export interface ViewportRead {
  /** Marks the latest visible post as read through the backing data source. */
  markPostRead: (
    postId: Id<"schoolClassForumPosts">
  ) => Effect.Effect<void, ViewportReadError>;
}

/** Adapter Interface for debounce and highlight timing. */
export interface ViewportTimer {
  /** Suspends the viewport fiber for a bounded UI timing interval. */
  sleep: (milliseconds: number) => Effect.Effect<void, never>;
}

/** External Adapter set required by the Effect-owned Viewport service. */
export interface ViewportAdapters {
  read: ViewportRead;
  scroller: ViewportScroller;
  session: ViewportSession;
  timer: ViewportTimer;
}

/** Effect service tag for browser or test adapters used by one Viewport service. */
export class ConversationViewportAdapters extends Context.Tag(
  "ConversationViewportAdapters"
)<ConversationViewportAdapters, ViewportAdapters>() {}
