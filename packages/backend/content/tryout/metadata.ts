import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import {
  type CatalogNodeKeys,
  readCatalogNode,
  readCatalogRow,
} from "@repo/backend/confect/tryouts/catalog/rows";
import type {
  tryoutLocalizedPathArgsValidator,
  tryoutMetadataArgsValidator,
} from "@repo/backend/content/tryout/spec";
import { Array as Arr, Effect, Option, type Schema } from "effect";

type TryoutMetadataInput = Schema.Struct.Type<
  typeof tryoutMetadataArgsValidator
>;
type TryoutLocalizedPathInput = Schema.Struct.Type<
  typeof tryoutLocalizedPathArgsValidator
>;

/** The keys of a catalog row's node, which name the same node in another app locale. */
function keysOf(row: CatalogRow, appLocale: AppLocaleCode): CatalogNodeKeys {
  return {
    appLocale,
    countryKey: row.countryKey,
    kind: row.kind,
    ...("examKey" in row ? { examKey: row.examKey } : {}),
    ...("trackKey" in row ? { trackKey: row.trackKey } : {}),
    ...("setKey" in row ? { setKey: row.setKey } : {}),
    ...("sectionKey" in row ? { sectionKey: row.sectionKey } : {}),
  };
}

/** Reads the public path of a row's node in another app locale, none when that locale has no route for it. */
const readAlternate = Effect.fn("tryouts.catalog.readMetadataAlternate")(
  function* (
    snapshotId: string,
    current: CatalogRow,
    appLocale: AppLocaleCode
  ) {
    const alternate = yield* readCatalogNode(
      snapshotId,
      keysOf(current, appLocale)
    );
    return Option.flatMap(alternate, (row) =>
      Option.map(Option.fromUndefinedOr(row.publicPath), (publicPath) => ({
        appLocale,
        publicPath,
      }))
    );
  }
);

/**
 * Reads one public route of the active release with its localized counterparts, none when no row of
 * the asked kind holds the path.
 */
export const readTryoutMetadata = Effect.fn("tryouts.catalog.readMetadata")(
  function* (input: TryoutMetadataInput) {
    const { activeAppLocales, snapshotId } = yield* loadActiveAssessment();
    const current = yield* readCatalogRow(
      snapshotId,
      input.appLocale,
      input.publicPath
    );
    if (
      Option.isNone(current) ||
      current.value.kind !== input.kind ||
      current.value.publicPath === undefined
    ) {
      return { route: null };
    }
    const row = current.value;
    const alternates = Arr.getSomes(
      yield* Effect.forEach(activeAppLocales, (locale) =>
        readAlternate(snapshotId, row, locale)
      )
    );
    return {
      route: {
        alternates,
        ...(row.description === undefined
          ? {}
          : { description: row.description }),
        publicPath: input.publicPath,
        socialImageIdentity:
          row.kind === "exam"
            ? { countryKey: row.countryKey, examKey: row.examKey }
            : null,
        title: row.title,
      },
    };
  }
);

/** Resolves one public route of the active release to its public path in another app locale. */
export const readTryoutLocalizedPath = Effect.fn(
  "tryouts.catalog.readLocalizedPath"
)(function* (input: TryoutLocalizedPathInput) {
  const { snapshotId } = yield* loadActiveAssessment();
  const current = yield* readCatalogRow(
    snapshotId,
    input.currentAppLocale,
    input.publicPath
  );
  if (Option.isNone(current)) {
    return null;
  }
  const alternate = yield* readAlternate(
    snapshotId,
    current.value,
    input.targetAppLocale
  );
  return Option.getOrNull(
    Option.map(alternate, ({ publicPath }) => publicPath)
  );
});
