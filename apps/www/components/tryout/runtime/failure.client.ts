import { Effect } from "effect";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

/** Codes that mean the section already ended, which its own state shows. */
const ENDED_CODES: ReadonlySet<string> = new Set([
  "TRYOUT_ATTEMPT_NOT_ACTIVE",
  "TRYOUT_EXPIRED",
  "TRYOUT_SECTION_NOT_ACTIVE",
]);

/**
 * Tells the learner one try-out mutation failed after its rollback: one toast
 * with a retry for real failures, and only the optional notice when the
 * section had already ended.
 */
export const notifyTryoutFailure = Effect.fn("tryout.notifyFailure")(
  function* (input: {
    readonly code: string | undefined;
    /** Shown when the section had already ended; omit to stay silent. */
    readonly ended?: string;
    readonly error: unknown;
    readonly message: string;
    readonly retry: { readonly label: string; readonly run: () => void };
    readonly source: string;
    readonly toastId: string;
  }) {
    if (input.code !== undefined && ENDED_CODES.has(input.code)) {
      const ended = input.ended;
      if (ended !== undefined) {
        yield* Effect.sync(() => {
          toast.info(ended, { id: input.toastId, position: "bottom-center" });
        });
      }
      return;
    }
    yield* reportClientException(input.error, {
      ...(input.code === undefined ? {} : { convex_error_code: input.code }),
      source: input.source,
    });
    yield* Effect.sync(() => {
      toast.error(input.message, {
        action: { label: input.retry.label, onClick: input.retry.run },
        id: input.toastId,
        position: "bottom-center",
      });
    });
  }
);
