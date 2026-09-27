import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import {
  MaterialKeySchema,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { loadRouteBinding } from "@repo/backend/confect/contentRelease/model";
import { learningGraphIdentityValidator } from "@repo/backend/confect/contents/graph";
import {
  type RecordContentViewArgs,
  toContentViewIoError,
} from "@repo/backend/confect/contents/views/spec";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { articleLayer } from "@repo/backend/content/article/confect";
import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { verifyArticle } from "@repo/backend/content/article/verify";
import { materialLayer } from "@repo/backend/content/material/confect";
import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { resolveMaterialRoute } from "@repo/backend/content/material/route";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { Effect, flow, Schema } from "effect";

const contentViewTargetFields = {
  ...learningGraphIdentityValidator.fields,
  contentKey: Schema.String,
  content_id: Schema.String,
  description: Schema.optionalKey(Schema.String),
  locale: localeValidator,
  route: Schema.String,
  sourcePath: Schema.String,
  title: Schema.String,
};
const contentViewTargetValidator = Schema.Union([
  Schema.Struct({
    ...contentViewTargetFields,
    kind: Schema.Literal("article"),
    section: Schema.Literal("articles"),
  }),
  Schema.Struct({
    ...contentViewTargetFields,
    kind: Schema.Literal("curriculum-lesson"),
    section: Schema.Literal("material"),
    materialDomain: MaterialDomainSchema,
    materialKey: MaterialKeySchema,
    parentPath: Schema.String,
  }),
]);
/** Current verified route facts used by views, recents, and popularity. */
export type ContentViewTarget = Schema.Schema.Type<
  typeof contentViewTargetValidator
>;
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
  const materialKey =
    yield* Schema.decodeUnknownEffect(MaterialKeySchema)(materialKeyInput);
  const [, materialDomainInput] = materialKey.split(".");
  return yield* Schema.decodeEffect(MaterialDomainSchema)(materialDomainInput);
}, Effect.mapError(toContentViewIoError));
/** Projects one authenticated article into durable engagement facts. */
function toArticleTarget(
  projection: ArticleProjection,
  locale: IncomingContentViewTargetInput["locale"],
  sourcePath: string
) {
  return {
    ...projection.graph,
    contentKey: projection.contentKey,
    content_id: projection.graph.assetId,
    ...(projection.metadata.description === undefined
      ? {}
      : {
          description: projection.metadata.description,
        }),
    kind: "article",
    locale,
    route: projection.publicPath,
    section: "articles",
    sourcePath,
    title: projection.metadata.title,
  } satisfies ContentViewTarget;
}
/** Projects one authenticated material into durable engagement facts. */
const toMaterialTarget = Effect.fn("contents.views.toMaterialTarget")(
  function* (
    projection: MaterialLessonProjection,
    locale: IncomingContentViewTargetInput["locale"],
    sourcePath: string
  ) {
    const materialDomain = yield* decodeMaterialDomain(projection.materialKey);
    return {
      ...projection.graph,
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      ...(projection.metadata.description === undefined
        ? {}
        : {
            description: projection.metadata.description,
          }),
      kind: "curriculum-lesson",
      locale,
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
)(function* (input: IncomingContentViewTargetInput) {
  const resolved = yield* resolveMaterialRoute(
    input.locale,
    input.publicPath
  ).pipe(Effect.provide(materialLayer), Effect.mapError(toContentViewIoError));
  if (!resolved.managed) {
    return yield* toContentViewIoError(
      `Signed material ownership is unavailable for ${input.locale}.`
    );
  }
  if (!resolved.material) {
    return null;
  }
  const { projection, row } = resolved.material;
  if (
    projection.graph.assetId !== input.contentId ||
    projection.publicPath !== input.publicPath
  ) {
    return null;
  }
  return yield* toMaterialTarget(projection, input.locale, row.sourcePath);
});
/** Validates one new article view against its exact signed public route. */
const validateIncomingArticleTarget = Effect.fn(
  "contents.views.validateIncomingArticleTarget"
)(
  function* (input: IncomingContentViewTargetInput) {
    const database = yield* DatabaseReader;
    const owner = yield* loadArticleOwner(input.locale).pipe(
      Effect.provide(articleLayer),
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active && owner.slot)) {
      return yield* toContentViewIoError(
        `Signed article ownership is unavailable for ${input.locale}.`
      );
    }
    const binding = yield* loadRouteBinding(
      input.locale,
      input.publicPath,
      owner.active.sequence
    ).pipe(Effect.mapError(toContentViewIoError));
    if (binding?.operation !== "bind" || !binding.contentKey) {
      return null;
    }
    const contentKey = binding.contentKey;
    const row = yield* database
      .table("articleCatalog")
      .get(
        "by_slot_and_contentKey_and_appLocale",
        owner.slot,
        contentKey,
        input.locale
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!row) {
      return null;
    }
    const { projection, resolved } = yield* verifyArticle(
      row,
      owner.active.sequence
    ).pipe(Effect.provide(articleLayer), Effect.mapError(toContentViewIoError));
    if (
      projection.graph.assetId !== input.contentId ||
      projection.publicPath !== input.publicPath
    ) {
      return null;
    }
    return toArticleTarget(projection, input.locale, resolved.sourcePath);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);
/** Resolves one material by its durable signed asset identity. */
export const hydrateMaterialTarget = Effect.fn(
  "contents.views.hydrateMaterialTarget"
)(
  function* (input: Omit<DurableContentViewTargetInput, "section">) {
    const database = yield* DatabaseReader;
    const owner = yield* loadMaterialOwner(input.locale).pipe(
      Effect.provide(publicationLayer),
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active && owner.slot)) {
      return yield* toContentViewIoError(
        `Signed material ownership is unavailable for ${input.locale}.`
      );
    }
    const row = yield* database
      .table("materialCatalog")
      .get(
        "by_slot_and_appLocale_and_assetId",
        owner.slot,
        input.locale,
        input.contentId
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!row) {
      return null;
    }
    const { projection, resolved } = yield* verifyEffectiveMaterial(
      row,
      owner.active.sequence
    ).pipe(
      Effect.provide(publicationLayer),
      Effect.mapError(toContentViewIoError)
    );
    return yield* toMaterialTarget(
      projection,
      input.locale,
      resolved.sourcePath
    );
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);
/** Resolves one article by its durable signed asset identity. */
const hydrateArticleTarget = Effect.fn("contents.views.hydrateArticleTarget")(
  function* (input: DurableContentViewTargetInput) {
    const database = yield* DatabaseReader;
    const owner = yield* loadArticleOwner(input.locale).pipe(
      Effect.provide(articleLayer),
      Effect.mapError(toContentViewIoError)
    );
    if (!(owner.managed && owner.active && owner.slot)) {
      return yield* toContentViewIoError(
        `Signed article ownership is unavailable for ${input.locale}.`
      );
    }
    const row = yield* database
      .table("articleCatalog")
      .get(
        "by_slot_and_appLocale_and_assetId",
        owner.slot,
        input.locale,
        input.contentId
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!row) {
      return null;
    }
    const { projection, resolved } = yield* verifyArticle(
      row,
      owner.active.sequence
    ).pipe(Effect.provide(articleLayer), Effect.mapError(toContentViewIoError));
    return toArticleTarget(projection, input.locale, resolved.sourcePath);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);
/** Validates a new content view against both its ID and current public path. */
export const validateIncomingContentTarget = Effect.fn(
  "contents.views.validateIncomingContentTarget"
)(function* (input: IncomingContentViewTargetInput) {
  if (input.section === "material") {
    return yield* validateIncomingMaterialTarget(input);
  }
  return yield* validateIncomingArticleTarget(input);
});
/** Hydrates current route facts from one durable signed asset identity. */
export const hydrateDurableContentTarget = Effect.fn(
  "contents.views.hydrateDurableContentTarget"
)(function* (input: DurableContentViewTargetInput) {
  if (input.section === "material") {
    return yield* hydrateMaterialTarget(input);
  }
  return yield* hydrateArticleTarget(input);
});
