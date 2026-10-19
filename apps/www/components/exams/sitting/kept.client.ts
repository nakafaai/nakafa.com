"use client";

import type { GenericId } from "@confect/core";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Record as Rec } from "effect";
import { useEffect, useRef } from "react";
import { useSendAnswer } from "@/components/exams/sitting/answer.client";
import { forgetAttempt, readKept } from "@/components/exams/sitting/keep";
import type { PaperValue } from "@/components/exams/sitting/paper";
import { sittingStorage } from "@/components/exams/sitting/storage.client";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Sends again the answers that the browser kept for an attempt, once its paper is on the screen. The
 * answers that were sent and never confirmed, because the page closed first, are the ones that the browser
 * still holds. The paper's questions come from the server, so each kept answer goes to its own question.
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
          Effect.forEach(paper.questions, (question) =>
            Option.match(Rec.get(question.id)(kept.answers), {
              onNone: () => Effect.void,
              onSome: (answer) =>
                send(
                  {
                    attemptId,
                    deviceId,
                    questionId: question.id,
                    response: answer.response,
                    sittingId,
                    slug,
                  },
                  answer.answeredAt
                ),
            })
          )
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

/** Drops what the browser kept for a submitted attempt. A browser that refuses storage reports it. */
export function forgetKeptAttempt(
  sittingId: GenericId.GenericId<"examSittings">,
  attemptId: GenericId.GenericId<"examAttempts">
) {
  Effect.runSync(
    forgetAttempt(sittingId, attemptId).pipe(
      Effect.provide(sittingStorage),
      Effect.catchTag("KeyValueStoreError", (error) =>
        reportClientException(error, {
          source: "components/exams/sitting/kept",
        })
      )
    )
  );
}
