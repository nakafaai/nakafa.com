import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ExactMaterialOwner } from "@repo/backend/convex/contentRelease/material/plan";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { readMaterialDomain } from "@repo/contents/_types/material/identity";
import {
  readDomainSlug,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import { Effect } from "effect";

interface StoredSourceRoute {
  readonly sourcePath?: string;
}

/** Rejects material routes outside their locale and subject domain namespace. */
const validateMaterialRouteNamespace = Effect.fn(
  "contentRelease.validateMaterialRouteNamespace"
)(function* (projection: MaterialLessonProjection) {
  const domain = readMaterialDomain(projection.materialKey);
  const namespace = readNamespaceSegment("subject", projection.locale);
  const domainSlug = domain
    ? readDomainSlug(
        MATERIAL_ROUTE_DOMAINS,
        "lesson",
        domain,
        projection.locale
      )
    : undefined;
  const prefix =
    namespace && domainSlug ? `${namespace}/${domainSlug}/` : undefined;
  if (prefix && projection.parentPath.startsWith(prefix)) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_ROUTE",
    `Exact material route ${projection.locale}/${projection.publicPath} is outside its subject namespace.`
  );
});

/** Rejects duplicate or retained source owners for one exact material path. */
const validateStoredSourceRoutes = Effect.fn(
  "contentRelease.validateStoredSourceRoutes"
)(function* (
  contentKey: string,
  locale: ContentLocale,
  publicPath: string,
  rows: readonly StoredSourceRoute[],
  source: string
) {
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `${source} ${locale}/${publicPath} has multiple owners.`
    );
  }
  const row = rows.at(0);
  if (!row || row.sourcePath === contentKey) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_ROUTE",
    `Exact material route ${locale}/${publicPath} conflicts with retained ${source.toLowerCase()}.`
  );
});

/** Rejects one material projection that collides with retained source routes. */
export const validateMaterialProjectionRoute = Effect.fn(
  "contentRelease.validateMaterialProjectionRoute"
)(function* (ctx: MutationCtx, projection: MaterialLessonProjection) {
  yield* validateMaterialRouteNamespace(projection);
  const [publicRoutes, contentRoutes] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("publicRoutes")
        .withIndex("by_locale_and_publicPath", (index) =>
          index
            .eq("locale", projection.locale)
            .eq("publicPath", projection.publicPath)
        )
        .take(2)
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_route", (index) =>
          index
            .eq("locale", projection.locale)
            .eq("route", projection.publicPath)
        )
        .take(2)
    ),
  ]);
  yield* Effect.all(
    [
      { label: "Source route", rows: publicRoutes },
      { label: "Content route", rows: contentRoutes },
    ].map(({ label, rows }) =>
      validateStoredSourceRoutes(
        projection.contentKey,
        projection.locale,
        projection.publicPath,
        rows,
        label
      )
    )
  );
});

/** Proves every exact route displaces only another selected source owner. */
export const validateExactMaterialRoutes = Effect.fn(
  "contentRelease.validateExactMaterialRoutes"
)(function* (
  ctx: MutationCtx,
  sequence: number,
  expected: readonly ExactMaterialOwner[]
) {
  const parents = new Map<string, string>();
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
    const decoded = yield* decodeProjectionJson(projection.projectionJson);
    if (decoded.kind !== "subject-lesson") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Exact material ${owner.contentKey}/${owner.locale} resolved a different family before activation.`
      );
    }
    const group = `${decoded.locale}\0${decoded.materialKey}`;
    const parentPath = parents.get(group);
    if (parentPath !== undefined && parentPath !== decoded.parentPath) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${decoded.locale}/${decoded.materialKey} would split one lesson group across parents.`
      );
    }
    parents.set(group, decoded.parentPath);
    yield* validateMaterialProjectionRoute(ctx, decoded);
  }
});
