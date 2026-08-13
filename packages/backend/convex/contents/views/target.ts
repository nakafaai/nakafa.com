import {
  type MaterialDomain,
  MaterialDomainSchema,
} from "@nakafa/aksara-contracts/material/domain";
import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import {
  MaterialKeySchema,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { resolveMaterialRoute } from "@repo/backend/convex/contentRelease/material/route";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
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

/** Exact browser route and stable identity required for a new view write. */
export type IncomingContentViewTargetInput = Pick<
  RecordContentViewArgs,
  "contentId" | "locale" | "publicPath" | "section"
>;

/** Durable identity required to hydrate current navigation facts. */
export type DurableContentViewTargetInput = Pick<
  RecordContentViewArgs,
  "contentId" | "locale" | "section"
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

/** Projects one authenticated article into durable engagement facts. */
function toArticleTarget(
  projection: ArticleProjection,
  sourcePath: string
): ContentViewTarget {
  return {
    ...projection.graph,
    contentKey: projection.contentKey,
    content_id: projection.graph.assetId,
    description: projection.metadata.description,
    kind: "article",
    locale: projection.locale,
    route: projection.publicPath,
    section: "articles",
    sourcePath,
    title: projection.metadata.title,
  };
}

/** Projects one authenticated material into durable engagement facts. */
const toMaterialTarget = Effect.fn("contents.views.toMaterialTarget")(
  function* (projection: MaterialLessonProjection, sourcePath: string) {
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
      sourcePath,
      title: projection.metadata.title,
    } satisfies ContentViewTarget;
  }
);

/** Validates one new material view against its exact signed public route. */
const validateIncomingMaterialTarget = Effect.fn(
  "contents.views.validateIncomingMaterialTarget"
)(function* (ctx: QueryCtx, input: IncomingContentViewTargetInput) {
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
  return yield* toMaterialTarget(projection, row.sourcePath);
});

/** Validates one new article view against its exact signed public route. */
const validateIncomingArticleTarget = Effect.fn(
  "contents.views.validateIncomingArticleTarget"
)(function* (ctx: QueryCtx, input: IncomingContentViewTargetInput) {
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
  return toArticleTarget(projection, resolved.sourcePath);
});

/** Resolves one material by its durable signed asset identity. */
const hydrateMaterialTarget = Effect.fn("contents.views.hydrateMaterialTarget")(
  function* (ctx: QueryCtx, input: DurableContentViewTargetInput) {
    const owner = yield* loadMaterialOwner(ctx, input.locale).pipe(
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active)) {
      return yield* toContentViewIoError(
        `Signed material ownership is unavailable for ${input.locale}.`
      );
    }
    const row = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_locale_and_assetId", (query) =>
            query.eq("locale", input.locale).eq("assetId", input.contentId)
          )
          .unique(),
      catch: toContentViewIoError,
    });
    if (!row) {
      return null;
    }
    const { projection, resolved } = yield* verifyEffectiveMaterial(
      ctx,
      row,
      owner.active.sequence
    ).pipe(Effect.mapError(toContentViewIoError));
    if (projection.graph.assetId !== input.contentId) {
      return null;
    }
    return yield* toMaterialTarget(projection, resolved.sourcePath);
  }
);

/** Resolves one article by its durable signed asset identity. */
const hydrateArticleTarget = Effect.fn("contents.views.hydrateArticleTarget")(
  function* (ctx: QueryCtx, input: DurableContentViewTargetInput) {
    const owner = yield* loadArticleOwner(ctx, input.locale).pipe(
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active)) {
      return yield* toContentViewIoError(
        `Signed article ownership is unavailable for ${input.locale}.`
      );
    }
    const row = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("articleCatalog")
          .withIndex("by_locale_and_assetId", (query) =>
            query.eq("locale", input.locale).eq("assetId", input.contentId)
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
    return toArticleTarget(projection, resolved.sourcePath);
  }
);

/** Validates a new content view against both its ID and current public path. */
export const validateIncomingContentTarget = Effect.fn(
  "contents.views.validateIncomingContentTarget"
)(function* (ctx: QueryCtx, input: IncomingContentViewTargetInput) {
  if (input.section === "material") {
    return yield* validateIncomingMaterialTarget(ctx, input);
  }
  return yield* validateIncomingArticleTarget(ctx, input);
});

/** Hydrates current route facts from one durable signed asset identity. */
export const hydrateDurableContentTarget = Effect.fn(
  "contents.views.hydrateDurableContentTarget"
)(function* (ctx: QueryCtx, input: DurableContentViewTargetInput) {
  if (input.section === "material") {
    return yield* hydrateMaterialTarget(ctx, input);
  }
  return yield* hydrateArticleTarget(ctx, input);
});
