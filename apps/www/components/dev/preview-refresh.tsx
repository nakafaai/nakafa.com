"use client";
import { PreviewEventSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Result, Schema } from "effect";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
/** Refreshes the real Next route after Aksara publishes a local revision. */
export function PreviewRefresh({ revision }: { revision: number }) {
  const router = useRouter();
  useEffect(() => {
    const events = new EventSource("/api/internal/content/preview");
    let observedRevision = revision;
    /** Refetches only newer revisions, including edits missed while disconnected. */
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
      router.refresh();
    }
    events.addEventListener("update", refresh);
    return () => {
      events.removeEventListener("update", refresh);
      events.close();
    };
  }, [revision, router]);
  return null;
}
