import refs from "@repo/backend/confect/_generated/refs";
import {
  tryoutContentSources,
  tryoutProducts,
} from "@repo/backend/confect/modules/tryout/products";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import {
  formatDuration,
  log,
} from "@repo/backend/scripts/sync-content/logging";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import { getSubjects } from "@repo/contents/_lib/exercises/type";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

/** Returns product part keys from the same content folders used by web listings. */
const getTryoutPartKeys = Effect.fn("sync.getTryoutPartKeys")(function* (
  product: (typeof tryoutProducts)[number]
) {
  const source = tryoutContentSources[product];
  const partKeys = getSubjects(source.category, source.type).map(
    (subject) => subject.label
  );

  if (partKeys.length === 0) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `No tryout part keys found for ${product}.`,
      })
    );
  }

  return partKeys;
});

/** Syncs tryout product metadata derived from content folders. */
export const syncTryouts = Effect.fn("sync.tryouts")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- TRYOUTS ---\n");
  }

  const selectedLocales = options.locale ? [options.locale] : locales;
  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };

  for (const product of tryoutProducts) {
    for (const locale of selectedLocales) {
      const result = yield* callConvex(
        config,
        "mutation",
        refs.internal.contentSync.mutations.tryouts.bulkSyncTryouts,
        {
          product,
          locale,
          requiredPartKeys: yield* getTryoutPartKeys(product),
        }
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;

      if (!options.quiet) {
        log(
          `  ${product}/${locale}: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`
        );
      }
    }
  }

  const durationMs = performance.now() - startTime;
  const processed = totals.created + totals.updated + totals.unchanged;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    log(`Time: ${formatDuration(durationMs)}`);
  }

  return {
    ...totals,
    durationMs,
    itemsPerSecond: durationMs > 0 ? (processed / durationMs) * 1000 : 0,
  };
});
