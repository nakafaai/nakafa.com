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
import {
  tryoutLocalizedPathArgsValidator,
  tryoutMetadataArgsValidator,
} from "@repo/backend/content/tryout/spec";
import { Array as Arr, Effect, Schema } from "effect";

const TryoutMetadataInputSchema = Schema.Struct(tryoutMetadataArgsValidator);
type TryoutMetadataInput = typeof TryoutMetadataInputSchema.Type;
const TryoutLocalizedPathInputSchema = Schema.Struct(
  tryoutLocalizedPathArgsValidator
);
type TryoutLocalizedPathInput = typeof TryoutLocalizedPathInputSchema.Type;

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
      return {
        route: null,
      };
    }
    if (current.kind !== input.kind || !current.publicPath) {
      return {
        route: null,
      };
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
    const alternates = Arr.flatMap(alternateRows, (alternate) =>
      alternate ? [alternate] : []
    );
    return {
      route: {
        alternates,
        ...(current.description === undefined
          ? {}
          : {
              description: current.description,
            }),
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
