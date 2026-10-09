import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, HashMap, Option, Schema } from "effect";
import { CONVERSATION_EDGE_TOLERANCE } from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import {
  type ActiveTranscriptModel,
  ActiveTranscriptModelSchema,
} from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  type ConversationUnreadCue,
  ConversationUnreadCueSchema,
} from "@/components/school/classes/forum/conversation/data/transcript/unread";
import {
  areConversationViewsEqual,
  type ConversationView,
  ConversationViewSchema,
} from "@/components/school/classes/forum/conversation/data/view/model";
import {
  type ConversationScrollSnapshot,
  ConversationScrollSnapshotSchema,
} from "@/components/school/classes/forum/session/store";

/** The alignments a placement may ask for. The scroller passes one to virtua, whose own type checks it there. */
const PlacementAlignSchema = Schema.Literals([
  "start",
  "center",
  "end",
  "nearest",
]);
const PlacementMotionSchema = Schema.Literals(["instant", "smooth"]);

/** Independent transcript jump actions derived from canonical viewport state. */
const ViewportJumpControlSchema = Schema.Struct({
  showBack: Schema.Boolean,
  showLatest: Schema.Boolean,
});
export type ViewportJumpControl = typeof ViewportJumpControlSchema.Type;

const ViewportMeasurementSchema = Schema.Struct({
  bottomDistance: Schema.Finite,
  hasOverflow: Schema.Boolean,
  isAtLatest: Schema.Boolean,
  lastVisiblePostId: Schema.NullOr(Id("schoolClassForumPosts")),
  offset: Schema.Finite,
  view: Schema.NullOr(ConversationViewSchema),
});
export type ViewportMeasurement = typeof ViewportMeasurementSchema.Type;

const ViewportPlacementSchema = Schema.Struct({
  align: Schema.optionalKey(PlacementAlignSchema),
  highlightPostId: Schema.NullOr(Id("schoolClassForumPosts")),
  motion: Schema.optionalKey(PlacementMotionSchema),
  view: ConversationViewSchema,
});
export type ViewportPlacement = typeof ViewportPlacementSchema.Type;

const ViewportEventSchema = Schema.Union([
  Schema.Struct({
    activeTranscript: ActiveTranscriptModelSchema,
    savedSnapshot: Schema.NullOr(ConversationScrollSnapshotSchema),
    type: Schema.Literal("transcript"),
    unreadCue: Schema.NullOr(ConversationUnreadCueSchema),
  }),
  Schema.Struct({
    measurement: Schema.NullOr(ViewportMeasurementSchema),
    source: Schema.Literals(["frame", "scroll"]),
    type: Schema.Literal("measure"),
  }),
  Schema.Struct({
    postId: Id("schoolClassForumPosts"),
    type: Schema.Literal("post"),
  }),
  Schema.Struct({ type: Schema.Literal("back") }),
  Schema.Struct({
    token: Schema.Finite,
    type: Schema.Literal("highlight-expired"),
  }),
  Schema.Struct({ type: Schema.Literal("latest") }),
  Schema.Struct({ type: Schema.Literal("persist") }),
  Schema.Struct({
    awayFromLatest: Schema.Boolean,
    type: Schema.Literal("user-scroll"),
  }),
]);
export type ViewportEvent = typeof ViewportEventSchema.Type;

const ViewportStateSchema = Schema.Struct({
  backStack: Schema.Array(ConversationViewSchema),
  hasOverflow: Schema.Boolean,
  highlightedPostId: Schema.NullOr(Id("schoolClassForumPosts")),
  isAtLatest: Schema.Boolean,
  jumpControl: ViewportJumpControlSchema,
  latestAffinity: Schema.Literals(["detached", "latest"]),
  lifecycle: Schema.Literals(["opening", "placing", "ready"]),
  pendingPlacement: Schema.NullOr(ViewportPlacementSchema),
});
export type ViewportState = typeof ViewportStateSchema.Type;

export const initialViewportState = deriveViewportState({
  backStack: [],
  highlightedPostId: null,
  hasOverflow: false,
  isAtLatest: true,
  latestAffinity: "latest",
  lifecycle: "opening",
  pendingPlacement: null,
});

/** Derives render facts from the canonical Forum Conversation Viewport state. */
export function deriveViewportState(
  state: Omit<ViewportState, "jumpControl"> & {
    jumpControl?: ViewportJumpControl;
  }
) {
  const jumpControl = getViewportJumpControl(state);

  return {
    ...state,
    jumpControl,
  } satisfies ViewportState;
}

/** Selects the jump actions allowed to render for the current viewport. */
function getViewportJumpControl({
  backStack,
  hasOverflow,
  isAtLatest,
}: Pick<ViewportState, "backStack" | "hasOverflow" | "isAtLatest">) {
  return {
    showBack: !isAtLatest && backStack.length > 0,
    showLatest: !isAtLatest && hasOverflow,
  } satisfies ViewportJumpControl;
}

/** Returns the next latest affinity after one normalized Viewport measurement. */
export function getViewportLatestAffinity({
  currentAffinity,
  hasUserDetachedFromLatest,
  isAtLatest,
  pendingPlacement,
}: {
  currentAffinity: ViewportState["latestAffinity"];
  hasUserDetachedFromLatest: boolean;
  isAtLatest: boolean;
  pendingPlacement: ViewportPlacement | null;
}) {
  if (pendingPlacement?.view.kind === "post") {
    return "detached";
  }

  if (isAtLatest) {
    return "latest";
  }

  if (hasUserDetachedFromLatest) {
    return "detached";
  }

  return currentAffinity;
}

/** Returns whether one scroll measurement should detach from latest affinity. */
export function isViewportDetachedScroll({
  measurement,
  pendingPlacement,
  previousMeasurement,
}: {
  measurement: ViewportMeasurement;
  pendingPlacement: ViewportPlacement | null;
  previousMeasurement: ViewportMeasurement | null;
}) {
  if (!pendingPlacement) {
    return true;
  }

  if (pendingPlacement.view.kind !== "bottom") {
    return false;
  }

  if (!previousMeasurement) {
    return false;
  }

  return (
    measurement.bottomDistance >
    previousMeasurement.bottomDistance + CONVERSATION_EDGE_TOLERANCE
  );
}

/** Returns whether one fresh measurement changed the semantic viewport position. */
export function hasViewportMeasurementMoved({
  measurement,
  previousMeasurement,
}: {
  measurement: ViewportMeasurement;
  previousMeasurement: ViewportMeasurement;
}) {
  if (!areConversationViewsEqual(previousMeasurement.view, measurement.view)) {
    return true;
  }

  return (
    Math.abs(measurement.offset - previousMeasurement.offset) >
    CONVERSATION_EDGE_TOLERANCE
  );
}

/** Adds one semantic view to the back stack without duplicating the current entry. */
export function pushViewportBackView(
  backStack: readonly ConversationView[],
  view: ConversationView
) {
  const current = Option.getOrUndefined(Arr.last(backStack));

  if (areConversationViewsEqual(current, view)) {
    return [...backStack];
  }

  return [...backStack, view];
}

/** Returns whether one latest-position Snapshot still matches the Transcript. */
function canRestoreViewportSnapshot({
  activeTranscript,
  snapshot,
}: {
  activeTranscript: ActiveTranscriptModel;
  snapshot: ConversationScrollSnapshot;
}) {
  if (!(snapshot.wasAtBottom && snapshot.view.kind === "bottom")) {
    return false;
  }

  return snapshot.lastPostId === activeTranscript.lastPostId;
}

/** Selects the first Placement for a freshly opened Forum Conversation. */
export function getOpeningPlacement({
  activeTranscript,
  savedSnapshot,
  unreadCue,
}: {
  activeTranscript: ActiveTranscriptModel;
  savedSnapshot: ConversationScrollSnapshot | null;
  unreadCue: ConversationUnreadCue | null;
}) {
  if (
    savedSnapshot &&
    canRestoreViewportSnapshot({ activeTranscript, snapshot: savedSnapshot })
  ) {
    return {
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    } satisfies ViewportPlacement;
  }

  if (
    unreadCue &&
    HashMap.has(activeTranscript.rowIndexByPostId, unreadCue.postId)
  ) {
    return {
      align: "start",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "post", postId: unreadCue.postId },
    } satisfies ViewportPlacement;
  }

  return {
    highlightPostId: null,
    motion: "instant",
    view: { kind: "bottom" },
  } satisfies ViewportPlacement;
}
