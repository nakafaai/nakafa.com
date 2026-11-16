import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import {
  catalogNodeIdentity,
  readCatalogEntries,
} from "@repo/backend/confect/tryouts/catalog/rows";
import {
  readItemKey,
  readItemVersion,
  readPaper,
  readStimulus,
} from "@repo/backend/confect/tryouts/rows";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import {
  Array as Arr,
  Effect,
  HashMap,
  Option,
  Order,
  Result,
  Schema,
} from "effect";

type CatalogSet = Extract<CatalogRow, { kind: "set" }>;
type CatalogTrack = Extract<CatalogRow, { kind: "track" }>;

/** Fails when the active release names a featured part it does not publish. */
function missingFeatured(part: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `The active try-out publication has no featured ${part}.`
  );
}

/** Orders sets as the catalog lists them: by country, exam, group, track, then set. */
const CatalogPathOrder = Order.Struct({
  country: Order.Number,
  exam: Order.Number,
  group: Order.Number,
  track: Order.Number,
  set: Order.Number,
});

/**
 * Lists the sets of a locale's catalog in the order it shows them: by the authored order of the
 * country, exam, group, and track above each set, then the set's own.
 */
const sortCatalogSets = Effect.fn("tryouts.catalog.sortCatalogSets")(function* (
  rows: readonly CatalogRow[]
) {
  const orders = HashMap.fromIterable(
    Arr.map(rows, (row) => [catalogNodeIdentity(row), row.order] as const)
  );
  const orderOf = (keys: Parameters<typeof catalogNodeIdentity>[0]) =>
    Option.match(HashMap.get(orders, catalogNodeIdentity(keys)), {
      onNone: () => missingFeatured(keys.kind),
      onSome: Effect.succeed,
    });
  const sets = Arr.filter(rows, (row): row is CatalogSet => row.kind === "set");
  const placed = yield* Effect.forEach(sets, (set) =>
    Effect.gen(function* () {
      const { appLocale, countryKey, examKey, trackKey } = set;
      const exam = { appLocale, countryKey, examKey };
      const found = Arr.findFirst(
        rows,
        (row): row is CatalogTrack =>
          row.kind === "track" &&
          row.countryKey === countryKey &&
          row.examKey === examKey &&
          row.trackKey === trackKey
      );
      if (Option.isNone(found)) {
        return yield* missingFeatured("track");
      }
      const track = found.value;
      const path: typeof CatalogPathOrder extends Order.Order<infer A>
        ? A
        : never = {
        country: yield* orderOf({ appLocale, countryKey, kind: "country" }),
        exam: yield* orderOf({ ...exam, kind: "exam" }),
        group: yield* orderOf({
          ...exam,
          groupKey: track.groupKey,
          kind: "group",
        }),
        set: set.order,
        track: track.order,
      };
      return { path, set };
    })
  );
  return Arr.map(
    Arr.sortWith(placed, ({ path }) => path, CatalogPathOrder),
    ({ set }) => set
  );
});

/**
 * Reads the landing's demonstrated question from the active release in one app locale, so the
 * landing shows only a set the locale serves, in the locale's own language where one is written:
 * the first place of the first set the locale's catalog lists whose first place has a version in
 * that language, or else the first language of the first set's first place. It gives the prompt and
 * interaction of that version, the key's answer that the demonstration reveals, and the reading the
 * version was written against. A locale whose catalog serves no set demonstrates none.
 */
export const readFeaturedTryout = Effect.fn("tryouts.catalog.readFeatured")(
  function* (locale: AppLocaleCode) {
    const { snapshotId } = yield* loadActiveAssessment();
    const rows = Arr.map(
      yield* readCatalogEntries(snapshotId, locale),
      ({ row }) => row
    );
    const sets = yield* sortCatalogSets(rows);
    if (!Arr.isReadonlyArrayNonEmpty(sets)) {
      return { kind: "none" } as const;
    }
    // A paper and its sections are never empty, so every set has a first place.
    const firstPlace = (set: CatalogSet) =>
      Effect.map(
        readPaper(snapshotId, set.paper),
        ({ paper }) =>
          Arr.headNonEmpty(Arr.headNonEmpty(paper.sections).placements).versions
      );
    const own = yield* Effect.findFirstFilter(sets, (set) =>
      Effect.map(firstPlace(set), (versions) =>
        Result.fromOption(
          Arr.findFirst(versions, ({ language }) => language === locale),
          () => set
        )
      )
    );
    const place = Option.isSome(own)
      ? own.value
      : Arr.headNonEmpty(yield* firstPlace(Arr.headNonEmpty(sets)));
    const [version, key] = yield* Effect.all([
      readItemVersion(place.hash),
      readItemKey(place.hash),
    ]);
    const interaction = Arr.headNonEmpty(version.interactions);
    const answer = Arr.findFirst(
      key.answers,
      (candidate) => candidate.interaction === interaction.id
    );
    if (Option.isNone(answer)) {
      return yield* missingFeatured("answer");
    }
    const stimulus =
      version.stimulus === undefined
        ? Option.none()
        : Option.some((yield* readStimulus(version.stimulus.hash)).document);
    const body = yield* Schema.encodeEffect(TryoutQuestionBodyText)({
      interaction,
      key: answer.value,
      prompt: version.prompt,
      ...(Option.isSome(stimulus) ? { stimulus: stimulus.value } : {}),
    }).pipe(
      // Every part was decoded by the contract, so it encodes.
      Effect.orDie
    );
    return { body, kind: "question", versionHash: version.hash } as const;
  }
);
