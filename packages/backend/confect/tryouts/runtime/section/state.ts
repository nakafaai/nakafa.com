import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { loadAttemptSections } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import { loadAttemptState } from "@repo/backend/confect/tryouts/runtime/attempt/state";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import {
  loadSectionRuntime,
  loadSectionState,
} from "@repo/backend/confect/tryouts/runtime/section/questions";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Option } from "effect";

/** Loads an attempt's compact state through one frozen section, and that section's row once it started. */
const loadSectionAttempt = Effect.fn("tryouts.runtime.loadSectionAttempt")(
  function* (
    attempt: Docs["tryoutAttempts"],
    sectionKey: string,
    appLocale: AppLocaleCode
  ) {
    const frozen = Arr.some(
      attempt.sections,
      (section) => section.sectionKey === sectionKey
    );
    if (!frozen) {
      return null;
    }
    const sections = yield* loadAttemptSections(attempt);
    return {
      attempt: yield* loadAttemptState({
        appLocale,
        attempt,
        sectionKey,
        sections,
      }),
      section: Option.getOrUndefined(
        Arr.findFirst(
          sections,
          (candidate) => candidate.sectionKey === sectionKey
        )
      ),
    };
  }
);

/** Loads one exact section without repeating immutable catalog reads. */
export const loadSectionAttemptState = Effect.fn(
  "tryouts.runtime.loadSectionAttemptState"
)(function* (
  attempt: Docs["tryoutAttempts"],
  sectionKey: string,
  appLocale: AppLocaleCode
) {
  const current = yield* loadSectionAttempt(attempt, sectionKey, appLocale);
  if (!current) {
    return null;
  }
  const loaded = current.section
    ? yield* loadSectionState(attempt, current.section, appLocale)
    : { content: [], runtime: null };
  return {
    content: loaded.content,
    state: {
      attempt: current.attempt,
      runtime: loaded.runtime,
    },
  };
});

/**
 * Reads one mutable section state through an exact owned attempt ID. A live query repeats this on every
 * write, so it reads no question body.
 */
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
  const current = yield* loadSectionAttempt(
    attempt,
    args.sectionKey,
    args.locale
  );
  if (!current) {
    return null;
  }
  return {
    attempt: current.attempt,
    runtime: current.section
      ? yield* loadSectionRuntime(attempt, current.section)
      : null,
  };
});
