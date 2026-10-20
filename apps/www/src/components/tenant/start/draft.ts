import { useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option } from "effect";
import { applyAnswer, type StartAnswer } from "@/components/tenant/start/state";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Saves one answer of the school questionnaire. The draft query shows the
 * answer at once, and Confect steps it back when the server refuses it.
 */
export function useSaveStartAnswer() {
  const save = useMutation(tenancy.start.save).withOptimisticUpdate(
    (localStore, { answer }) => {
      const current = localStore.getQuery(tenancy.start.draft, {});
      if (Option.isNone(current)) {
        return;
      }
      localStore.setQuery(
        tenancy.start.draft,
        {},
        Option.some(
          applyAnswer(current.value, answer, current.value?.updatedAt ?? 0)
        )
      );
    }
  );

  return (answer: StartAnswer) =>
    Effect.runFork(
      Effect.tryPromise(() => save({ answer })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.catch((error) =>
          reportClientException(error, { source: "school-start-save" }).pipe(
            Effect.andThen(
              Effect.sync(() =>
                toast.error({
                  description: "school-save-error.description",
                  title: "school-save-error.title",
                })
              )
            )
          )
        )
      )
    );
}
