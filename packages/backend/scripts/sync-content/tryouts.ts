import { tryoutProducts } from "../../convex/tryouts/products";
import { runConvexMutation } from "./convexApi";
import { formatDuration, log } from "./logging";
import type { ConvexConfig, Locale, SyncOptions, SyncResult } from "./types";

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
        "contentSync/mutations:bulkSyncTryouts",
        { product, locale }
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
