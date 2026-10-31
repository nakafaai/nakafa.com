import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  readCatalogNode,
  readCatalogRow,
  readCatalogSet,
} from "@repo/backend/confect/tryouts/catalog/rows";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import { Effect, Option } from "effect";

/** Rejects a set-local catalog that lost a row its set needs. */
function selectionIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}

/**
 * Reads the set-local catalog a set or section page needs: the row at the path, the set it is or
 * belongs to, the set's sections in their authored order, and its track and exam, without reading the
 * rest of the locale. A set without its country, exam, or track is a broken snapshot. A path that
 * names no set or section has none.
 */
export const readTryoutSetSelection = Effect.fn(
  "tryouts.catalog.readSetSelection"
)(function* (input: {
  readonly appLocale: AppLocaleCode;
  readonly publicPath: string;
  readonly snapshotId: string;
}) {
  const selected = yield* readCatalogRow(
    input.snapshotId,
    input.appLocale,
    input.publicPath
  );
  if (
    Option.isNone(selected) ||
    (selected.value.kind !== "set" && selected.value.kind !== "section")
  ) {
    return null;
  }
  const keys = selected.value;
  const found = yield* readCatalogSet(
    input.snapshotId,
    tryoutSetIdentityOf(keys),
    input.appLocale
  );
  if (Option.isNone(found)) {
    return yield* selectionIntegrity("A try-out section lost its set.");
  }
  const { sections, set } = found.value;
  const [country, exam, track] = yield* Effect.all(
    [
      readCatalogNode(input.snapshotId, {
        appLocale: input.appLocale,
        countryKey: keys.countryKey,
        kind: "country",
      }),
      readCatalogNode(input.snapshotId, {
        appLocale: input.appLocale,
        countryKey: keys.countryKey,
        examKey: keys.examKey,
        kind: "exam",
      }),
      readCatalogNode(input.snapshotId, {
        appLocale: input.appLocale,
        countryKey: keys.countryKey,
        examKey: keys.examKey,
        kind: "track",
        trackKey: keys.trackKey,
      }),
    ],
    { concurrency: "unbounded" }
  );
  if (Option.isNone(country)) {
    return yield* selectionIntegrity("A try-out set lost its country.");
  }
  if (Option.isNone(exam)) {
    return yield* selectionIntegrity("A try-out set lost its exam.");
  }
  if (Option.isNone(track)) {
    return yield* selectionIntegrity("A try-out set lost its track.");
  }
  return {
    exam: exam.value,
    row: keys,
    sections,
    set,
    snapshotId: input.snapshotId,
    track: track.value,
  };
});

/** The set-local catalog of one set or section route. */
export type TryoutSetSelection = NonNullable<
  Effect.Success<ReturnType<typeof readTryoutSetSelection>>
>;
