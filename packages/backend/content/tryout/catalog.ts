import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  findActiveAssessment,
  loadActiveAssessment,
} from "@repo/backend/confect/tryouts/active";
import { readCatalogEntries } from "@repo/backend/confect/tryouts/catalog/rows";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Loads the catalog of one app locale of an assessment snapshot, as the try-out pages navigate it:
 * its rows, and each stored row with the hash and position a search document keeps.
 */
const loadSnapshotCatalog = Effect.fn("tryout.catalog.loadSnapshot")(function* (
  snapshotId: string,
  locale: AppLocaleCode
) {
  const entries = yield* readCatalogEntries(snapshotId, locale);
  return { entries, rows: Arr.map(entries, ({ row }) => row), snapshotId };
});

/** The catalog of one app locale of one assessment snapshot. */
export type PublishedCatalog = Effect.Success<
  ReturnType<typeof loadSnapshotCatalog>
>;

/** Finds the catalog of one app locale of the active release, none before any release activates one. */
export const findTryoutCatalog = Effect.fn("tryout.catalog.find")(function* (
  locale: AppLocaleCode
) {
  const active = yield* findActiveAssessment();
  if (Option.isNone(active)) {
    return Option.none();
  }
  return Option.some(
    yield* loadSnapshotCatalog(active.value.snapshotId, locale)
  );
});

/** Loads the catalog of one app locale of the active release. */
export const loadTryoutCatalog = Effect.fn("tryout.catalog.load")(function* (
  locale: AppLocaleCode
) {
  const { snapshotId } = yield* loadActiveAssessment();
  return yield* loadSnapshotCatalog(snapshotId, locale);
});
