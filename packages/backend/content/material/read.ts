import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import { resolveMaterialRoute } from "@repo/backend/content/material/route";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
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
    return counterparts.filter((counterpart) => counterpart !== null);
  }
);

/** Reads every ordered lesson section sharing one localized material key. */
const readSiblings = Effect.fn("contentRelease.readMaterialSiblings")(
  function* (requested: AuthenticatedMaterial, activeSequence: number) {
    const siblings = yield* (yield* MaterialSource).siblings(
      requested.row.slot,
      requested.row.appLocale,
      requested.row.materialKey,
      MATERIAL_GROUP_LIMIT + 1
    );
    if (siblings.length > MATERIAL_GROUP_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Material ${requested.row.appLocale}/${requested.row.materialKey} exceeds ${MATERIAL_GROUP_LIMIT} lesson sections.`
      );
    }
    const verified = yield* Effect.forEach(siblings, (sibling) => {
      if (sibling.contentKey === requested.row.contentKey) {
        return Effect.succeed(requested);
      }
      return Effect.gen(function* () {
        const { projection, resolved } = yield* verifyEffectiveMaterial(
          sibling,
          activeSequence
        );
        return {
          projection,
          projectionJson: resolved.projectionJson,
          row: sibling,
        };
      });
    });
    if (
      verified.some(
        ({ projection }) => projection.parentPath !== requested.row.parentPath
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${requested.row.appLocale}/${requested.row.materialKey} lost its coherent lesson group.`
      );
    }
    return verified;
  }
);

/** Resolves the complete active shell model for one localized material lesson. */
export const readMaterialModel = Effect.fn("contentRelease.readMaterialModel")(
  function* (
    appLocale: Doc<"materialCatalog">["appLocale"],
    publicPath: string,
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveMaterialRoute(appLocale, publicPath);
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
        siblingJson: [],
        sourcePath: null,
        sourceRevision: readSourceRevision(route.active),
      };
    }
    const requested = route.material;
    const { projectionJson, row } = requested;
    const [alternates, siblings] = yield* Effect.all([
      readAlternates(
        requested,
        route.active.signed.manifest.activeAppLocales,
        route.active.sequence
      ),
      readSiblings(requested, route.active.sequence),
    ]);
    const alternateJson = alternates.map((material) => material.projectionJson);
    const siblingJson = siblings.map((material) => material.projectionJson);
    return {
      activeManifestHash: route.active.manifestHash,
      activeAppLocales: Array.from(
        route.active.signed.manifest.activeAppLocales
      ),
      activeReleaseId: route.active.releaseId,
      alternateJson,
      projectionJson,
      rendererDomain: row.rendererDomain,
      siblingJson,
      sourcePath: row.sourcePath,
      sourceRevision: readSourceRevision(route.active),
    };
  }
);
