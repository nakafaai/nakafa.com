import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import {
  readTryoutCatalogRowByIdentity,
  readTryoutCatalogRowByPath,
} from "@repo/backend/content/tryout/row";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect } from "effect";

export const tryoutMetadataArgsValidator = {
  appLocale: appLocaleValidator,
  kind: literals("country", "exam", "track", "set", "section"),
  publicPath: v.string(),
};

export const tryoutLocalizedPathArgsValidator = {
  currentAppLocale: appLocaleValidator,
  publicPath: v.string(),
  targetAppLocale: appLocaleValidator,
};

const tryoutAlternateValidator = v.object({
  appLocale: appLocaleValidator,
  publicPath: v.string(),
});
const tryoutSocialImageIdentityValidator = v.object({
  countryKey: v.string(),
  examKey: v.string(),
});

export const tryoutMetadataReturnValidator = v.object({
  route: v.union(
    v.null(),
    v.object({
      alternates: v.array(tryoutAlternateValidator),
      description: v.optional(v.string()),
      publicPath: v.string(),
      socialImageIdentity: v.union(
        v.null(),
        tryoutSocialImageIdentityValidator
      ),
      title: v.string(),
    })
  ),
});

type TryoutRouteKind = TryoutCatalogRow["kind"];

interface TryoutMetadataInput {
  readonly appLocale: AppLocaleCode;
  readonly kind: TryoutRouteKind;
  readonly publicPath: string;
}

interface TryoutLocalizedPathInput {
  readonly currentAppLocale: AppLocaleCode;
  readonly publicPath: string;
  readonly targetAppLocale: AppLocaleCode;
}

/** Reads one route and its localized counterparts from signed ownership. */
export const readTryoutMetadata = Effect.fn("tryouts.catalog.readMetadata")(
  function* (input: TryoutMetadataInput) {
    const owner = yield* loadTryoutOwner();
    const { snapshot, snapshotId } = owner;
    const current = yield* readCurrentRoute({
      appLocale: input.appLocale,
      publicPath: input.publicPath,
      snapshotId,
    });
    if (!current) {
      return { route: null };
    }
    if (current.kind !== input.kind || !current.publicPath) {
      return { route: null };
    }
    const currentPublicPath = current.publicPath;

    const activeAppLocales = snapshot.manifest.activeAppLocales;
    const alternateRows = yield* Effect.forEach(activeAppLocales, (locale) =>
      readAlternate({
        appLocale: locale,
        current,
        snapshotId,
      })
    );
    const alternates = alternateRows.flatMap((alternate) =>
      alternate ? [alternate] : []
    );

    return {
      route: {
        alternates,
        description: current.description,
        publicPath: currentPublicPath,
        socialImageIdentity:
          current.kind === "exam"
            ? {
                countryKey: current.countryKey,
                examKey: current.examKey,
              }
            : null,
        title: current.title,
      },
    };
  }
);

/** Resolves one exact signed route to its target-locale public path. */
export const readTryoutLocalizedPath = Effect.fn(
  "tryouts.catalog.readLocalizedPath"
)(function* (input: TryoutLocalizedPathInput) {
  const owner = yield* loadTryoutOwner();
  const current = yield* readCurrentRoute({
    appLocale: input.currentAppLocale,
    publicPath: input.publicPath,
    snapshotId: owner.snapshotId,
  });
  if (!current) {
    return null;
  }

  const alternate = yield* readAlternate({
    appLocale: input.targetAppLocale,
    current,
    snapshotId: owner.snapshotId,
  });
  if (!alternate) {
    return null;
  }
  return alternate.publicPath;
});

/** Reads and verifies one exact current route from the active signed catalog. */
const readCurrentRoute = Effect.fn("tryouts.catalog.readCurrentRoute")(
  function* (input: {
    readonly appLocale: AppLocaleCode;
    readonly publicPath: string;
    readonly snapshotId: string;
  }) {
    return yield* readTryoutCatalogRowByPath(input.snapshotId, input);
  }
);

/** Reads one exact localized counterpart without loading another catalog. */
const readAlternate = Effect.fn("tryouts.catalog.readMetadataAlternate")(
  function* (input: {
    readonly appLocale: AppLocaleCode;
    readonly current: TryoutCatalogRow;
    readonly snapshotId: string;
  }) {
    const identity = tryoutCatalogIdentity({
      ...input.current,
      appLocale: AppLocaleSchema.make(input.appLocale),
    });
    const alternate = yield* readTryoutCatalogRowByIdentity(
      input.snapshotId,
      identity
    );
    if (!alternate?.publicPath) {
      return null;
    }
    return {
      appLocale: input.appLocale,
      publicPath: alternate.publicPath,
    };
  }
);
