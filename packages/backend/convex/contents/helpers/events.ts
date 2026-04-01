import { CONTENT_VIEW_EVENT_SEGMENT_MS } from "@repo/backend/convex/contents/constants";

/** Groups view events into coarse time segments so the drain avoids live writes. */
export function getContentViewEventSegmentStart(timestamp: number) {
  return (
    Math.floor(timestamp / CONTENT_VIEW_EVENT_SEGMENT_MS) *
    CONTENT_VIEW_EVENT_SEGMENT_MS
  );
}
