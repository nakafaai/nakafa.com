import "server-only";
import type { ArticlePreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { PreviewReadySchema } from "@nakafa/aksara-contracts/preview/spec";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option, Schema } from "effect";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewCompileError,
  PreviewIntegrityError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";

/** Exact article route identity requested by the physical Next page. */
type ArticlePreviewInput = Pick<
  ArticlePreviewDocument["route"],
  "appLocale" | "publicPath"
>;
/** Authenticated local article rendered by the actual Nakafa application. */
export type ArticlePreviewContent = Effect.Success<
  ReturnType<typeof readReadyArticle>
>;
/** Checks whether one selected article owns the requested physical route. */
function matchesArticleRoute(
  document: ArticlePreviewDocument,
  input: ArticlePreviewInput
) {
  return (
    document.route.appLocale === input.appLocale &&
    document.route.publicPath === input.publicPath
  );
}
/** Authenticates and renders the exact ready article artifact. */
const readReadyArticle = Effect.fn("NakafaContent.readReadyArticle")(function* (
  manifest: typeof PreviewReadySchema.Type,
  document: ArticlePreviewDocument,
  config: PreviewConfig
) {
  const previewArtifact = manifest.artifacts[0];
  const projection = yield* Schema.decodeUnknownEffect(ArticleProjectionSchema)(
    previewArtifact.projection,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
  const rendered = yield* executePreviewArtifact({
    config,
    document,
    manifest,
    previewArtifact,
  });
  return {
    body: rendered.artifact.payload.rawMdx,
    categoryTitle: projection.categoryTitle,
    children: <rendered.Content />,
    contentId: projection.graph.assetId,
    metadata: projection.metadata,
    projection,
    references: projection.references,
  };
});
/** Reads a matching changed article before consulting persistent ownership. */
export const readArticlePreview = Effect.fn("NakafaContent.readArticlePreview")(
  function* (input: ArticlePreviewInput) {
    const snapshot = yield* readPreviewSnapshot();
    if (Option.isNone(snapshot)) {
      return Option.none<ArticlePreviewContent>();
    }
    const { config, manifest } = snapshot.value;
    const document = manifest.document;
    if (
      document.family !== "article" ||
      !matchesArticleRoute(document, input)
    ) {
      return Option.none<ArticlePreviewContent>();
    }
    if (manifest.status === "pending") {
      return yield* new PreviewPendingError({ revision: manifest.revision });
    }
    if (manifest.status === "failed") {
      return yield* new PreviewCompileError({
        code: manifest.failure.code,
        message: manifest.failure.message,
        revision: manifest.revision,
      });
    }
    return Option.some(yield* readReadyArticle(manifest, document, config));
  }
);
