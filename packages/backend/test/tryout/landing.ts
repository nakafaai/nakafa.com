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
import { Schema } from "effect";

const LANDING_SET_PATH = "try-out/indonesia/snbt/2027/set-1";
const LANDING_SOURCE_ROOT =
  "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1";
const LANDING_QUESTION_ROOT =
  "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1";
const LANDING_QUESTION_SOURCE_ROOT = `${LANDING_SOURCE_ROOT}/question-1`;

/** Activates the stable landing hierarchy with its immutable bundle. */
export async function activateLandingSource(
  ctx: MutationCtx,
  visibility: "internal-entry" | "visible"
) {
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog: ACTIVE_APP_LOCALE_CODES.flatMap((locale) =>
      makeLandingHierarchy(locale, visibility)
    ),
    placements: ACTIVE_APP_LOCALE_CODES.map(makeLandingPlacement),
  });
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
    makeTryoutStartHierarchy(locale, visibility, scoringStrategy).map((row) => {
      switch (row.kind) {
        case "country":
          return row;
        case "exam":
          return {
            ...row,
            examKey: LANDING_FEATURED_TRYOUT.examKey,
            publicPath: "try-out/indonesia/snbt",
            title: "SNBT",
          };
        case "track":
          return {
            ...row,
            examKey: LANDING_FEATURED_TRYOUT.examKey,
            publicPath: "try-out/indonesia/snbt/2027",
            title: "Year 2027",
            trackKey: LANDING_FEATURED_TRYOUT.trackKey,
            trackKind: "year",
          };
        case "set":
          return {
            ...row,
            examKey: LANDING_FEATURED_TRYOUT.examKey,
            publicPath: LANDING_SET_PATH,
            setKey: LANDING_FEATURED_TRYOUT.setKey,
            title: "Set 1",
            trackKey: LANDING_FEATURED_TRYOUT.trackKey,
          };
        case "section":
          return {
            ...row,
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
          };
        default:
          return row;
      }
    })
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

/** Supplies the exact pinned landing catalog and its locale-specific placements. */
export function makeLandingSource() {
  return {
    catalog: ACTIVE_APP_LOCALE_CODES.flatMap((locale) =>
      makeLandingHierarchy(locale, "visible")
    ),
    placements: ACTIVE_APP_LOCALE_CODES.map(makeLandingPlacement),
  };
}
