import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { loadAttemptSections } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import { loadAttemptState } from "@repo/backend/confect/tryouts/runtime/attempt/state";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadSectionState } from "@repo/backend/confect/tryouts/runtime/section/questions";
import { noTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Option } from "effect";

/** Loads one exact section without repeating immutable catalog reads. */
export const loadSectionAttemptState = Effect.fn(
  "tryouts.runtime.loadSectionAttemptState"
)(function* (
  attempt: Docs["tryoutAttempts"],
  sectionKey: string,
  appLocale: AppLocaleCode
) {
  const snapshot = Option.getOrUndefined(
    Arr.findFirst(
      attempt.sectionSnapshots,
      (section) => section.sectionKey === sectionKey
    )
  );
  if (!snapshot) {
    return null;
  }
  const sections = yield* loadAttemptSections(attempt);
  const section =
    Option.getOrUndefined(
      Arr.findFirst(
        sections,
        (candidate) => candidate.sectionKey === sectionKey
      )
    ) ?? null;
  const { current, loaded } = yield* Effect.all(
    {
      current: loadAttemptState({
        appLocale,
        attempt,
        sectionKey,
        sections,
      }),
      loaded: section
        ? loadSectionState(attempt, section, appLocale)
        : Effect.succeed({
            content: noTryoutSectionContentAccess,
            runtime: null,
          }),
    },
    {
      concurrency: "unbounded",
    }
  );
  return {
    content: loaded.content,
    state: {
      attempt: current,
      runtime: loaded.runtime,
    },
  };
});

/** Reads one mutable section state through an exact owned attempt ID. */
export const readSectionAttemptState = Effect.fn(
  "tryouts.runtime.readSectionAttemptState"
)(function* (args: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly locale: AppLocaleCode;
  readonly sectionKey: string;
}) {
  const auth = yield* getOptionalAppUserForRead();
  if (!auth) {
    return null;
  }
  const attempt = yield* readOwnedAttemptById(args.attemptId, auth.appUser._id);
  if (!attempt) {
    return null;
  }
  const loaded = yield* loadSectionAttemptState(
    attempt,
    args.sectionKey,
    args.locale
  );
  return loaded?.state ?? null;
});
