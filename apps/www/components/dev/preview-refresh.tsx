"use client";
import { PreviewEventSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Result, Schema } from "effect";
import { useEffect } from "react";
/** Reloads the real route when Aksara finishes a local compilation attempt. */
export function PreviewRefresh({ revision }: { revision: number }) {
  useEffect(() => {
    const events = new EventSource("/api/internal/content/preview");
    let observedRevision = revision;
    /** Loads newer terminal revisions, including edits missed while disconnected. */
    function refresh(event: MessageEvent) {
      const decoded = Schema.decodeUnknownResult(
        Schema.fromJsonString(PreviewEventSchema)
      )(event.data, { onExcessProperty: "error" });
      if (Result.isFailure(decoded)) {
        return;
      }
      if (decoded.success.revision <= observedRevision) {
        return;
      }
      observedRevision = decoded.success.revision;
      if (decoded.success.status === "pending") {
        return;
      }
      // Next preserves caught errors on router.refresh() at the same pathname.
      // A new document also recovers when a valid artifact failed while rendering.
      window.location.reload();
    }
    events.addEventListener("update", refresh);
    return () => {
      events.removeEventListener("update", refresh);
      events.close();
    };
  }, [revision]);
  return null;
}
