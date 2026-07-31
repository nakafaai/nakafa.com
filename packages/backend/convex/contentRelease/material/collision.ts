import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import {
  buildExactMaterialOwnerPlan,
  type ExactMaterialOwner,
} from "@repo/backend/convex/contentRelease/material/plan";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

interface SourceRouteCandidate {
  readonly locale: ContentLocale;
  readonly publicPath: string;
  readonly sourcePath?: string;
}

/** Checks whether one selected exact owner displaces the source route. */
function ownsSourceRoute(
  expected: readonly ExactMaterialOwner[],
  locale: ContentLocale,
  sourcePath: string | undefined
) {
  return expected.some(
    (owner) => owner.locale === locale && owner.contentKey === sourcePath
  );
}

/** Resolves every exact material route at one immutable release sequence. */
const loadExactRoutes = Effect.fn("contentRelease.loadExactMaterialRoutes")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    sequence: number,
    owners: readonly ExactMaterialOwner[]
  ) {
    const routes = new Map<string, string>();
    for (const owner of owners) {
      const projection = yield* resolvePublicProjection(
        ctx,
        owner.contentKey,
        owner.locale,
        sequence
      );
      if (!projection) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Release ${releaseId} lost exact material ${owner.contentKey}/${owner.locale}.`
        );
      }
      if (projection.family !== "material") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Release ${releaseId} exact material ${owner.contentKey}/${owner.locale} resolved another family.`
        );
      }
      const identity = `${projection.locale}\0${projection.publicPath}`;
      const existing = routes.get(identity);
      if (existing && existing !== owner.contentKey) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Release ${releaseId} material route ${projection.locale}/${projection.publicPath} has multiple exact owners.`
        );
      }
      routes.set(identity, owner.contentKey);
    }
    return routes;
  }
);

/** Loads every visible exact material path selected by the active release. */
const loadActiveExactRoutes = Effect.fn(
  "contentRelease.loadActiveExactMaterialRoutes"
)(function* (ctx: MutationCtx) {
  const catalog = yield* loadMaterialCatalogOwner(ctx);
  if (!catalog.active || catalog.familyManaged) {
    return new Map<string, string>();
  }
  const active = catalog.active;
  const owners = yield* Effect.promise(() =>
    ctx.db
      .query("materialOwners")
      .withIndex("by_releaseId_and_locale_and_contentKey", (index) =>
        index.eq("releaseId", active.releaseId)
      )
      .take(EXACT_SCOPE_LIMIT + 1)
  );
  if (owners.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Active release ${active.releaseId} exceeds ${EXACT_SCOPE_LIMIT} exact material owners.`
    );
  }
  if (owners.some((owner) => owner.sequence !== active.sequence)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active release ${active.releaseId} has stale exact material owners.`
    );
  }
  return yield* loadExactRoutes(ctx, active.releaseId, active.sequence, owners);
});

/** Loads exact paths reserved by a retained verified recovery release. */
const loadRecoveryExactRoutes = Effect.fn(
  "contentRelease.loadRecoveryExactMaterialRoutes"
)(function* (ctx: MutationCtx) {
  const state = yield* loadState(ctx);
  if (!state || state.candidateReleaseId !== undefined) {
    return new Map<string, string>();
  }
  const recoveryFields = [
    state.recoveryManifestHash,
    state.recoveryReleaseId,
    state.recoverySequence,
  ];
  if (recoveryFields.every((field) => field === undefined)) {
    return new Map<string, string>();
  }
  if (
    !(state.recoveryManifestHash && state.recoveryReleaseId) ||
    state.recoverySequence === undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained recovery has a partial publication identity."
    );
  }
  const recovery = yield* loadRelease(ctx, state.recoveryReleaseId);
  if (
    recovery.role !== "recovery" ||
    recovery.status !== "verified" ||
    recovery.sequence !== state.recoverySequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Retained recovery ${state.recoveryReleaseId} lost its verified identity.`
    );
  }
  const plan = yield* buildExactMaterialOwnerPlan(ctx, recovery);
  return yield* loadExactRoutes(
    ctx,
    recovery.releaseId,
    recovery.sequence,
    Array.from(plan.expected.values())
  );
});

/** Merges protected routes and rejects conflicting exact owners. */
function mergeExactRoutes(
  active: ReadonlyMap<string, string>,
  recovery: ReadonlyMap<string, string>
) {
  const routes = new Map(active);
  for (const [identity, owner] of recovery) {
    const existing = routes.get(identity);
    if (existing && existing !== owner) {
      return null;
    }
    routes.set(identity, owner);
  }
  return routes;
}

/** Rejects source sync rows that would collide with an active exact owner. */
export const validateSourceMaterialRoutes = Effect.fn(
  "contentRelease.validateSourceMaterialRoutes"
)(function* (ctx: MutationCtx, routes: readonly SourceRouteCandidate[]) {
  const [activeRoutes, recoveryRoutes] = yield* Effect.all([
    loadActiveExactRoutes(ctx),
    loadRecoveryExactRoutes(ctx),
  ]);
  const exactRoutes = mergeExactRoutes(activeRoutes, recoveryRoutes);
  if (!exactRoutes) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Active and retained recovery releases conflict on an exact material route."
    );
  }
  for (const route of routes) {
    const owner = exactRoutes.get(`${route.locale}\0${route.publicPath}`);
    if (!owner || owner === route.sourcePath) {
      continue;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Source route ${route.locale}/${route.publicPath} conflicts with protected exact material ${owner}.`
    );
  }
});

/** Proves every exact route displaces only another selected source owner. */
export const validateExactMaterialRoutes = Effect.fn(
  "contentRelease.validateExactMaterialRoutes"
)(function* (
  ctx: MutationCtx,
  sequence: number,
  expected: readonly ExactMaterialOwner[]
) {
  for (const owner of expected) {
    const projection = yield* resolvePublicProjection(
      ctx,
      owner.contentKey,
      owner.locale,
      sequence
    );
    if (!projection) {
      continue;
    }
    if (projection.family !== "material") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Exact material ${owner.contentKey}/${owner.locale} resolved a different family before activation.`
      );
    }
    const sourceRoutes = yield* Effect.promise(() =>
      ctx.db
        .query("publicRoutes")
        .withIndex("by_locale_and_publicPath", (index) =>
          index
            .eq("locale", projection.locale)
            .eq("publicPath", projection.publicPath)
        )
        .take(2)
    );
    if (sourceRoutes.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Source route ${projection.locale}/${projection.publicPath} has multiple owners.`
      );
    }
    if (
      sourceRoutes.length === 0 ||
      ownsSourceRoute(
        expected,
        projection.locale,
        sourceRoutes.at(0)?.sourcePath
      )
    ) {
      continue;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Exact material ${owner.contentKey}/${owner.locale} conflicts with retained source route ${projection.publicPath}.`
    );
  }
});
