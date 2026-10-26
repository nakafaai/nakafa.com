import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import { useThrottledCallback } from "@mantine/hooks";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import { useEffect } from "react";
import { usePlayer } from "@/components/player/provider";
import { reportClientException } from "@/lib/analytics/client";

/** Reads the player's current question as a question ID, or none before a question is current. */
const decodeQuestionId = Schema.decodeUnknownOption(Id("examQuestions"));

/** The most often the student's screen is written as the student moves between questions (K25). */
const LOOK_INTERVAL_MILLISECONDS = 2000;

/**
 * Writes the question the student's screen shows to the server as the student moves, at most once every
 * two seconds, so the proctor's panel on this student draws the same question (K25). It renders nothing.
 * A write that fails only reaches the analytics, since the student's paper never waits on it.
 */
export function SittingLook({
  attemptId,
  deviceId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  readonly slug: TenantSlug;
}) {
  const current = usePlayer((state) => state.current);
  const look = useMutation(exams.screens.look);
  const send = useThrottledCallback(
    (questionId: GenericId.GenericId<"examQuestions">) => {
      Effect.runFork(
        Effect.tryPromise(() =>
          look({ attemptId, deviceId, questionId, slug })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/exams/sitting/look",
              }),
            onSuccess: () => Effect.void,
          })
        )
      );
    },
    LOOK_INTERVAL_MILLISECONDS
  );

  // The player's current question is one of the paper's questions, named by its ID.
  useEffect(() => {
    const questionId = decodeQuestionId(current);
    if (Option.isSome(questionId)) {
      send(questionId.value);
    }
  }, [current, send]);

  return null;
}
