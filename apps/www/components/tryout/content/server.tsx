import "server-only";

import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { readTryoutContent } from "@repo/backend/client/content/tryout";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";
import { createElement } from "react";
import type {
  TryoutContentRoute,
  TryoutRenderedContent,
} from "@/components/tryout/content/model";
import { resolveTryoutComponents } from "@/components/tryout/content/registry";
import { env } from "@/env";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { rendererManifest } from "@/lib/content/renderer/manifest";

/** Executes one trusted artifact with its physical route-domain registry. */
const renderArtifact = Effect.fn("www.tryout.renderArtifact")(function* (
  artifact: SignedContentArtifact,
  manifest: Effect.Effect.Success<typeof rendererManifest>
) {
  const components = yield* resolveTryoutComponents(
    artifact.payload.rendererDomain
  );
  const rendered = yield* executeSignedArtifact({
    artifact,
    components,
    rendererContractVersion: manifest.rendererContractVersion,
    rendererManifest: manifest,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
  );

  return createElement(rendered.Content);
});

/** Reads and renders one user's frozen section without filesystem fallback. */
export const loadTryoutContent = Effect.fn("www.tryout.loadContent")(function* (
  userToken: string,
  route: TryoutContentRoute
) {
  const found = yield* readTryoutContent(
    {
      siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
      token: env.CONTENT_RUNTIME_TOKEN,
      userToken,
    },
    route
  );
  if (!found) {
    return {
      answers: [],
      questions: [],
    } satisfies TryoutRenderedContent;
  }

  const manifest = yield* rendererManifest;
  const entries = yield* Effect.forEach(found.artifacts, (entry) =>
    Effect.gen(function* () {
      const content = yield* renderArtifact(entry.questionArtifact, manifest);
      const answer = entry.answerArtifact
        ? yield* renderArtifact(entry.answerArtifact, manifest)
        : null;

      return {
        answer,
        content,
        placementId: entry.placementId,
      };
    })
  );

  return {
    answers: entries.flatMap(({ answer, placementId }) =>
      answer === null ? [] : [{ answer, placementId }]
    ),
    questions: entries.map(({ content, placementId }) => ({
      content,
      placementId,
    })),
  } satisfies TryoutRenderedContent;
});
