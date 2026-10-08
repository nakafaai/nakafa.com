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

/** Loads one exact attempt without repeating immutable catalog reads. */
export const loadSetAttemptState = Effect.fn(
  "tryouts.runtime.loadSetAttemptState"
)(function* (attempt: Docs["tryoutAttempts"], appLocale: AppLocaleCode) {
  const sections = yield* loadAttemptSections(attempt);
  const entrySnapshot = Option.getOrUndefined(
    Arr.findFirst(
      attempt.sectionSnapshots,
      (snapshot) => snapshot.publicPath === undefined
    )
  );
  const entrySection = entrySnapshot
    ? Option.getOrUndefined(
        Arr.findFirst(
          sections,
          (section) => section.sectionKey === entrySnapshot.sectionKey
        )
      )
    : undefined;
  const { current, entry } = yield* Effect.all(
    {
      current: loadAttemptState({
        appLocale,
        attempt,
        sections,
      }),
      entry: entrySection
        ? loadSectionState(attempt, entrySection, appLocale)
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
    content: entry.content,
    state: {
      attempt: current,
      runtime: entry.runtime,
    },
  };
});

/** Reads one mutable set state through an exact owned attempt ID. */
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
  const loaded = yield* loadSetAttemptState(attempt, args.locale);
  return loaded.state;
});
