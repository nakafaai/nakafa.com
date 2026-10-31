import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { decodeAs } from "@repo/backend/confect/tryouts/rows";
import { Array as Arr, Effect, Option, Schema } from "effect";

type CatalogSet = Extract<CatalogRow, { kind: "set" }>;

/**
 * The keys that name one catalog node in one app locale: its kind and the keys of its node and of
 * every node above it. A country has only its country key, and each lower kind adds its own.
 */
export const CatalogNodeKeys = Schema.Struct({
  appLocale: Schema.String,
  countryKey: Schema.String,
  examKey: Schema.optionalKey(Schema.String),
  kind: Schema.Literals(["country", "exam", "track", "set", "section"]),
  sectionKey: Schema.optionalKey(Schema.String),
  setKey: Schema.optionalKey(Schema.String),
  trackKey: Schema.optionalKey(Schema.String),
});
export type CatalogNodeKeys = typeof CatalogNodeKeys.Type;

/**
 * The identity of a catalog node in a snapshot, as the contract's `catalogRowIdentity` writes it
 * for a whole row, from the keys alone, so a parent or a sibling in another locale is read without
 * holding its row. Its test pins it to the contract's function for every kind.
 */
export function catalogNodeIdentity(keys: CatalogNodeKeys) {
  return Arr.join(
    [
      keys.appLocale,
      keys.kind,
      keys.countryKey,
      keys.examKey ?? "",
      keys.trackKey ?? "",
      keys.setKey ?? "",
      keys.sectionKey ?? "",
    ],
    "\0"
  );
}

/**
 * One stored catalog row with the hash and position the snapshot gave it, which a search document
 * keeps as its content hash and its sync order.
 */
const entryOf = Effect.fn("tryouts.catalog.entryOf")(function* (
  stored: Docs["assessmentRows"]
) {
  const { row } = yield* decodeAs("catalog", Option.some(stored));
  return { index: stored.index, row, rowHash: stored.rowHash };
});

/**
 * Reads every stored catalog row of a snapshot in one app locale: the countries, exams, tracks, sets,
 * and sections the try-out pages navigate, a few hundred rows at most.
 */
export const readCatalogEntries = Effect.fn(
  "tryouts.catalog.readCatalogEntries"
)(function* (snapshotId: string, appLocale: AppLocaleCode) {
  const stored = yield* (yield* DatabaseReader)
    .table("assessmentRows")
    .index("by_snapshotId_and_appLocale_and_publicPath", (index) =>
      index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
    )
    .collect()
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
  return yield* Effect.forEach(stored, entryOf);
});

/** Reads the stored catalog row at one public path of a snapshot in one app locale, none when no row holds it. */
export const readCatalogEntry = Effect.fn("tryouts.catalog.readCatalogEntry")(
  function* (snapshotId: string, appLocale: AppLocaleCode, publicPath: string) {
    const stored = yield* (yield* DatabaseReader)
      .table("assessmentRows")
      .index("by_snapshotId_and_appLocale_and_publicPath", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("appLocale", appLocale)
          .eq("publicPath", publicPath)
      )
      .first()
      .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
    if (Option.isNone(stored)) {
      return Option.none();
    }
    return Option.some(yield* entryOf(stored.value));
  }
);

/** Reads the catalog row at one public path of a snapshot in one app locale, none when no row holds it. */
export const readCatalogRow = Effect.fn("tryouts.catalog.readCatalogRow")(
  function* (snapshotId: string, appLocale: AppLocaleCode, publicPath: string) {
    return Option.map(
      yield* readCatalogEntry(snapshotId, appLocale, publicPath),
      ({ row }) => row
    );
  }
);

/**
 * Reads one catalog node of a snapshot by its keys, as the row of its kind, none when the snapshot
 * holds no such node. The identity names the kind, so a stored row of the kind is the row asked for.
 */
export const readCatalogNode = Effect.fn("tryouts.catalog.readCatalogNode")(
  function* <K extends CatalogNodeKeys["kind"]>(
    snapshotId: string,
    keys: CatalogNodeKeys & { readonly kind: K }
  ) {
    const stored = yield* (yield* DatabaseReader)
      .table("assessmentRows")
      .index("by_snapshotId_and_kind_and_identity", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("kind", "catalog")
          .eq("identity", catalogNodeIdentity(keys))
      )
      .first()
      .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
    if (Option.isNone(stored)) {
      return Option.none<Extract<CatalogRow, { kind: K }>>();
    }
    const { row } = yield* decodeAs("catalog", stored);
    return Option.liftPredicate(
      row,
      (candidate): candidate is Extract<CatalogRow, { kind: K }> =>
        candidate.kind === keys.kind
    );
  }
);

/** Reads the stored catalog rows of a snapshot in one app locale that carry one graph asset, at most two so a collision shows. */
export const readCatalogByAsset = Effect.fn(
  "tryouts.catalog.readCatalogByAsset"
)(function* (snapshotId: string, appLocale: AppLocaleCode, assetId: string) {
  const stored = yield* (yield* DatabaseReader)
    .table("assessmentRows")
    .index("by_snapshotId_and_appLocale_and_assetId", (index) =>
      index
        .eq("snapshotId", snapshotId)
        .eq("appLocale", appLocale)
        .eq("assetId", assetId)
    )
    .take(2)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
  return yield* Effect.forEach(stored, entryOf);
});

/**
 * Reads one set of a snapshot in one app locale with its sections in order, none when the snapshot
 * publishes no such set in that locale. `setIdentity` is the set's locale-free keys
 * (`country/exam/track/set`), which every catalog row of the set carries.
 */
export const readCatalogSet = Effect.fn("tryouts.catalog.readCatalogSet")(
  function* (
    snapshotId: string,
    setIdentity: string,
    appLocale: AppLocaleCode
  ) {
    const stored = yield* (yield* DatabaseReader)
      .table("assessmentRows")
      .index("by_snapshotId_and_setIdentity_and_appLocale_and_order", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("setIdentity", setIdentity)
          .eq("appLocale", appLocale)
      )
      .collect()
      .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
    const rows = yield* Effect.forEach(stored, (row) =>
      Effect.map(decodeAs("catalog", Option.some(row)), ({ row }) => row)
    );
    return Option.map(
      Arr.findFirst(rows, (row): row is CatalogSet => row.kind === "set"),
      (set) => ({
        sections: Arr.flatMap(rows, (row) =>
          row.kind === "section" ? [row] : []
        ),
        set,
      })
    );
  }
);
