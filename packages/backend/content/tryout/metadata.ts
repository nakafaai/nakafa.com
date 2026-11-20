import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import type { CatalogNodeKeys } from "@repo/backend/confect/tryouts/catalog/rows";
import {
  readCatalogNode,
  readCatalogRow,
} from "@repo/backend/confect/tryouts/catalog/rows";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import {
  indexPublishedCatalog,
  isPublishedLanding,
} from "@repo/backend/content/tryout/hierarchy";
import type {
  tryoutLocalizedPathArgsValidator,
  tryoutMetadataArgsValidator,
} from "@repo/backend/content/tryout/spec";
import type { Schema } from "effect";
import { Array as Arr, Effect, Match, Option, String as Str } from "effect";

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
    ...(row.kind === "group" ? { groupKey: row.groupKey } : {}),
    ...("trackKey" in row ? { trackKey: row.trackKey } : {}),
    ...("setKey" in row ? { setKey: row.setKey } : {}),
    ...("sectionKey" in row ? { sectionKey: row.sectionKey } : {}),
  };
}

/**
 * Whether a link lands on a route's own page, as the sitemap lists pages: an exam never, since a link to it opens
 * its entry; a group only when it is its own entry (`isPublishedLanding`); every other route always. The
 * breadcrumb names only these, so a crumb never leads to an address that is no page.
 */
const readRoutePage = Effect.fn("tryouts.catalog.readRoutePage")(function* (
  appLocale: AppLocaleCode,
  row: CatalogRow
) {
  if (row.kind === "exam") {
    return false;
  }
  if (row.kind !== "group") {
    return true;
  }
  const index = yield* indexPublishedCatalog(
    yield* loadTryoutCatalog(appLocale)
  );
  return isPublishedLanding(index, row);
});

/** Reads the public path of a row's node in another app locale, none when that locale has no page for it. */
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
    if (Option.isNone(alternate)) {
      return Option.none();
    }
    // An address that lands on no page of its own, such as a group with one track, is no
    // counterpart: a search engine's alternate must be an indexable page.
    if (!(yield* readRoutePage(appLocale, alternate.value))) {
      return Option.none();
    }
    return Option.map(
      Option.fromUndefinedOr(alternate.value.publicPath),
      (publicPath) => ({ appLocale, publicPath })
    );
  }
);

/**
 * Reads one public route of the active release with its localized counterparts, none when no row of
 * the asked kind holds the path.
 */
export const readTryoutMetadata = Effect.fn("tryouts.catalog.readMetadata")(
  function* (input: TryoutMetadataInput) {
    const { snapshotId } = yield* loadActiveAssessment();
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
    // A node is published only in the locales its row names, as a try-out set
    // is served only in the locales it is explained in.
    const alternates = Arr.getSomes(
      yield* Effect.forEach(row.appLocales, (locale) =>
        readAlternate(snapshotId, row, locale)
      )
    );
    return {
      route: {
        alternates,
        ...(row.description === undefined
          ? {}
          : { description: row.description }),
        page: yield* readRoutePage(input.appLocale, row),
        publicPath: input.publicPath,
        // An exam and its groups share the exam's artwork.
        socialImageIdentity:
          row.kind === "exam" || row.kind === "group"
            ? { countryKey: row.countryKey, examKey: row.examKey }
            : null,
        title: row.title,
      },
    };
  }
);

/**
 * The keys of the page above a row that a reader can land on: a section's set,
 * a set's track, a track's group, and a group's country. An exam has no page of
 * its own, and a country has the try-out hub above it.
 */
function pageAbove(row: CatalogRow): Option.Option<CatalogNodeKeys> {
  const base = { appLocale: row.appLocale, countryKey: row.countryKey };
  return Match.value(row).pipe(
    Match.discriminatorsExhaustive("kind")({
      country: () => Option.none(),
      exam: () => Option.some({ ...base, kind: "country" as const }),
      group: () => Option.some({ ...base, kind: "country" as const }),
      section: ({ examKey, setKey, trackKey }) =>
        Option.some({
          ...base,
          examKey,
          kind: "set" as const,
          setKey,
          trackKey,
        }),
      set: ({ examKey, trackKey }) =>
        Option.some({ ...base, examKey, kind: "track" as const, trackKey }),
      track: ({ examKey, groupKey }) =>
        Option.some({ ...base, examKey, groupKey, kind: "group" as const }),
    })
  );
}

/**
 * Resolves one public route of the active release to its public path in another
 * app locale. A node that locale does not serve, such as a try-out set not
 * written in Malay, leads to the nearest page above it that the locale serves,
 * and to the try-out hub when none does; nothing falls back to another language.
 */
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
  const hub = Arr.headNonEmpty(Str.split(input.publicPath, "/"));
  let node: Option.Option<CatalogRow> = current;
  while (Option.isSome(node)) {
    const alternate: Effect.Success<ReturnType<typeof readAlternate>> =
      yield* readAlternate(snapshotId, node.value, input.targetAppLocale);
    if (Option.isSome(alternate)) {
      return alternate.value.publicPath;
    }
    const above = pageAbove(node.value);
    node = Option.isNone(above)
      ? Option.none()
      : yield* readCatalogNode(snapshotId, above.value);
  }
  return hub;
});
