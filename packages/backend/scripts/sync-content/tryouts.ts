import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { tryoutProducts } from "@repo/backend/convex/tryouts/products";
import { runConvexMutation } from "@repo/backend/scripts/sync-content/convexApi";
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

const tryoutPartKeyReaders = {
  snbt: () =>
    getSubjects("high-school", "snbt").map((subject) => subject.label),
} satisfies Record<
  (typeof tryoutProducts)[number],
  () => ReturnType<typeof getSubjects>[number]["label"][]
>;

/** Returns product part keys from the same content folders used by web listings. */
function getTryoutPartKeys(product: (typeof tryoutProducts)[number]) {
  const partKeys = tryoutPartKeyReaders[product]();

  if (partKeys.length === 0) {
    throw new Error(`No tryout part keys found for ${product}.`);
  }

  return partKeys;
}

export const syncTryouts = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> => {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- TRYOUTS ---\n");
  }

  const locales: Locale[] = options.locale ? [options.locale] : ["en", "id"];
  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };

  for (const product of tryoutProducts) {
    for (const locale of locales) {
      const result = await runConvexMutation(
        config,
        "contentSync/mutations/tryouts:bulkSyncTryouts",
        { product, locale, requiredPartKeys: getTryoutPartKeys(product) }
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
};
