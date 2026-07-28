import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import {
  type RecordContentViewArgs,
  toContentViewIoError,
} from "@repo/backend/convex/contents/views/spec";
import {
  localeValidator,
  type Material,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { SUBJECT_MATERIALS } from "@repo/contents/_types/taxonomy";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect } from "effect";

const contentViewTargetValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  content_id: v.string(),
  description: v.optional(v.string()),
  kind: literals(...CONTENT_ROUTE_KINDS),
  locale: localeValidator,
  materialDomain: v.optional(materialValidator),
  materialKey: v.optional(v.string()),
  parentPath: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
  sourcePath: v.string(),
  title: v.string(),
});

/** Current verified route facts used by views, recents, and popularity. */
export type ContentViewTarget = Infer<typeof contentViewTargetValidator>;

/** Stable identity used to resolve a current content-view target. */
export type ContentViewTargetInput = Pick<
  RecordContentViewArgs,
  "contentId" | "locale" | "section"
> & {
  readonly publicPath?: string;
};

/** Reads the source-owned material domain from one stable material key. */
function readMaterialDomain(materialKey: string): Material | undefined {
  const identity = materialKey.slice("lesson.".length);
  const separator = identity.indexOf(".");
  if (separator < 1) {
    return;
  }
  const domain = identity.slice(0, separator);
  return SUBJECT_MATERIALS.find((candidate) => candidate === domain);
}

/** Resolves one active material by exact route or stable graph identity. */
const readMaterialTarget = Effect.fn("contents.views.readMaterialTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    const owner = yield* loadMaterialOwner(ctx, input.locale).pipe(
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active)) {
      return { managed: false, target: null };
    }
    const publicPath = input.publicPath;
    const row = yield* Effect.tryPromise({
      try: () =>
        publicPath
          ? ctx.db
              .query("materialCatalog")
              .withIndex("by_locale_and_publicPath", (query) =>
                query.eq("locale", input.locale).eq("publicPath", publicPath)
              )
              .unique()
          : ctx.db
              .query("materialCatalog")
              .withIndex("by_locale_and_assetId", (query) =>
                query.eq("locale", input.locale).eq("assetId", input.contentId)
              )
              .unique(),
      catch: toContentViewIoError,
    });
    if (!row) {
      return { managed: true, target: null };
    }
    const { projection } = yield* verifyMaterial(row).pipe(
      Effect.mapError(toContentViewIoError)
    );
    const materialDomain = readMaterialDomain(projection.materialKey);
    if (
      projection.graph.assetId !== input.contentId ||
      materialDomain === undefined
    ) {
      return { managed: true, target: null };
    }
    return {
      managed: true,
      target: {
        ...projection.graph,
        content_id: projection.graph.assetId,
        description: projection.metadata.description,
        kind: "curriculum-lesson",
        locale: projection.locale,
        materialDomain,
        materialKey: projection.materialKey,
        parentPath: projection.parentPath,
        route: projection.publicPath,
        section: "material",
        sourcePath: row.sourcePath,
        title: projection.metadata.title,
      } satisfies ContentViewTarget,
    };
  }
);

/** Resolves one active article through its canonical published route. */
const readArticleTarget = Effect.fn("contents.views.readArticleTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    const owner = yield* loadArticleOwner(ctx, input.locale).pipe(
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active)) {
      return { managed: false, target: null };
    }
    if (!input.publicPath) {
      return { managed: true, target: null };
    }
    const publicPath = input.publicPath;
    const binding = yield* loadRouteBinding(
      ctx,
      input.locale,
      publicPath,
      owner.active.sequence
    ).pipe(Effect.mapError(toContentViewIoError));
    const contentKey =
      binding?.operation === "bind" ? binding.contentKey : undefined;
    if (!contentKey) {
      return { managed: true, target: null };
    }
    const row = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("articleCatalog")
          .withIndex("by_contentKey_and_locale", (query) =>
            query.eq("contentKey", contentKey).eq("locale", input.locale)
          )
          .unique(),
      catch: toContentViewIoError,
    });
    if (!row) {
      return { managed: true, target: null };
    }
    const { projection, resolved } = yield* verifyArticle(
      ctx,
      row,
      owner.active.sequence
    ).pipe(Effect.mapError(toContentViewIoError));
    if (projection.graph.assetId !== input.contentId) {
      return { managed: true, target: null };
    }
    return {
      managed: true,
      target: {
        ...projection.graph,
        content_id: projection.graph.assetId,
        description: projection.metadata.description,
        kind: "article",
        locale: projection.locale,
        route: projection.publicPath,
        section: "articles",
        sourcePath: resolved.sourcePath,
        title: projection.metadata.title,
      } satisfies ContentViewTarget,
    };
  }
);

/** Resolves one source-owned route while its family remains unmanaged. */
const readSourceTarget = Effect.fn("contents.views.readSourceTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    const publicPath = input.publicPath;
    const routeAtPath = publicPath
      ? yield* Effect.tryPromise({
          try: () =>
            ctx.db
              .query("contentRoutes")
              .withIndex("by_locale_and_route", (query) =>
                query.eq("locale", input.locale).eq("route", publicPath)
              )
              .unique(),
          catch: toContentViewIoError,
        })
      : null;
    const route =
      routeAtPath ??
      (yield* Effect.tryPromise({
        try: () =>
          ctx.db
            .query("contentRoutes")
            .withIndex("by_content_id", (query) =>
              query.eq("content_id", input.contentId)
            )
            .unique(),
        catch: toContentViewIoError,
      }));
    if (
      !route ||
      route.content_id !== input.contentId ||
      route.assetId !== input.contentId ||
      route.locale !== input.locale ||
      route.section !== input.section ||
      !(
        route.kind === "article" ||
        route.kind === "curriculum-lesson" ||
        route.kind === "tryout-set"
      )
    ) {
      return null;
    }
    return {
      alignmentId: route.alignmentId,
      assetId: route.assetId,
      conceptId: route.conceptId,
      content_id: route.content_id,
      description: route.description,
      kind: route.kind,
      learningObjectId: route.learningObjectId,
      lensId: route.lensId,
      locale: route.locale,
      materialDomain: route.materialDomain,
      route: route.route,
      section: route.section,
      sourcePath: route.sourcePath,
      title: route.title,
    } satisfies ContentViewTarget;
  }
);

/** Resolves the current family-owned target without reviving deleted content. */
export const loadContentTarget = Effect.fn("contents.views.loadContentTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    if (input.section === "material") {
      const material = yield* readMaterialTarget(ctx, input);
      if (material.managed) {
        return material.target;
      }
    }
    if (input.section === "articles") {
      const article = yield* readArticleTarget(ctx, input);
      if (article.managed) {
        return article.target;
      }
    }
    return yield* readSourceTarget(ctx, input);
  }
);
