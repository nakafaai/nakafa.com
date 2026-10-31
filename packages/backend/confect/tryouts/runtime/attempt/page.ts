import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  readPublishedSectionPage,
  readPublishedSetPage,
} from "@repo/backend/content/tryout/published";
import { readTryoutSetSelection } from "@repo/backend/content/tryout/selection";
import { Effect } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];

/**
 * Reads the set-local catalog that holds one route of an attempt's set, in one locale, from the
 * snapshot the attempt started from, so a later release never changes a retained attempt's pages.
 * The caller resolved the route from that snapshot (`readAttemptDestination`).
 */
const readAttemptSelection = Effect.fn("tryouts.attempt.readSelection")(
  function* (
    attempt: TryoutAttempt,
    locale: AppLocaleCode,
    publicPath: string
  ) {
    return yield* Effect.fromNullishOr(
      yield* readTryoutSetSelection({
        appLocale: locale,
        publicPath,
        snapshotId: attempt.assessmentSnapshotId,
      })
    ).pipe(
      // The route was read from this snapshot's own catalog.
      Effect.orDie
    );
  }
);

/** Reads one set page of an attempt, at its set's route in one locale, from the snapshot it started from. */
export const readAttemptSetPage = Effect.fn("tryouts.attempt.readSetPage")(
  function* (attempt: TryoutAttempt, locale: AppLocaleCode, setPath: string) {
    const selection = yield* readAttemptSelection(attempt, locale, setPath);
    return yield* Effect.fromNullishOr(
      yield* readPublishedSetPage(selection)
    ).pipe(
      // The selection was read through this set's own route.
      Effect.orDie
    );
  }
);

/**
 * Reads one section page of an attempt, at its section's route in one locale, from the snapshot it
 * started from.
 */
export const readAttemptSectionPage = Effect.fn(
  "tryouts.attempt.readSectionPage"
)(function* (
  attempt: TryoutAttempt,
  locale: AppLocaleCode,
  sectionPath: string
) {
  const selection = yield* readAttemptSelection(attempt, locale, sectionPath);
  return yield* Effect.fromNullishOr(
    yield* readPublishedSectionPage(selection)
  ).pipe(
    // The selection was read through this section's own route.
    Effect.orDie
  );
});
