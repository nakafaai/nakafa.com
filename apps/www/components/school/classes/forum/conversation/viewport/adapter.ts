import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Context, type Effect, Schema } from "effect";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import type {
  ViewportMeasurement,
  ViewportPlacement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/session/store";

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

/** Effect service tag for browser or test adapters used by one Viewport service. */
export class ConversationViewportAdapters extends Context.Service<
  ConversationViewportAdapters,
  {
    read: {
      /** Marks the latest visible post as read through the backing data source. */
      markPostRead: (
        postId: Id<"schoolClassForumPosts">
      ) => Effect.Effect<void, ViewportReadError>;
    };
    scroller: {
      /** Captures the semantic view currently represented by the scroll position. */
      captureView: () => ConversationView | null;
      /** Returns the transcript that backs live virtualizer geometry. */
      getTranscript: () => ActiveTranscriptModel;
      /** Returns whether the scroll position has reached the semantic view. */
      isViewReached: (view: ConversationView) => boolean;
      /** Returns whether the semantic view is already in reading position. */
      isViewSettled: (view: ConversationView) => boolean;
      /** Returns whether the semantic view is currently visible. */
      isViewVisible: (view: ConversationView) => boolean;
      /** Measures the current virtualized transcript geometry. */
      measure: () => ViewportMeasurement | null;
      /** Imperatively places the virtualized scroller at a semantic target. */
      place: (placement: ViewportPlacement) => boolean;
    };
    session: {
      /** Saves a restorable latest snapshot or a detached snapshot that invalidates it. */
      saveSnapshot: (
        snapshot: ConversationScrollSnapshot
      ) => Effect.Effect<void, ViewportSessionError>;
    };
    timer: {
      /** Suspends the viewport fiber for a bounded UI timing interval. */
      sleep: (milliseconds: number) => Effect.Effect<void, never>;
    };
  }
>()("ConversationViewportAdapters") {}

/** External Adapter set required by the Effect-owned Viewport service. */
export type ViewportAdapters = Context.Service.Shape<
  typeof ConversationViewportAdapters
>;

/** Adapter for the virtualized Transcript scroll surface. */
export type ViewportScroller = ViewportAdapters["scroller"];
