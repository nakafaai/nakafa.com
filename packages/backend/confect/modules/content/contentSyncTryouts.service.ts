import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { assertContentSyncBatchSize } from "@repo/backend/confect/modules/content/contentSync.shared";
import { enqueueScaleQualityRefresh } from "@repo/backend/confect/modules/tryout/irtQueueHelpers.service";
import { getOrPublishScaleVersionForTryout } from "@repo/backend/confect/modules/tryout/irtScalePublish.service";
import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/confect/modules/tryout/products";
import { syncTryoutPartSetMappings } from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { TRY_OUT_SEGMENT } from "@repo/contents/_types/exercises/slug";
import { Clock, Duration, Effect, Option } from "effect";

const SCALE_QUALITY_QUEUE_DRAIN_DELAY_MS = 1;

/** Syncs detected tryouts from exercise sets and refreshes IRT scale metadata. */
export const bulkSyncTryouts = Effect.fn("contentSync.tryouts.bulkSyncTryouts")(
  function* (args: {
    readonly locale: Locale;
    readonly product: TryoutProduct;
    readonly requiredPartKeys: readonly string[];
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const scheduler = yield* Scheduler;
    const now = yield* Clock.currentTimeMillis;
    let enqueuedScaleQualityRefresh = false;
    let created = 0;
    let unchanged = 0;
    let updated = 0;
    const tryoutCandidateLimit = CONTENT_SYNC_BATCH_LIMITS.tryoutDetectionSets;
    const tryoutCandidateSets = yield* reader
      .table("exerciseSets")
      .index("by_locale_and_type_and_exerciseType", (query) =>
        query
          .eq("locale", args.locale)
          .eq("type", args.product)
          .eq("exerciseType", TRY_OUT_SEGMENT)
      )
      .take(tryoutCandidateLimit + 1);

    yield* assertContentSyncBatchSize({
      functionName: "bulkSyncTryouts",
      limit: tryoutCandidateLimit,
      received: tryoutCandidateSets.length,
      unit: "tryout candidate sets",
    });

    const productPolicy = tryoutProductPolicies[args.product];
    const orderedDetectedTryouts = [
      ...productPolicy.detectTryouts({
        locale: args.locale,
        requiredPartKeys: args.requiredPartKeys,
        sets: tryoutCandidateSets,
      }),
    ].sort(productPolicy.compareTryouts);
    const detectedSlugs = new Set(
      orderedDetectedTryouts.map((tryout) => tryout.slug)
    );
    const activeTryoutCount = orderedDetectedTryouts.reduce(
      (count, tryout) => count + (tryout.isActive ? 1 : 0),
      0
    );

    for (const [index, tryout] of orderedDetectedTryouts.entries()) {
      const catalogPosition = index + 1;
      const existingTryout = yield* reader
        .table("tryouts")
        .index("by_product_and_locale_and_cycleKey_and_slug", (query) =>
          query
            .eq("product", tryout.product)
            .eq("locale", tryout.locale)
            .eq("cycleKey", tryout.cycleKey)
            .eq("slug", tryout.slug)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull));

      if (existingTryout) {
        const mappingsChanged = yield* syncTryoutPartSetMappings({
          parts: tryout.parts,
          tryoutId: existingTryout._id,
        });
        const hasChanges =
          existingTryout.isActive !== tryout.isActive ||
          existingTryout.catalogPosition !== catalogPosition ||
          existingTryout.label !== tryout.label ||
          existingTryout.partCount !== tryout.partCount ||
          existingTryout.totalQuestionCount !== tryout.totalQuestionCount ||
          mappingsChanged;

        if (!hasChanges) {
          if (existingTryout.isActive) {
            yield* getOrPublishScaleVersionForTryout({
              now,
              tryoutId: existingTryout._id,
            });

            if (
              yield* enqueueScaleQualityRefresh({
                enqueuedAt: now,
                tryoutId: existingTryout._id,
              })
            ) {
              enqueuedScaleQualityRefresh = true;
            }
          }

          unchanged += 1;
          continue;
        }

        yield* writer.table("tryouts").patch(existingTryout._id, {
          catalogPosition,
          isActive: tryout.isActive,
          label: tryout.label,
          partCount: tryout.partCount,
          syncedAt: now,
          totalQuestionCount: tryout.totalQuestionCount,
        });

        if (tryout.isActive) {
          yield* getOrPublishScaleVersionForTryout({
            now,
            tryoutId: existingTryout._id,
          });
        }

        if (
          yield* enqueueScaleQualityRefresh({
            enqueuedAt: now,
            tryoutId: existingTryout._id,
          })
        ) {
          enqueuedScaleQualityRefresh = true;
        }

        updated += 1;
        continue;
      }

      const tryoutId = yield* writer.table("tryouts").insert({
        catalogPosition,
        cycleKey: tryout.cycleKey,
        detectedAt: now,
        isActive: tryout.isActive,
        label: tryout.label,
        locale: tryout.locale,
        partCount: tryout.partCount,
        product: tryout.product,
        slug: tryout.slug,
        syncedAt: now,
        totalQuestionCount: tryout.totalQuestionCount,
      });

      yield* syncTryoutPartSetMappings({
        parts: tryout.parts,
        tryoutId,
      });

      if (tryout.isActive) {
        yield* getOrPublishScaleVersionForTryout({
          now,
          tryoutId,
        });
      }

      if (
        yield* enqueueScaleQualityRefresh({
          enqueuedAt: now,
          tryoutId,
        })
      ) {
        enqueuedScaleQualityRefresh = true;
      }

      created += 1;
    }

    const activeTryouts = yield* reader
      .table("tryouts")
      .index("by_product_and_locale_and_isActive", (query) =>
        query
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("isActive", true)
      )
      .take(tryoutCandidateLimit + 1);

    yield* assertContentSyncBatchSize({
      functionName: "bulkSyncTryouts",
      limit: tryoutCandidateLimit,
      received: activeTryouts.length,
      unit: "active tryouts",
    });

    for (const activeTryout of activeTryouts) {
      if (detectedSlugs.has(activeTryout.slug)) {
        continue;
      }

      yield* writer.table("tryouts").patch(activeTryout._id, {
        isActive: false,
        syncedAt: now,
      });

      if (
        yield* enqueueScaleQualityRefresh({
          enqueuedAt: now,
          tryoutId: activeTryout._id,
        })
      ) {
        enqueuedScaleQualityRefresh = true;
      }

      updated += 1;
    }

    yield* syncCatalogMeta({
      activeTryoutCount,
      locale: args.locale,
      now,
      product: args.product,
    });

    if (enqueuedScaleQualityRefresh) {
      yield* scheduler.runAfter(
        Duration.millis(SCALE_QUALITY_QUEUE_DRAIN_DELAY_MS),
        refs.internal.irt.mutations.internalFunctions.scales
          .drainScaleQualityRefreshQueue,
        {}
      );
    }

    return { created, unchanged, updated };
  }
);

/** Upserts catalog-level tryout metadata for one product and locale. */
const syncCatalogMeta = Effect.fn("contentSync.tryouts.syncCatalogMeta")(
  function* (args: {
    readonly activeTryoutCount: number;
    readonly locale: Locale;
    readonly now: number;
    readonly product: TryoutProduct;
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const existingCatalogMeta = yield* reader
      .table("tryoutCatalogMeta")
      .index("by_product_and_locale", (query) =>
        query.eq("product", args.product).eq("locale", args.locale)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (!existingCatalogMeta) {
      yield* writer.table("tryoutCatalogMeta").insert({
        activeCount: args.activeTryoutCount,
        locale: args.locale,
        product: args.product,
        updatedAt: args.now,
      });
      return null;
    }

    if (existingCatalogMeta.activeCount === args.activeTryoutCount) {
      return null;
    }

    yield* writer.table("tryoutCatalogMeta").patch(existingCatalogMeta._id, {
      activeCount: args.activeTryoutCount,
      updatedAt: args.now,
    });

    return null;
  }
);
