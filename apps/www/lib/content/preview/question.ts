import "server-only";

import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import {
  previewDocumentRoute,
  type QuestionAnswerPreviewDocument,
  type QuestionPromptPreviewDocument,
} from "@nakafa/aksara-contracts/preview/document";
import type {
  LocalPreviewManifest,
  PreviewArtifact,
} from "@nakafa/aksara-contracts/preview/spec";
import type { TryoutPreviewTarget } from "@nakafa/aksara-contracts/preview/target";
import {
  QuestionAnswerProjectionSchema,
  type QuestionChoiceList,
  type QuestionMetadata,
  QuestionPromptProjectionSchema,
} from "@nakafa/aksara-contracts/projection/question";
import { Effect, Option, Schema } from "effect";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewCompileError,
  PreviewIntegrityError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import type { RenderableContent } from "@/lib/content/published/artifact";

type QuestionPreviewDocument =
  | QuestionAnswerPreviewDocument
  | QuestionPromptPreviewDocument;

type ReadyPreviewManifest = Extract<
  LocalPreviewManifest,
  { readonly status: "ready" }
>;

/** Exact try-out route identity requested by one Next server boundary. */
export interface QuestionPreviewInput {
  readonly appLocale: AppLocale;
  readonly publicPath: string;
}

/** Authenticated prompt and optional answer rendered by the actual Nakafa app. */
export interface QuestionPreviewContent {
  readonly Answer: RenderableContent["Content"] | null;
  readonly appLocale: AppLocale;
  readonly choices: QuestionChoiceList;
  readonly metadata: QuestionMetadata;
  readonly Question: RenderableContent["Content"];
  readonly selectedBodyKind: QuestionPreviewDocument["identity"]["bodyKind"];
  readonly target: TryoutPreviewTarget;
}

/** Decodes one prompt projection without leaking a generic parse failure. */
function decodePromptProjection(artifact: PreviewArtifact) {
  return Schema.decodeUnknown(QuestionPromptProjectionSchema)(
    artifact.projection,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
}

/** Decodes one answer projection without weakening the manifest contract. */
function decodeAnswerProjection(artifact: PreviewArtifact) {
  return Schema.decodeUnknown(QuestionAnswerProjectionSchema)(
    artifact.projection,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
}

/** Authenticates and executes an exact manifest-owned artifact reference. */
function executeArtifact(
  config: PreviewConfig,
  document: QuestionPreviewDocument,
  manifest: ReadyPreviewManifest,
  previewArtifact: PreviewArtifact
) {
  return executePreviewArtifact({
    config,
    document,
    manifest,
    previewArtifact,
  });
}

/** Authenticates one ready prompt or the ordered prompt-answer closure. */
const readReadyQuestion = Effect.fn("NakafaContent.readReadyQuestionPreview")(
  function* (
    manifest: ReadyPreviewManifest,
    document: QuestionPreviewDocument,
    config: PreviewConfig
  ) {
    const promptArtifact = manifest.artifacts[0];
    const promptProjection = yield* decodePromptProjection(promptArtifact);
    const renderedPrompt = yield* executeArtifact(
      config,
      document,
      manifest,
      promptArtifact
    );

    if (document.identity.bodyKind === "question") {
      return {
        Answer: null,
        Question: renderedPrompt.Content,
        appLocale: document.target.section.appLocale,
        choices: promptProjection.choices,
        metadata: promptProjection.metadata,
        selectedBodyKind: document.identity.bodyKind,
        target: document.target,
      } satisfies QuestionPreviewContent;
    }

    const answerArtifact = manifest.artifacts[1];
    if (answerArtifact === undefined) {
      return yield* new PreviewIntegrityError({ check: "artifact" });
    }
    yield* decodeAnswerProjection(answerArtifact);
    const renderedAnswer = yield* executeArtifact(
      config,
      document,
      manifest,
      answerArtifact
    );

    return {
      Answer: renderedAnswer.Content,
      Question: renderedPrompt.Content,
      appLocale: document.target.section.appLocale,
      choices: promptProjection.choices,
      metadata: promptProjection.metadata,
      selectedBodyKind: document.identity.bodyKind,
      target: document.target,
    } satisfies QuestionPreviewContent;
  }
);

/** Reports whether one selected question owns the requested public route. */
function matchesQuestionRoute(
  document: QuestionPreviewDocument,
  input: QuestionPreviewInput
) {
  const route = previewDocumentRoute(document);
  return (
    route.appLocale === input.appLocale && route.publicPath === input.publicPath
  );
}

/** Reads a matching local question before any published catalog lookup. */
export const readQuestionPreview = Effect.fn(
  "NakafaContent.readQuestionPreview"
)(function* (input: QuestionPreviewInput) {
  const snapshot = yield* readPreviewSnapshot();
  if (Option.isNone(snapshot)) {
    return Option.none<QuestionPreviewContent>();
  }

  const { config, manifest } = snapshot.value;
  const document = manifest.document;
  if (
    document.family !== "question" ||
    !matchesQuestionRoute(document, input)
  ) {
    return Option.none<QuestionPreviewContent>();
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

  return Option.some(yield* readReadyQuestion(manifest, document, config));
});
