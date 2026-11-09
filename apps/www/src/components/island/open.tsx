import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import island from "@repo/backend/confect/_generated/refs/island";
import { DateTime, Effect, Result } from "effect";
import { useEffect } from "react";

/**
 * Opens the owner's island once their page mounts: it makes the island with the
 * starter set on a first visit, and keeps its zone at the browser's, so its day
 * and hour follow the owner when they travel (ADR 0042, D18). The page draws the
 * starter set meanwhile, which is what the first visit makes.
 */
export function OpenIsland() {
  const open = useMutation(island.mutations.open);
  useEffect(() => {
    Effect.runFork(
      Effect.tryPromise(() =>
        open({ timeZone: DateTime.zoneMakeLocal() })
      ).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onFailure: (error) =>
              Effect.sync(() =>
                captureException(error, { source: "island-open" })
              ),
            onSuccess: () => Effect.void,
          })
        ),
        // A dropped connection opens the island on the next visit.
        Effect.catchTag("UnknownError", () => Effect.void)
      )
    );
  }, [open]);
  return null;
}
