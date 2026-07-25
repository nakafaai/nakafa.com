import "server-only";

import type { ArticlePreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import {
  type ArticleMetadata,
  ArticleProjectionSchema,
  type ArticleReference,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewCompileError,
  PreviewIntegrityError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";

/** Exact article route identity requested by the physical Next page. */
export interface ArticlePreviewInput {
  readonly locale: ArticlePreviewDocument["route"]["locale"];
  readonly publicPath: ArticlePreviewDocument["route"]["publicPath"];
}

/** Authenticated local article rendered by the actual Nakafa application. */
export interface ArticlePreviewContent {
  readonly body: string;
  readonly categoryTitle: string;
  readonly children: ReactNode;
  readonly metadata: ArticleMetadata;
  readonly references: readonly ArticleReference[];
}

/** Checks whether one selected article owns the requested physical route. */
function matchesArticleRoute(
  document: ArticlePreviewDocument,
  input: ArticlePreviewInput
) {
  return (
    document.route.locale === input.locale &&
    document.route.publicPath === input.publicPath
  );
}

/** Authenticates and renders the exact ready article artifact. */
const readReadyArticle = Effect.fn("NakafaContent.readReadyArticle")(function* (
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>,
  document: ArticlePreviewDocument,
  config: PreviewConfig
) {
  const projection = yield* Schema.decodeUnknown(ArticleProjectionSchema)(
    manifest.artifacts[0].projection,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
  const rendered = yield* executePreviewArtifact({
    config,
    document,
    manifest,
    projection,
  });

  return {
    body: rendered.artifact.payload.rawMdx,
    categoryTitle: projection.categoryTitle,
    children: <rendered.Content />,
    metadata: projection.metadata,
    references: projection.references,
  } satisfies ArticlePreviewContent;
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
