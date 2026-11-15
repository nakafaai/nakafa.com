import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** Tells the learner a practice request did not go through, and reports why. */
export const reportPracticeFailure = Effect.fn("www.practice.failure")(
  function* (error: unknown) {
    yield* Effect.sync(() =>
      toast.error(
        {
          description: "practice-failed.description",
          title: "practice-failed.title",
        },
        { position: "bottom-center" }
      )
    );
    yield* reportClientException(error, { source: "tryout-practice" });
  }
);
