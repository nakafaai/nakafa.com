import "server-only";

import type { PagePreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import {
  type PublicPageProjection,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
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

/** Exact public Page identity requested by the physical Next route. */
export interface PagePreviewInput {
  readonly appLocale: PagePreviewDocument["route"]["appLocale"];
  readonly publicPath: PagePreviewDocument["route"]["publicPath"];
}

/** Authenticated local Page content rendered by the Nakafa application. */
export interface PagePreviewContent {
  readonly body: ReactNode;
  readonly projection: PublicPageProjection;
}

/** Checks whether one selected Page owns the requested physical route. */
function matchesPageRoute(
  document: PagePreviewDocument,
  input: PagePreviewInput
) {
  return (
    document.route.appLocale === input.appLocale &&
    document.route.publicPath === input.publicPath
  );
}

/** Proves the compiled projection still matches its selected source owner. */
function matchesPageProjection(
  document: PagePreviewDocument,
  projection: PublicPageProjection
) {
  const route = document.route;
  return (
    projection.appLocale === route.appLocale &&
    projection.artifactLocale === route.artifactLocale &&
    projection.contentKey === route.contentKey &&
    projection.pageKey === route.pageKey &&
    projection.publicPath === route.publicPath
  );
}

/** Authenticates and renders the exact ready Page artifact. */
const readReadyPage = Effect.fn("NakafaContent.readReadyPage")(function* (
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>,
  document: PagePreviewDocument,
  config: PreviewConfig
) {
  const previewArtifact = manifest.artifacts[0];
  const projection = yield* Schema.decodeUnknownEffect(
    PublicPageProjectionSchema
  )(previewArtifact.projection, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
  if (!matchesPageProjection(document, projection)) {
    return yield* new PreviewIntegrityError({ check: "projection" });
  }
  const rendered = yield* executePreviewArtifact({
    config,
    document,
    manifest,
    previewArtifact,
  });
  return {
    body: <rendered.Content />,
    projection,
  } satisfies PagePreviewContent;
});

/** Reads a matching changed Page before consulting persistent ownership. */
export const readPagePreview = Effect.fn("NakafaContent.readPagePreview")(
  function* (input: PagePreviewInput) {
    const snapshot = yield* readPreviewSnapshot();
    if (Option.isNone(snapshot)) {
      return Option.none<PagePreviewContent>();
    }
    const { config, manifest } = snapshot.value;
    const document = manifest.document;
    if (document.family !== "page" || !matchesPageRoute(document, input)) {
      return Option.none<PagePreviewContent>();
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
    return Option.some(yield* readReadyPage(manifest, document, config));
  }
);
