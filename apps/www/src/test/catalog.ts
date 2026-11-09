import { GroupAxisSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** One signed route identity, with the public path that each locale serves for it. */
export type RouteIdentity = Partial<Record<AppLocaleCode, string>>;

/** One signed exam in one locale: its axis and its groups in order. */
const ExamFixtureSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  groupAxis: GroupAxisSchema,
  groups: Schema.Array(
    Schema.Struct({ groupKey: Schema.String, publicPath: Schema.String })
  ),
  publicPath: Schema.String,
});
export type ExamFixture = typeof ExamFixtureSchema.Type;

/** One signed country in one locale: its entry, where a link to it lands. */
const CountryFixtureSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  entryPath: Schema.String,
  publicPath: Schema.String,
});
export type CountryFixture = typeof CountryFixtureSchema.Type;

/** One signed group in one locale: its tracks in order. */
const GroupFixtureSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  publicPath: Schema.String,
  tracks: Schema.Array(
    Schema.Struct({ publicPath: Schema.String, trackKey: Schema.String })
  ),
});
export type GroupFixture = typeof GroupFixtureSchema.Type;

/** One visible section page in one locale. */
const SectionFixtureSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  publicPath: Schema.String,
});
export type SectionFixture = typeof SectionFixtureSchema.Type;

/** The catalog reads that the routing rules call, each a test double; a rule that reads no country needs no country double. */
type CatalogMocks = Record<
  "exam" | "group" | "path" | "section",
  ReturnType<typeof vi.fn>
> & { readonly country?: ReturnType<typeof vi.fn> };

/** Finds the row a read asks for: its locale and its path. */
function findRow<Row extends { appLocale: AppLocaleCode; publicPath: string }>(
  rows: readonly Row[],
  { appLocale, publicPath }: { appLocale: AppLocaleCode; publicPath: string }
) {
  return Arr.findFirst(
    rows,
    (row) => row.appLocale === appLocale && row.publicPath === publicPath
  );
}

/**
 * Serves exactly the signed routes, exams, groups, and visible sections of one
 * catalog through the reads that the routing rules make.
 */
export function serveTryoutCatalog(
  mocks: CatalogMocks,
  fixture: {
    readonly countries?: readonly CountryFixture[];
    readonly exams?: readonly ExamFixture[];
    readonly groups?: readonly GroupFixture[];
    readonly routes?: readonly RouteIdentity[];
    readonly sections?: readonly SectionFixture[];
  }
) {
  const { countries, exams, groups, routes, sections } = {
    countries: [],
    exams: [],
    groups: [],
    routes: [],
    sections: [],
    ...fixture,
  };
  mocks.path.mockImplementation(
    (input: {
      currentAppLocale: AppLocaleCode;
      publicPath: string;
      targetAppLocale: AppLocaleCode;
    }) =>
      Effect.succeed(
        Option.getOrNull(
          Option.flatMap(
            Arr.findFirst(
              routes,
              (route) => route[input.currentAppLocale] === input.publicPath
            ),
            (route) => Option.fromNullishOr(route[input.targetAppLocale])
          )
        )
      )
  );
  // A group enters at its one track's table, or at its own page of track cards, as the catalog's depth rule does.
  const entryOf = (
    appLocale: AppLocaleCode,
    group: ExamFixture["groups"][number]
  ) =>
    Option.match(findRow(groups, { appLocale, publicPath: group.publicPath }), {
      onNone: () => group.publicPath,
      onSome: ({ tracks }) =>
        tracks.length === 1 && tracks[0] !== undefined
          ? tracks[0].publicPath
          : group.publicPath,
    });
  mocks.country?.mockImplementation(
    (input: { appLocale: AppLocaleCode; publicPath: string }) =>
      Effect.succeed(
        Option.getOrNull(
          Option.map(findRow(countries, input), (country) => ({
            entryPath: country.entryPath,
          }))
        )
      )
  );
  mocks.exam.mockImplementation(
    (input: { appLocale: AppLocaleCode; publicPath: string }) =>
      Effect.succeed(
        Option.getOrNull(
          Option.map(findRow(exams, input), (exam) => ({
            exam: { groupAxis: exam.groupAxis },
            groups: Arr.map(exam.groups, (group) => ({
              ...group,
              entryPath: entryOf(input.appLocale, group),
            })),
          }))
        )
      )
  );
  mocks.group.mockImplementation(
    (input: { appLocale: AppLocaleCode; publicPath: string }) =>
      Effect.succeed(
        Option.getOrNull(
          Option.map(findRow(groups, input), (group) => ({
            tracks: group.tracks,
          }))
        )
      )
  );
  mocks.section.mockImplementation(
    (input: { appLocale: AppLocaleCode; publicPath: string }) =>
      Effect.succeed(
        Option.isSome(findRow(sections, input))
          ? { publicPath: input.publicPath }
          : null
      )
  );
}
