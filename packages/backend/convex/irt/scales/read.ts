import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";

const MAX_ACTIVE_TRYOUTS_WITHOUT_SCALE = 100;

type IrtDbReader = QueryCtx["db"];
type OperationalItemParams = Pick<
  Doc<"exerciseItemParameters">,
  "questionId" | "difficulty" | "discrimination"
>;

export type ActiveTryoutWithoutScale = Pick<
  Doc<"tryouts">,
  "_id" | "cycleKey" | "locale" | "product" | "slug"
>;

export type ScaleVersionItemSnapshot = OperationalItemParams &
  Pick<Doc<"irtScaleVersionItems">, "setId"> & {
    calibrationRunId: Doc<"irtScaleVersionItems">["calibrationRunId"];
  };

/** Loads the latest published scale version for one tryout. */
export function getLatestScaleVersionForTryout(
  db: IrtDbReader,
  tryoutId: Doc<"irtScaleVersions">["tryoutId"]
) {
  return db
    .query("irtScaleVersions")
    .withIndex("by_tryoutId_and_publishedAt", (q) => q.eq("tryoutId", tryoutId))
    .order("desc")
    .first();
}

/** Lists active tryouts that still do not have a frozen scale version. */
export async function getActiveTryoutsWithoutScale(db: IrtDbReader) {
  const tryouts = await db
    .query("tryouts")
    .withIndex("isActive", (q) => q.eq("isActive", true))
    .take(MAX_ACTIVE_TRYOUTS_WITHOUT_SCALE + 1);

  if (tryouts.length > MAX_ACTIVE_TRYOUTS_WITHOUT_SCALE) {
    throw new ConvexError({
      code: "IRT_ACTIVE_TRYOUT_LIMIT_EXCEEDED",
      message: "Too many active tryouts to audit scale coverage safely.",
    });
  }

  const latestScaleVersions = await asyncMap(tryouts, (tryout) =>
    getLatestScaleVersionForTryout(db, tryout._id)
  );
  const activeTryoutsWithoutScale: ActiveTryoutWithoutScale[] = [];

  for (const [index, tryout] of tryouts.entries()) {
    const scaleVersion = latestScaleVersions[index];

    if (scaleVersion) {
      continue;
    }

    activeTryoutsWithoutScale.push({
      _id: tryout._id,
      cycleKey: tryout.cycleKey,
      locale: tryout.locale,
      product: tryout.product,
      slug: tryout.slug,
    });
  }

  return activeTryoutsWithoutScale;
}

/** Loads all frozen item parameters in one published scale version. */
export function getScaleVersionItems(
  db: IrtDbReader,
  scaleVersionId: Doc<"irtScaleVersionItems">["scaleVersionId"]
) {
  return getManyFrom(
    db,
    "irtScaleVersionItems",
    "by_scaleVersionId_and_setId_and_questionId",
    scaleVersionId,
    "scaleVersionId"
  );
}

/** Loads the frozen item parameters for one set inside a published scale version. */
export async function getScaleVersionItemsForSet(
  db: MutationCtx["db"] | QueryCtx["db"],
  {
    scaleVersionId,
    setId,
  }: Pick<Doc<"irtScaleVersionItems">, "scaleVersionId" | "setId">
) {
  const set = await db.get("exerciseSets", setId);

  if (!set) {
    throw new ConvexError({
      code: "IRT_SET_NOT_FOUND",
      message: "Exercise set not found for scale item lookup.",
    });
  }

  const scaleItems = await db
    .query("irtScaleVersionItems")
    .withIndex("by_scaleVersionId_and_setId_and_questionId", (q) =>
      q.eq("scaleVersionId", scaleVersionId).eq("setId", setId)
    )
    .take(set.questionCount + 1);

  if (scaleItems.length > set.questionCount) {
    throw new ConvexError({
      code: "IRT_SCALE_ITEM_COUNT_EXCEEDED",
      message: "Frozen scale item count exceeds the set question count.",
    });
  }

  return scaleItems;
}
