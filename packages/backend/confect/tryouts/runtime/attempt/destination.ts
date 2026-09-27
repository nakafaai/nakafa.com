import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import {
  readTryoutCatalogRowByIdentity,
  readTryoutCatalogRowByPath,
} from "@repo/backend/content/tryout/row";
import { Effect } from "effect";

/** Finds a localized route inside the attempt's own retained snapshot. */
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
      : (attempt.sectionSnapshots.find(
          (section) => section.sectionKey === sectionKey
        )?.publicPath ?? null);
  }
  const identity = {
    appLocale: AppLocaleSchema.make(locale),
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  };
  const row = yield* readTryoutCatalogRowByIdentity(
    attempt.tryoutSnapshotId,
    tryoutCatalogNodeIdentity(
      sectionKey === undefined
        ? { ...identity, kind: "set" }
        : { ...identity, kind: "section", sectionKey }
    )
  ).pipe(Effect.provide(tryoutLayer));
  return row?.publicPath ?? null;
});

/** Matches either the frozen route or its verified localized sibling to one section. */
export const readAttemptSectionForPath = Effect.fn(
  "tryouts.attempt.readSectionForPath"
)(function* (
  attempt: Docs["tryoutAttempts"],
  locale: AppLocaleCode,
  publicPath: string
) {
  const frozen = attempt.sectionSnapshots.find(
    (section) => section.publicPath === publicPath
  );
  if (frozen) {
    return frozen;
  }
  const row = yield* readTryoutCatalogRowByPath(attempt.tryoutSnapshotId, {
    appLocale: locale,
    publicPath,
  }).pipe(Effect.provide(tryoutLayer));
  if (
    row?.kind !== "section" ||
    row.countryKey !== attempt.countryKey ||
    row.examKey !== attempt.examKey ||
    row.trackKey !== attempt.trackKey ||
    row.setKey !== attempt.setKey
  ) {
    return null;
  }
  return (
    attempt.sectionSnapshots.find(
      (section) => section.sectionKey === row.sectionKey
    ) ?? null
  );
});
