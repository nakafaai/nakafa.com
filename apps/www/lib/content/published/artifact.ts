import "server-only";

import { run } from "@mdx-js/mdx";
import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import type {
  RendererContractVersion,
  RendererManifestEnvelope,
} from "@nakafa/aksara-contracts/renderer/contract";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect } from "effect";
import type { ComponentType } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ContentExecutionError } from "@/lib/content/published/errors";

/** Inputs required to authenticate and execute one trusted content artifact. */
interface ExecuteArtifactInput {
  readonly artifact: unknown;
  readonly components: MDXComponents;
  readonly rendererContractVersion: RendererContractVersion;
  readonly rendererManifest: RendererManifestEnvelope;
}

interface EvaluateArtifactInput {
  readonly artifact: SignedContentArtifact;
  readonly components: MDXComponents;
}

/** Authenticated module and projections consumed by a Nakafa route shell. */
export interface RenderableContent {
  readonly artifact: SignedContentArtifact;
  readonly Content: ComponentType;
}

/** Evaluates an artifact already authenticated by its owning runtime boundary. */
export const evaluateVerifiedArtifact = Effect.fn(
  "NakafaContent.evaluateVerifiedArtifact"
)(function* (input: EvaluateArtifactInput) {
  const module = yield* Effect.tryPromise({
    catch: () =>
      new ContentExecutionError({
        contentKey: input.artifact.payload.contentKey,
        stage: "evaluate",
      }),
    try: () =>
      run(input.artifact.payload.compiledCode, {
        Fragment,
        jsx,
        jsxs,
        useMDXComponents: () => input.components,
      }),
  });

  if (typeof module.default !== "function") {
    return yield* new ContentExecutionError({
      contentKey: input.artifact.payload.contentKey,
      stage: "module",
    });
  }

  return {
    Content: module.default,
    artifact: input.artifact,
  } satisfies RenderableContent;
});

/**
 * Authenticates standalone reviewed MDX before server-only evaluation.
 *
 * Callers must provide a `ContentVerificationKeyResolver` layer. The compiler
 * forbids imports, so runtime evaluation intentionally omits `baseUrl`.
 */
export const executeSignedArtifact = Effect.fn(
  "NakafaContent.executeSignedArtifact"
)(function* (input: ExecuteArtifactInput) {
  const artifact = yield* verifySignedContentArtifact({
    artifact: input.artifact,
    rendererContractVersion: input.rendererContractVersion,
    rendererManifest: input.rendererManifest,
  });
  return yield* evaluateVerifiedArtifact({
    artifact,
    components: input.components,
  });
});
