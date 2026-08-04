import "server-only";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readContent } from "@repo/backend/client/content/read";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { verifyContentRenderer } from "@repo/backend/content/verify";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import type {
  TryoutAnswerContent,
  TryoutAnswerSelector,
  TryoutQuestionContent,
  TryoutQuestionSelector,
} from "@/components/tryout/content/model";
import { env } from "@/env";
import { applyPublishedContentCache } from "@/lib/content/cache";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { getRendererComponents } from "@/lib/content/renderer/components";
import { rendererManifest } from "@/lib/content/renderer/manifest";

type ProtectedSelector = TryoutAnswerSelector | TryoutQuestionSelector;
const SIGNED_RENDER_CONCURRENCY = 4;

/** Renders protected questions and answers under one shared transport budget. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (input: {
  readonly answers: readonly TryoutAnswerSelector[];
  readonly questions: readonly TryoutQuestionSelector[];
}) {
  const entries = yield* renderSignedSelectors([
    ...input.questions,
    ...input.answers,
  ]);
  const questionEntries = entries.slice(0, input.questions.length);
  const answerEntries = entries.slice(input.questions.length);
  const questions = questionEntries.map(
    ({ body, contentHash, sourcePath, sourceRevision }) =>
      ({
        content: body,
        contentHash,
        sourcePath,
        sourceRevision,
      }) satisfies TryoutQuestionContent
  );
  const answers = answerEntries.map(
    ({ body, contentHash, sourcePath, sourceRevision }) =>
      ({
        answer: body,
        contentHash,
        sourcePath,
        sourceRevision,
      }) satisfies TryoutAnswerContent
  );
  return { answers, questions };
});

/** Renders protected selectors with a bounded shared transport budget. */
const renderSignedSelectors = Effect.fn("NakafaContent.renderSignedTryout")(
  (selectors: readonly ProtectedSelector[]) =>
    Effect.forEach(
      selectors,
      (selector) =>
        Effect.tryPromise({
          catch: (cause) => new ContentRuntimeVerificationError({ cause }),
          try: () => renderSignedContent(selector),
        }),
      { concurrency: SIGNED_RENDER_CONCURRENCY }
    )
);

/** Caches one verified JSX body under its exact signed artifact identity. */
async function renderSignedContent(selector: ProtectedSelector) {
  "use cache";

  const content = await Effect.runPromise(readSignedContent(selector));
  applyPublishedContentCache("question", content.artifactHash);
  return content;
}

/** Reads, verifies, and executes one protected signed artifact. */
export const readSignedContent = Effect.fn("NakafaContent.readSignedTryout")(
  function* (selector: ProtectedSelector) {
    const runtimeKeys = yield* Effect.try({
      catch: () =>
        new ContentRuntimeConfigurationError({
          key: "CONTENT_RUNTIME_TOKEN",
        }),
      try: contentRuntimeKeys,
    });
    const found = yield* readContent(
      {
        siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
        token: runtimeKeys.CONTENT_RUNTIME_TOKEN,
      },
      {
        artifactHash: selector.artifactHash,
        contentKey: selector.contentKey,
        delivery: selector.delivery,
        locale: selector.locale,
        snapshotId: selector.snapshotId,
        snapshotReleaseId: selector.snapshotReleaseId,
      }
    );
    if (found.delivery === "public") {
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content request returned public delivery.",
      });
    }

    const liveRenderer = yield* rendererManifest;
    yield* verifyContentRenderer({
      found,
      rendererManifest: liveRenderer,
    });
    const components = getRendererComponents(
      found.artifact.payload.rendererDomain
    );
    const rendered = yield* executeSignedArtifact({
      artifact: found.artifact,
      components,
      rendererContractVersion: found.rendererManifest.rendererContractVersion,
      rendererManifest: found.rendererManifest,
    }).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    );

    return {
      artifactHash: rendered.artifact.artifactHash,
      body: <rendered.Content />,
      contentHash: selector.contentHash,
      sourcePath: selector.sourcePath,
      sourceRevision: selector.sourceRevision,
    };
  }
);
