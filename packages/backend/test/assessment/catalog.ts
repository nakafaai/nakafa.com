import {
  type CatalogRow,
  CatalogRowSchema,
  SetLevelSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Schema } from "effect";

/** One localized set row of a catalog. */
type CatalogSet = Extract<CatalogRow, { readonly kind: "set" }>;

/** The locales the fixture catalog serves, in contract order. */
const FIXTURE_APP_LOCALES = ["en", "id", "de"] as const;

/** The source revision of every fixture catalog row: an authored date, as the contract keeps a catalog revision. */
export const FIXTURE_REVISION = "2026-10-02";

/** The keys of the fixture track, which every fixture set belongs to. */
export const FIXTURE_TRACK = {
  countryKey: "indonesia",
  examKey: "snbt",
  trackKey: "2027",
};

/** The learning-graph identity of one fixture node in one app locale, owned by the try-out family. */
const graph = (appLocale: AppLocaleCode, name: string) => ({
  alignmentId: `alignment:tryout:${name}`,
  assetId: `asset:${appLocale}:tryout:${name}`,
  conceptId: `concept:tryout:${name}`,
  learningObjectId: `lo:tryout:${name}`,
  lensId: `lens:tryout:${name}`,
});

/** The route of one fixture set in one app locale. */
export function fixtureSetPath(
  setKey: string,
  appLocale: AppLocaleCode,
  renamed = false
) {
  return `try-out/indonesia/snbt/2027/utbk/${setKey}${renamed ? "-renamed" : ""}-${appLocale}`;
}

/** The fixture exam's one group, the year its track belongs to. */
const FIXTURE_GROUP_KEY = "2027";

/** The catalog of one app locale: the country, the exam, its group, the track, and each set with its sections. */
export function makeCatalog(
  appLocale: AppLocaleCode,
  track: {
    readonly entry: boolean;
    readonly paired: boolean;
    readonly renamed: boolean;
    readonly sections: readonly string[];
    readonly sets: readonly Pick<CatalogSet, "paper" | "setKey">[];
  }
): CatalogRow[] {
  const base = {
    appLocale,
    // The fixture's sets are not written in Malay, so no node of its catalog serves it.
    appLocales: FIXTURE_APP_LOCALES,
    // Aksara writes the commit of the source tree, which the web links to.
    sourceRevision: FIXTURE_REVISION,
    title: "Try-out",
  };
  return Arr.map(
    [
      {
        ...base,
        countryCode: "ID",
        countryKey: FIXTURE_TRACK.countryKey,
        description: "Try-out Indonesia",
        graph: graph(appLocale, "country"),
        kind: "country",
        order: 1,
        publicPath: `try-out/indonesia-${appLocale}`,
      },
      {
        ...base,
        countryKey: FIXTURE_TRACK.countryKey,
        examKey: FIXTURE_TRACK.examKey,
        graph: graph(appLocale, "exam"),
        groupAxis: "year",
        kind: "exam",
        order: 1,
        publicPath: `try-out/indonesia/snbt-${appLocale}`,
      },
      {
        ...base,
        countryKey: FIXTURE_TRACK.countryKey,
        examKey: FIXTURE_TRACK.examKey,
        graph: graph(appLocale, "group"),
        groupKey: FIXTURE_GROUP_KEY,
        kind: "group",
        order: 1,
        publicPath: `try-out/indonesia/snbt/2027-${appLocale}`,
      },
      {
        ...base,
        ...FIXTURE_TRACK,
        graph: graph(appLocale, "track"),
        groupKey: FIXTURE_GROUP_KEY,
        kind: "track",
        order: 1,
        publicPath: `try-out/indonesia/snbt/2027/utbk-${appLocale}`,
      },
      ...(track.paired
        ? [
            {
              ...base,
              ...FIXTURE_TRACK,
              graph: graph(appLocale, "paired-track"),
              groupKey: FIXTURE_GROUP_KEY,
              kind: "track",
              order: 2,
              publicPath: `try-out/indonesia/snbt/2027/paired-${appLocale}`,
              trackKey: "paired",
            },
          ]
        : []),
      ...Arr.flatMap(track.sets, (set, setIndex) => {
        const setPath = fixtureSetPath(set.setKey, appLocale, track.renamed);
        const keys = { ...FIXTURE_TRACK, setKey: set.setKey };
        return [
          {
            ...base,
            ...keys,
            graph: graph(appLocale, set.setKey),
            ...(track.entry
              ? { internalEntrySectionKey: track.sections[0] }
              : {}),
            kind: "set",
            level: Arr.getUnsafe(
              SetLevelSchema.literals,
              setIndex % SetLevelSchema.literals.length
            ),
            order: setIndex + 1,
            paper: set.paper,
            publicPath: setPath,
          },
          ...Arr.map(track.sections, (sectionKey, index) => ({
            ...base,
            ...keys,
            graph: graph(appLocale, `${set.setKey}-${sectionKey}`),
            kind: "section",
            order: index + 1,
            ...(track.entry
              ? { visibility: "internal-entry" }
              : {
                  publicPath: `${setPath}/${sectionKey}`,
                  visibility: "visible",
                }),
            sectionKey,
          })),
        ];
      }),
    ],
    (row) => Schema.decodeUnknownSync(CatalogRowSchema)(row)
  );
}
