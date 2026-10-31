import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  readCatalogRow,
  readCatalogSet,
} from "@repo/backend/confect/tryouts/catalog/rows";
import type { TryoutSection } from "@repo/backend/confect/tryouts/runtime/schema";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Finds a localized route of an attempt inside the snapshot it started from: its set's, or one of its
 * sections'. The attempt's own locale answers from its frozen routes; another locale reads the set's
 * catalog rows in that locale, and a set the snapshot does not publish in it has no route there.
 */
export const readAttemptDestination = Effect.fn(
  "tryouts.attempt.readDestination"
)(function* (
  attempt: Docs["tryoutAttempts"],
  locale: AppLocaleCode,
  sectionKey?: string
) {
  if (locale === attempt.appLocale) {
    return sectionKey === undefined
      ? attempt.setPublicPath
      : publicPathOf(attempt.sections, sectionKey);
  }
  const found = yield* readCatalogSet(
    attempt.assessmentSnapshotId,
    attempt.setIdentity,
    locale
  );
  if (Option.isNone(found)) {
    return null;
  }
  const { sections, set } = found.value;
  return sectionKey === undefined
    ? set.publicPath
    : publicPathOf(sections, sectionKey);
});

/** The route of the section with a key, none when no section has it or the section shows no page. */
function publicPathOf(
  sections: readonly Pick<TryoutSection, "publicPath" | "sectionKey">[],
  sectionKey: string
) {
  return Option.getOrNull(
    Option.flatMap(
      Arr.findFirst(sections, (section) => section.sectionKey === sectionKey),
      (section) => Option.fromUndefinedOr(section.publicPath)
    )
  );
}

/**
 * Matches a public path to one frozen section of an attempt: the frozen route itself, or the route of
 * the same section of the same set in another locale of the attempt's snapshot. Any other path, or a
 * path the snapshot does not hold, matches none.
 */
export const readAttemptSectionForPath = Effect.fn(
  "tryouts.attempt.readSectionForPath"
)(function* (
  attempt: Docs["tryoutAttempts"],
  locale: AppLocaleCode,
  publicPath: string
) {
  const frozen = Arr.findFirst(
    attempt.sections,
    (section) => section.publicPath === publicPath
  );
  if (Option.isSome(frozen)) {
    return frozen.value;
  }
  const row = yield* readCatalogRow(
    attempt.assessmentSnapshotId,
    locale,
    publicPath
  );
  if (
    Option.isNone(row) ||
    row.value.kind !== "section" ||
    row.value.countryKey !== attempt.countryKey ||
    row.value.examKey !== attempt.examKey ||
    row.value.trackKey !== attempt.trackKey ||
    row.value.setKey !== attempt.setKey
  ) {
    return null;
  }
  const { sectionKey } = row.value;
  return Option.getOrNull(
    Arr.findFirst(
      attempt.sections,
      (section) => section.sectionKey === sectionKey
    )
  );
});
