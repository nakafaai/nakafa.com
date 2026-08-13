import {
  type MaterialDomain,
  MaterialDomainSchema,
} from "@nakafa/aksara-contracts/material/domain";
import { MaterialKeySchema } from "@nakafa/aksara-contracts/projection/material";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { resolveMaterialRoute } from "@repo/backend/convex/contentRelease/material/route";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import {
  type RecordContentViewArgs,
  toContentViewIoError,
} from "@repo/backend/convex/contents/views/spec";
import {
  localeValidator,
  materialDomainValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

const contentViewTargetValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  contentKey: v.string(),
  content_id: v.string(),
  description: v.optional(v.string()),
  kind: v.union(v.literal("article"), v.literal("curriculum-lesson")),
  locale: localeValidator,
  materialDomain: v.optional(materialDomainValidator),
  materialKey: v.optional(v.string()),
  parentPath: v.optional(v.string()),
  route: v.string(),
  section: v.union(v.literal("articles"), v.literal("material")),
  sourcePath: v.string(),
  title: v.string(),
});

type StoredContentViewTarget = Infer<typeof contentViewTargetValidator>;

/** Current verified route facts used by views, recents, and popularity. */
export type ContentViewTarget = Omit<
  StoredContentViewTarget,
  "materialDomain"
> & {
  readonly materialDomain?: MaterialDomain;
};

/** Stable current identity required to resolve a content-view target. */
export type ContentViewTargetInput = Pick<
  RecordContentViewArgs,
  "contentId" | "locale" | "publicPath" | "section"
>;

/** Reads the Aksara-owned domain from one authenticated material key. */
export const decodeMaterialDomain = Effect.fn(
  "contents.views.decodeMaterialDomain"
)(function* (materialKeyInput: unknown) {
  const materialKey = yield* Schema.decodeUnknown(MaterialKeySchema)(
    materialKeyInput
  ).pipe(Effect.mapError(toContentViewIoError));
  const [, materialDomainInput] = materialKey.split(".");

  return yield* Schema.decodeUnknown(MaterialDomainSchema)(
    materialDomainInput
  ).pipe(Effect.mapError(toContentViewIoError));
});

/** Resolves one current material from its exact signed public route. */
const readMaterialTarget = Effect.fn("contents.views.readMaterialTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    const resolved = yield* resolveMaterialRoute(
      ctx,
      input.locale,
      input.publicPath
    ).pipe(Effect.mapError(toContentViewIoError));
    if (!resolved.managed) {
      return yield* toContentViewIoError(
        `Signed material ownership is unavailable for ${input.locale}.`
      );
    }
    if (!resolved.material) {
      return null;
    }
    const { projection, row } = resolved.material;
    if (projection.graph.assetId !== input.contentId) {
      return null;
    }
    const materialDomain = yield* decodeMaterialDomain(projection.materialKey);
    return {
      ...projection.graph,
      contentKey: projection.contentKey,
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
    } satisfies ContentViewTarget;
  }
);

/** Resolves one current article from its exact signed public route. */
const readArticleTarget = Effect.fn("contents.views.readArticleTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    const owner = yield* loadArticleOwner(ctx, input.locale).pipe(
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active)) {
      return yield* toContentViewIoError(
        `Signed article ownership is unavailable for ${input.locale}.`
      );
    }
    const binding = yield* loadRouteBinding(
      ctx,
      input.locale,
      input.publicPath,
      owner.active.sequence
    ).pipe(Effect.mapError(toContentViewIoError));
    if (binding?.operation !== "bind" || !binding.contentKey) {
      return null;
    }
    const contentKey = binding.contentKey;
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
      return null;
    }
    const { projection, resolved } = yield* verifyArticle(
      ctx,
      row,
      owner.active.sequence
    ).pipe(Effect.mapError(toContentViewIoError));
    if (projection.graph.assetId !== input.contentId) {
      return null;
    }
    return {
      ...projection.graph,
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      description: projection.metadata.description,
      kind: "article",
      locale: projection.locale,
      route: projection.publicPath,
      section: "articles",
      sourcePath: resolved.sourcePath,
      title: projection.metadata.title,
    } satisfies ContentViewTarget;
  }
);

/** Resolves one current signed content-view target without fallback. */
export const loadContentTarget = Effect.fn("contents.views.loadContentTarget")(
  function* (ctx: QueryCtx, input: ContentViewTargetInput) {
    if (input.section === "material") {
      return yield* readMaterialTarget(ctx, input);
    }
    return yield* readArticleTarget(ctx, input);
  }
);
