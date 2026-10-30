import type { GenericId } from "@confect/core";
import {
  type ExamResponse,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/exams/sittings/response";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { sittingCallFailures } from "@/components/exams/sitting/actions";
import { useSendAnswer } from "@/components/exams/sitting/answer";
import { keptAttempt } from "@/components/exams/sitting/keep";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import { keptStorage } from "@/components/player/storage";
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
  locked,
  paper,
  sittingId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  /** A locked attempt takes no answers, so the kept ones wait until the attempt is unlocked. */
  readonly locked: boolean;
  readonly paper: PaperValue;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const send = useSendAnswer();
  const resumed = useRef(false);

  useEffect(() => {
    if (locked || resumed.current) {
      return;
    }
    resumed.current = true;
    Effect.runPromise(
      keptAttempt(sittingId, attemptId)
        .answersFor(Arr.map(paper.questions, (question) => question.id))
        .pipe(
          Effect.provide(keptStorage),
          Effect.flatMap((kept) =>
            Effect.forEach(kept, ({ answer, questionId }) =>
              send(
                {
                  attemptId,
                  deviceId,
                  questionId,
                  response: answer.response,
                  sittingId,
                  slug,
                  version: answer.version,
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
  }, [attemptId, deviceId, locked, paper, send, sittingId, slug]);
}

/**
 * The text that a typed answer opens with: the text that the browser kept for the question and the server has
 * not confirmed, else the saved text. The field takes its text once, so it is read once, when the question
 * shows; the paper shows the saved text until the kept answer is sent again. A school renders only in the
 * browser, so its storage is there to read.
 */
export function useKeptText({
  attemptId,
  question,
  sittingId,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly question: PaperQuestion;
  readonly sittingId: GenericId.GenericId<"examSittings">;
}) {
  const [text] = useState(() =>
    Effect.runSync(
      keptAttempt(sittingId, attemptId)
        .responseOf(question.id)
        .pipe(
          Effect.provide(keptStorage),
          Effect.catchTag("KeyValueStoreError", (error) =>
            reportClientException(error, {
              source: "components/exams/sitting/kept",
            }).pipe(Effect.as(Option.none<ExamResponse>()))
          ),
          Effect.map((kept) =>
            typedText(
              Option.getOrElse(kept, () => question.response ?? NO_RESPONSE)
            )
          )
        )
    )
  );
  return text;
}
