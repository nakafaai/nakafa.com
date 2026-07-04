import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import type {
  ViewportMeasurement,
  ViewportPlacement,
  ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";

/** Returns whether one manual measurement should cancel the pending Placement. */
export function hasScrollMeasurementInterruptedPlacement({
  activeTranscript,
  hasUserDetachedFromLatest,
  measurement,
  pendingPlacement,
  previousMeasurement,
}: {
  activeTranscript: ActiveTranscriptModel | null;
  hasUserDetachedFromLatest: boolean;
  measurement: ViewportMeasurement;
  pendingPlacement: ViewportPlacement;
  previousMeasurement: ViewportMeasurement;
}) {
  if (pendingPlacement.view.kind === "bottom") {
    return hasUserDetachedFromLatest;
  }

  const targetIndex = getViewportViewRowIndex(
    activeTranscript,
    pendingPlacement.view
  );
  const previousIndex = getViewportViewRowIndex(
    activeTranscript,
    previousMeasurement.view
  );
  const nextIndex = getViewportViewRowIndex(activeTranscript, measurement.view);

  if (targetIndex === null || previousIndex === null) {
    return false;
  }

  if (nextIndex === null) {
    return true;
  }

  return (
    Math.abs(nextIndex - targetIndex) > Math.abs(previousIndex - targetIndex)
  );
}

/** Returns whether a pending placement should persist the user's latest intent. */
export function isPendingLatestIntent(state: ViewportState) {
  return (
    state.lifecycle === "placing" &&
    state.pendingPlacement?.view.kind === "bottom"
  );
}

/** Maps one semantic Viewport view to its Transcript row index when possible. */
function getViewportViewRowIndex(
  activeTranscript: ActiveTranscriptModel | null,
  view: ConversationView | null
) {
  if (!(activeTranscript && view)) {
    return null;
  }

  if (view.kind === "bottom") {
    return Math.max(0, activeTranscript.rows.length - 1);
  }

  return activeTranscript.rowIndexByPostId.get(view.postId) ?? null;
}
