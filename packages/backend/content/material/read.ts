import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import { readMaterialGroup } from "@repo/backend/content/material/navigation";
import { resolveMaterialRoute } from "@repo/backend/content/material/route";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import { encodePublicDelivery } from "@repo/backend/content/publication/exchange";
import { readSelectedPublicRuntime } from "@repo/backend/content/publication/public";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect, Option } from "effect";

type AuthenticatedMaterial = NonNullable<
  Effect.Success<ReturnType<typeof resolveMaterialRoute>>["material"]
>;

/** Reads every locale-specific counterpart for one stable material identity. */
const readAlternates = Effect.fn("contentRelease.readMaterialAlternates")(
  function* (
    requested: AuthenticatedMaterial,
    activeAppLocales: ActiveAppLocaleList,
    activeSequence: number
  ) {
    const counterparts = yield* Effect.forEach(activeAppLocales, (appLocale) =>
      Effect.gen(function* () {
        if (appLocale === requested.row.appLocale) {
          return requested;
        }
        const alternate = Option.getOrNull(
          yield* (yield* MaterialSource).material(
            requested.row.slot,
            requested.row.contentKey,
            appLocale
          )
        );
        if (alternate) {
          const { projection, resolved } = yield* verifyEffectiveMaterial(
            alternate,
            activeSequence
          );
          return {
            projection,
            projectionJson: resolved.projectionJson,
            row: alternate,
          };
        }
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Material ${requested.row.contentKey} lost locale ${appLocale}.`
        );
      })
    );
    return counterparts;
  }
);

/** Resolves the complete active shell model for one localized material lesson. */
const assembleMaterialMetadata = Effect.fn(
  "contentRelease.assembleMaterialMetadata"
)(function* (
  appLocale: Doc<"materialCatalog">["appLocale"],
  route: Effect.Success<ReturnType<typeof resolveMaterialRoute>>,
  expectedActiveReleaseId?: string | null
) {
  yield* requireExpectedActiveRelease(
    route.active,
    expectedActiveReleaseId,
    "Material route"
  );
  if (!(route.managed && route.active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Signed material ownership is unavailable for ${appLocale}.`
    );
  }
  if (!route.material) {
    return {
      activeManifestHash: route.active.manifestHash,
      activeAppLocales: Array.from(
        route.active.signed.manifest.activeAppLocales
      ),
      activeReleaseId: route.active.releaseId,
      alternateJson: [],
      projectionJson: null,
      rendererDomain: null,
      sourcePath: null,
      sourceRevision: readSourceRevision(route.active),
    };
  }
  const requested = route.material;
  const { projectionJson, row } = requested;
  const alternates = yield* readAlternates(
    requested,
    route.active.signed.manifest.activeAppLocales,
    route.active.sequence
  );
  const alternateJson = alternates.map((material) => material.projectionJson);
  return {
    activeManifestHash: route.active.manifestHash,
    activeAppLocales: Array.from(route.active.signed.manifest.activeAppLocales),
    activeReleaseId: route.active.releaseId,
    alternateJson,
    projectionJson,
    rendererDomain: row.rendererDomain,
    sourcePath: row.sourcePath,
    sourceRevision: readSourceRevision(route.active),
  };
});

/** Combines authenticated lesson metadata with its ordered navigation. */
const assembleMaterialModel = Effect.fn("contentRelease.assembleMaterialModel")(
  function* (
    appLocale: Doc<"materialCatalog">["appLocale"],
    route: Effect.Success<ReturnType<typeof resolveMaterialRoute>>,
    expectedActiveReleaseId?: string | null
  ) {
    const model = yield* assembleMaterialMetadata(
      appLocale,
      route,
      expectedActiveReleaseId
    );
    const siblingJson =
      route.material && route.active
        ? yield* readMaterialGroup(
            route.material.row,
            route.active.sequence,
            route.material
          )
        : [];
    return { ...model, siblingJson };
  }
);

/** Reads a signed lesson without reopening its shared navigation graph. */
export const readMaterialLesson = Effect.fn(
  "contentRelease.readMaterialLesson"
)(function* (
  appLocale: Doc<"materialCatalog">["appLocale"],
  publicPath: string
) {
  const route = yield* resolveMaterialRoute(appLocale, publicPath);
  const model = yield* assembleMaterialMetadata(appLocale, route);
  const runtime = yield* readSelectedPublicRuntime(route);
  const runtimeJson = yield* encodePublicDelivery(runtime, model);
  return {
    materialKey: route.material?.row.materialKey ?? null,
    model,
    runtimeJson,
  };
});

/** Resolves the complete active shell model for one localized material lesson. */
export const readMaterialModel = Effect.fn("contentRelease.readMaterialModel")(
  function* (
    appLocale: Doc<"materialCatalog">["appLocale"],
    publicPath: string,
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveMaterialRoute(appLocale, publicPath);
    return yield* assembleMaterialModel(
      appLocale,
      route,
      expectedActiveReleaseId
    );
  }
);
