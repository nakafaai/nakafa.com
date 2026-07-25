"use client";

import { PreviewEventSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Either, Schema } from "effect";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the real Next route after Aksara publishes a local revision. */
export function PreviewRefresh() {
  const router = useRouter();

  useEffect(() => {
    const events = new EventSource("/api/internal/content/preview");

    /** Refetches the server tree after every validated source state change. */
    function refresh(event: MessageEvent) {
      const decoded = Schema.decodeUnknownEither(
        Schema.parseJson(PreviewEventSchema)
      )(event.data, { onExcessProperty: "error" });
      if (Either.isLeft(decoded)) {
        return;
      }
      router.refresh();
    }

    events.addEventListener("update", refresh);
    return () => {
      events.removeEventListener("update", refresh);
      events.close();
    };
  }, [router]);

  return null;
}
