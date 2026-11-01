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

/** Loads an attempt's compact state and the row of its entry section, when the set opens on one. */
const loadSetAttempt = Effect.fn("tryouts.runtime.loadSetAttempt")(function* (
  attempt: Docs["tryoutAttempts"],
  appLocale: AppLocaleCode
) {
  const sections = yield* loadAttemptSections(attempt);
  const entryFrozen = Option.getOrUndefined(
    Arr.findFirst(attempt.sections, (frozen) => frozen.publicPath === undefined)
  );
  return {
    attempt: yield* loadAttemptState({
      appLocale,
      attempt,
      sections,
    }),
    entrySection: entryFrozen
      ? Option.getOrUndefined(
          Arr.findFirst(
            sections,
            (section) => section.sectionKey === entryFrozen.sectionKey
          )
        )
      : undefined,
  };
});

/** Loads one exact attempt without repeating immutable catalog reads. */
export const loadSetAttemptState = Effect.fn(
  "tryouts.runtime.loadSetAttemptState"
)(function* (attempt: Docs["tryoutAttempts"], appLocale: AppLocaleCode) {
  const current = yield* loadSetAttempt(attempt, appLocale);
  const entry = current.entrySection
    ? yield* loadSectionState(attempt, current.entrySection, appLocale)
    : { content: [], runtime: null };
  return {
    content: entry.content,
    state: {
      attempt: current.attempt,
      runtime: entry.runtime,
    },
  };
});

/**
 * Reads one mutable set state through an exact owned attempt ID. A live query repeats this on every
 * write, so it reads no question body.
 */
export const readSetAttemptState = Effect.fn(
  "tryouts.runtime.readSetAttemptState"
)(function* (args: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly locale: AppLocaleCode;
}) {
  const auth = yield* getOptionalAppUserForRead();
  if (!auth) {
    return null;
  }
  const attempt = yield* readOwnedAttemptById(args.attemptId, auth.appUser._id);
  if (!attempt) {
    return null;
  }
  const current = yield* loadSetAttempt(attempt, args.locale);
  return {
    attempt: current.attempt,
    runtime: current.entrySection
      ? yield* loadSectionRuntime(attempt, current.entrySection)
      : null,
  };
});
