import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { readAttemptDestination } from "@repo/backend/confect/tryouts/runtime/attempt/destination";
import { readAttemptResume } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import {
  getSectionScoreResult,
  loadAttemptScoreResult,
} from "@repo/backend/confect/tryouts/score/result";
import { Effect } from "effect";

interface AttemptStateInput {
  readonly appLocale: AppLocaleCode;
  readonly attempt: Docs["tryoutAttempts"];
  readonly sectionKey?: string;
  readonly sections: readonly Docs["tryoutSectionAttempts"][];
}

/** Projects the loaded attempt graph into its compact reactive state contract. */
export const loadAttemptState = Effect.fn("tryouts.attempt.loadState")(
  function* ({ appLocale, attempt, sectionKey, sections }: AttemptStateInput) {
    const resume = readAttemptResume(attempt, sections);
    const section = sectionKey
      ? (sections.find((candidate) => candidate.sectionKey === sectionKey) ??
        null)
      : null;
    const score = yield* loadAttemptScoreResult(attempt);
    return {
      activeSectionKey: resume.activeSectionKey,
      attemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      completedSectionKeys: attempt.completedSectionKeys,
      expiresAt: attempt.expiresAt,
      resumeSectionKey: resume.resumeSectionKey,
      resumeSectionPublicPath: resume.resumeSectionKey
        ? yield* readAttemptDestination(
            attempt,
            appLocale,
            resume.resumeSectionKey
          ).pipe(Effect.mapError(toTryoutRuntimeError))
        : null,
      score,
      section: section
        ? {
            answeredCount: section.answeredCount,
            completedAt: section.completedAt,
            endReason: section.endReason,
            expiresAt: section.expiresAt,
            score: yield* getSectionScoreResult(section),
            sectionKey: section.sectionKey,
            startedAt: section.startedAt,
            status: section.status,
            totalQuestions: section.totalQuestions,
          }
        : null,
      startedAt: attempt.startedAt,
      status: attempt.status,
    };
  }
);
