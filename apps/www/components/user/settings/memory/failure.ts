import { NinaMemoryRejected } from "@repo/backend/confect/nina/memory.spec";
import { Effect, Schema } from "effect";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Tells the learner a change failed, in the words that fit: `limit` when they
 * already keep as many memories as the page allows, `missing` when the memory
 * was deleted somewhere else, and `other` for anything else. A refusal the
 * page can cause is a normal answer. A failure nobody expected goes to
 * analytics, and so does the refusal of an empty memory, which the page never
 * sends.
 *
 * Returns whether the learner can try the change again, which they cannot when
 * the memory it named is gone.
 */
export const reportMemoryFailure = Effect.fn("www.memory.reportFailure")(
  function* (
    error: unknown,
    messages: Record<"limit" | "missing" | "other", string>
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
      toast.error(messages[failure]);
    });

    return failure !== "missing";
  }
);
