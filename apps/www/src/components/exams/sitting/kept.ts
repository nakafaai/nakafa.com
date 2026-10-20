import type { GenericId } from "@confect/core";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect } from "effect";
import { useEffect, useRef } from "react";
import { sittingCallFailures } from "@/components/exams/sitting/actions";
import { useSendAnswer } from "@/components/exams/sitting/answer";
import { keptAnswersFor, readKept } from "@/components/exams/sitting/keep";
import type { PaperValue } from "@/components/exams/sitting/paper";
import { sittingStorage } from "@/components/exams/sitting/storage";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Sends again the answers that the browser kept for an attempt, once its paper is on the screen. The
 * answers that were sent and never confirmed, because the page closed first, are the ones that the browser
 * still holds. The paper's questions come from the server, so each kept answer goes to its own question. The
 * failures of the pass show one toast, not one toast for each kept answer that the server refuses.
 */
export function useResendKeptAnswers({
  attemptId,
  deviceId,
  paper,
  sittingId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  readonly paper: PaperValue;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const send = useSendAnswer();
  const resumed = useRef(false);

  useEffect(() => {
    if (resumed.current) {
      return;
    }
    resumed.current = true;
    Effect.runPromise(
      readKept(sittingId, attemptId).pipe(
        Effect.provide(sittingStorage),
        Effect.flatMap((kept) =>
          Effect.forEach(
            keptAnswersFor(
              kept,
              Arr.map(paper.questions, (question) => question.id)
            ),
            ({ answer, questionId }) =>
              send(
                {
                  attemptId,
                  deviceId,
                  questionId,
                  response: answer.response,
                  sittingId,
                  slug,
                },
                answer.answeredAt
              )
          )
        ),
        Effect.flatMap((failures) =>
          sittingCallFailures(Arr.getSomes(failures))
        ),
        Effect.catchTag("KeyValueStoreError", (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/resend",
          })
        )
      )
    );
  }, [attemptId, deviceId, paper, send, sittingId, slug]);
}
