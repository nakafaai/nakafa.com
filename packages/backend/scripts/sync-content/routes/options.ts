import type { SyncOptions } from "@repo/backend/scripts/sync-content/contract/types";

interface CleanupResult {
  deleted: number;
}

/**
 * Clears locale scoping for route-page rebuilds after a global cleanup deleted
 * rows, so downstream read models are rebuilt across every locale still present.
 */
export function readRoutePageOptionsAfterCleanup(
  options: SyncOptions,
  cleanResult: CleanupResult
): SyncOptions {
  if (cleanResult.deleted > 0 && options.locale) {
    return { ...options, locale: undefined };
  }

  return options;
}
