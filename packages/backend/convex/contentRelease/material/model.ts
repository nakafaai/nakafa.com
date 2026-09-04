import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { resolveMaterialRoute } from "@repo/backend/convex/contentRelease/material/route";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect } from "effect";

type AuthenticatedMaterial = NonNullable<
  Effect.Success<ReturnType<typeof resolveMaterialRoute>>["material"]
>;

/** Reads every locale-specific counterpart for one stable material identity. */
const readAlternates = Effect.fn("contentRelease.readMaterialAlternates")(
  function* (
    ctx: QueryCtx,
    requested: AuthenticatedMaterial,
    activeAppLocales: ActiveAppLocaleList,
    activeSequence: number
  ) {
    const counterparts = yield* Effect.forEach(activeAppLocales, (appLocale) =>
      Effect.gen(function* () {
        if (appLocale === requested.row.appLocale) {
          return requested;
        }
        const alternate = yield* Effect.promise(() =>
          ctx.db
            .query("materialCatalog")
            .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
              index
                .eq("slot", requested.row.slot)
                .eq("contentKey", requested.row.contentKey)
                .eq("appLocale", appLocale)
            )
            .unique()
        );
        if (alternate) {
          const { projection, resolved } = yield* verifyEffectiveMaterial(
            ctx,
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
  function* (
    ctx: QueryCtx,
    requested: AuthenticatedMaterial,
    activeSequence: number
  ) {
    const siblings = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex(
          "by_slot_and_appLocale_and_materialKey_and_order_and_publicPath",
          (index) =>
            index
              .eq("slot", requested.row.slot)
              .eq("appLocale", requested.row.appLocale)
              .eq("materialKey", requested.row.materialKey)
        )
        .take(MATERIAL_GROUP_LIMIT + 1)
    );
    if (siblings.length > MATERIAL_GROUP_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Material ${requested.row.appLocale}/${requested.row.materialKey} exceeds ${MATERIAL_GROUP_LIMIT} lesson sections.`
      );
    }
    const verified = yield* Effect.forEach(siblings, (sibling) => {
      if (sibling._id === requested.row._id) {
        return Effect.succeed(requested);
      }
      return Effect.gen(function* () {
        const { projection, resolved } = yield* verifyEffectiveMaterial(
          ctx,
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
      !verified.some(
        ({ row: candidate }) => candidate._id === requested.row._id
      ) ||
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
    ctx: QueryCtx,
    appLocale: Doc<"materialCatalog">["appLocale"],
    publicPath: string,
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveMaterialRoute(ctx, appLocale, publicPath);
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
        ctx,
        requested,
        route.active.signed.manifest.activeAppLocales,
        route.active.sequence
      ),
      readSiblings(ctx, requested, route.active.sequence),
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
