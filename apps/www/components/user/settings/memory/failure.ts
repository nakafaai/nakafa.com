import { NinaMemoryRejected } from "@repo/backend/confect/nina/memory.spec";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Tells the learner a change failed, in the words that fit: `missing` when the
 * memory was deleted somewhere else, `limit` when they saved more often than a
 * person writes, and `other` for anything else. A refusal the page can cause is
 * a normal answer. A failure nobody expected goes to analytics, and so does the
 * refusal of an empty memory, which the page never sends.
 *
 * Returns whether the learner can try the change again, which they cannot when
 * the memory it named is gone.
 */
export const reportMemoryFailure = Effect.fn("www.memory.reportFailure")(
  function* (
    error: unknown,
    messages: Record<"limit" | "missing" | "other", ToastCopy>
  ) {
    const failure =
      Schema.is(NinaMemoryRejected)(error) && error.reason !== "empty"
        ? error.reason
        : "other";

    if (failure === "other") {
      yield* reportClientException(error, {
        source: "components/user/settings/memory",
      });
    }
    yield* Effect.sync(() => {
      toast.error(messages[failure].title, {
        description: messages[failure].description,
      });
    });

    return failure !== "missing";
  }
);
