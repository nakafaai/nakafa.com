import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import { LANDING_FEATURED_TRYOUT } from "@repo/backend/content/tryout/featured";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { Array as Arr, Effect, Match, Schema } from "effect";

const LANDING_SET_PATH = "try-out/indonesia/snbt/2027/set-1";
const LANDING_SOURCE_ROOT =
  "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1";
const LANDING_QUESTION_BANK_ROOT =
  "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1";
const LANDING_QUESTION_ROOT = `${LANDING_QUESTION_BANK_ROOT}/question-1`;
const LANDING_QUESTION_SOURCE_ROOT = `${LANDING_SOURCE_ROOT}/question-1`;
/** Questions in the landing section of the real SNBT set 1. */
const LANDING_QUESTION_COUNT = 20;
/** Sections of the real SNBT set 1 besides the landing one, with their sizes. */
const OTHER_SNBT_SECTIONS = [
  { questionCount: 30, sectionKey: "general-reasoning" },
  { questionCount: 30, sectionKey: "literacy-in-indonesian" },
  { questionCount: 20, sectionKey: "literacy-in-english" },
  { questionCount: 20, sectionKey: "mathematical-reasoning" },
  { questionCount: 20, sectionKey: "reading-comprehension-and-writing" },
  { questionCount: 20, sectionKey: "general-knowledge-and-understanding" },
] as const;

/** Activates the stable landing hierarchy with its immutable bundle. */
export async function activateLandingSource(
  ctx: MutationCtx,
  visibility: "internal-entry" | "visible"
) {
  const snapshotId = await Effect.runPromise(
    activateTryoutSnapshot(ctx, {
      catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
        makeLandingHierarchy(locale, visibility)
      ),
      placements: Arr.map(ACTIVE_APP_LOCALE_CODES, makeLandingPlacement),
    })
  );
  await insertTestTryoutRuntimeBundle(ctx, snapshotId);
  return snapshotId;
}

/** Maps the technical fixture onto the stable landing question identity. */
export function makeLandingHierarchy(
  locale: ActiveAppLocaleCode,
  visibility: "internal-entry" | "visible",
  scoringStrategy: "raw" | "irt" = "raw"
) {
  return Schema.decodeSync(Schema.Array(TryoutCatalogRowSchema))(
    Arr.map(
      makeTryoutStartHierarchy(locale, visibility, scoringStrategy),
      (row) =>
        Match.value(row).pipe(
          Match.discriminators("kind")({
            country: (country) => country,
            exam: (exam) => ({
              ...exam,
              examKey: LANDING_FEATURED_TRYOUT.examKey,
              publicPath: "try-out/indonesia/snbt",
              title: "SNBT",
            }),
            track: (track) => ({
              ...track,
              examKey: LANDING_FEATURED_TRYOUT.examKey,
              publicPath: "try-out/indonesia/snbt/2027",
              title: "Year 2027",
              trackKey: LANDING_FEATURED_TRYOUT.trackKey,
              trackKind: "year",
            }),
            set: (set) => ({
              ...set,
              examKey: LANDING_FEATURED_TRYOUT.examKey,
              publicPath: LANDING_SET_PATH,
              setKey: LANDING_FEATURED_TRYOUT.setKey,
              title: "Set 1",
              trackKey: LANDING_FEATURED_TRYOUT.trackKey,
            }),
            section: (section) => ({
              ...section,
              examKey: LANDING_FEATURED_TRYOUT.examKey,
              publicPath:
                visibility === "visible"
                  ? `${LANDING_SET_PATH}/${LANDING_FEATURED_TRYOUT.sectionKey}`
                  : undefined,
              questionSourcePath: LANDING_SOURCE_ROOT,
              sectionKey: LANDING_FEATURED_TRYOUT.sectionKey,
              setKey: LANDING_FEATURED_TRYOUT.setKey,
              title: "Quantitative Knowledge",
              trackKey: LANDING_FEATURED_TRYOUT.trackKey,
            }),
          }),
          Match.orElse((other) => other)
        )
    )
  );
}

/** Maps the technical placement onto the stable landing question identity. */
export function makeLandingPlacement(locale: ActiveAppLocaleCode) {
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...makeTryoutStartPlacement(locale),
    answerContentKey: `${LANDING_QUESTION_ROOT}/answer`,
    examKey: LANDING_FEATURED_TRYOUT.examKey,
    questionContentKey: LANDING_FEATURED_TRYOUT.questionContentKey,
    questionSourcePath: LANDING_QUESTION_SOURCE_ROOT,
    rendererDomain: "snbt-quant",
    sectionKey: LANDING_FEATURED_TRYOUT.sectionKey,
    trackKey: LANDING_FEATURED_TRYOUT.trackKey,
  });
}

/** Reshapes the landing hierarchy into the seven sections of real SNBT set 1. */
function makeSnbtHierarchy(locale: ActiveAppLocaleCode) {
  const sectionCount = OTHER_SNBT_SECTIONS.length + 1;
  const questionCount = Arr.reduce(
    OTHER_SNBT_SECTIONS,
    LANDING_QUESTION_COUNT,
    (total, section) => total + section.questionCount
  );
  const hierarchy = makeLandingHierarchy(locale, "visible");

  return Schema.decodeSync(Schema.Array(TryoutCatalogRowSchema))([
    ...Arr.map(hierarchy, (row) => {
      if (row.kind === "track" || row.kind === "set") {
        return {
          ...row,
          questionCount,
          sectionCount,
          visibleSectionCount: sectionCount,
        };
      }
      if (row.kind === "section") {
        return { ...row, questionCount: LANDING_QUESTION_COUNT };
      }
      return row;
    }),
    ...Arr.flatMap(hierarchy, (row) =>
      row.kind === "section"
        ? Arr.map(OTHER_SNBT_SECTIONS, (section, index) => ({
            ...row,
            order: index + 2,
            publicPath: `${LANDING_SET_PATH}/${section.sectionKey}`,
            questionCount: section.questionCount,
            sectionKey: section.sectionKey,
            title: section.sectionKey,
          }))
        : []
    ),
  ]);
}

/** Makes the landing section's placement for one authored question order. */
function makeLandingQuestionPlacement(
  locale: ActiveAppLocaleCode,
  questionOrder: number
) {
  const questionRoot = `${LANDING_QUESTION_BANK_ROOT}/question-${questionOrder}`;
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...makeLandingPlacement(locale),
    answerContentKey: `${questionRoot}/answer`,
    questionContentKey: `${questionRoot}/question`,
    questionOrder,
    questionSourcePath: `packages/corpus/${questionRoot}`,
  });
}

/**
 * Activates the real SNBT set 1 shape: seven sections, and the landing one
 * with a placement for each of the given question orders (all 20 by default).
 */
export async function activateSnbtSource(
  ctx: MutationCtx,
  questionOrders: readonly number[] = Arr.range(1, LANDING_QUESTION_COUNT)
) {
  const snapshotId = await Effect.runPromise(
    activateTryoutSnapshot(ctx, {
      catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, makeSnbtHierarchy),
      placements: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
        Arr.map(questionOrders, (order) =>
          makeLandingQuestionPlacement(locale, order)
        )
      ),
    })
  );
  await insertTestTryoutRuntimeBundle(ctx, snapshotId);
  return snapshotId;
}

/** Supplies the exact pinned landing catalog and its locale-specific placements. */
export function makeLandingSource() {
  return {
    catalog: Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
      makeLandingHierarchy(locale, "visible")
    ),
    placements: Arr.map(ACTIVE_APP_LOCALE_CODES, makeLandingPlacement),
  };
}
