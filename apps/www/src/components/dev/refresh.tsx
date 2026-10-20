"use client";
import {
  type LocalPreviewManifest,
  PreviewEventSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { Result, Schema } from "effect";
import { useEffect } from "react";
/** Reloads the real route when Aksara finishes a local compilation attempt. */
export function PreviewRefresh({
  revision,
  status,
}: {
  revision: number;
  status: LocalPreviewManifest["status"];
}) {
  useEffect(() => {
    const events = new EventSource("/api/internal/content/preview");
    let observedRevision = revision;
    let observedStatus = status;
    /** Loads newer terminal revisions, including edits missed while disconnected. */
    function refresh(event: MessageEvent) {
      const decoded = Schema.decodeUnknownResult(
        Schema.fromJsonString(PreviewEventSchema)
      )(event.data, { onExcessProperty: "error" });
      if (Result.isFailure(decoded)) {
        return;
      }
      const update = decoded.success;
      if (
        update.revision < observedRevision ||
        (update.revision === observedRevision &&
          update.status === observedStatus) ||
        update.status === "pending"
      ) {
        return;
      }
      observedRevision = update.revision;
      observedStatus = update.status;
      // Next preserves caught errors on router.refresh() at the same pathname.
      // A new document also recovers when a valid artifact failed while rendering.
      window.location.reload();
    }
    events.addEventListener("update", refresh);
    return () => {
      events.removeEventListener("update", refresh);
      events.close();
    };
  }, [revision, status]);
  return null;
}
