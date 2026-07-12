import type { SyncedTryoutRoute } from "@repo/backend/convex/contentSync/tryouts/spec";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import type { TryoutSyncArgs } from "@repo/backend/scripts/sync-content/tryout/batch";
import type { TryoutRouteKind } from "@repo/contents/_types/tryout/schema";
import type { Locale } from "@repo/utilities/locales";
import { Effect } from "effect";

type TryoutCountryRow = TryoutSyncArgs["countries"][number];

interface TryoutRouteSource {
  description?: string;
  isReady?: boolean;
  kind: TryoutRouteKind;
  locale: Locale;
  publicPath: string;
  sourceRevision: string;
  title: string;
}

/** Adds one shared country and its route exactly once across exam sources. */
export const addTryoutCountry = Effect.fn("sync.addTryoutCountry")(function* (
  countries: Map<string, TryoutCountryRow>,
  routes: Map<string, SyncedTryoutRoute>,
  row: TryoutCountryRow
) {
  const identity = JSON.stringify([row.locale, row.countryKey]);
  const existing = countries.get(identity);

  if (existing) {
    if (hasSameCountryProjection(existing, row)) {
      return;
    }

    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Conflicting shared try-out country: ${row.locale}:${row.countryKey}.`,
      })
    );
  }

  countries.set(identity, row);
  yield* addTryoutRoute(routes, { ...row, kind: "tryout-country" });
});

/** Adds one unique localized route or fails before content sync can mutate Convex. */
export const addTryoutRoute = Effect.fn("sync.addTryoutRoute")(function* (
  routes: Map<string, SyncedTryoutRoute>,
  source: TryoutRouteSource
) {
  const identity = JSON.stringify([source.locale, source.publicPath]);

  if (routes.has(identity)) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Duplicate try-out route: ${source.locale}:${source.publicPath}.`,
      })
    );
  }

  const sourcePath = source.publicPath;
  const values = {
    description: source.description,
    isReady: source.isReady !== false,
    kind: source.kind,
    locale: source.locale,
    publicPath: source.publicPath,
    sourcePath,
    title: source.title,
  };

  routes.set(identity, {
    ...values,
    contentHash: computeHash(
      JSON.stringify({ ...values, sourceRevision: source.sourceRevision })
    ),
  });
});

/** Compares durable country fields while allowing independent source revisions. */
function hasSameCountryProjection(
  left: TryoutCountryRow,
  right: TryoutCountryRow
) {
  return (
    left.countryKey === right.countryKey &&
    left.description === right.description &&
    left.isActive === right.isActive &&
    left.locale === right.locale &&
    left.order === right.order &&
    left.publicPath === right.publicPath &&
    left.title === right.title
  );
}
