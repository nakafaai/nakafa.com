import "server-only";

// Only Aksara artifacts that pass exact schema, hash, source, Ed25519 signature,
// and renderer compatibility verification reach `run()` below.
// https://github.com/nakafaai/aksara/blob/contracts-v0.12.0/packages/contracts/src/artifact/verify.ts#L9-L37
// https://github.com/nakafaai/aksara/blob/contracts-v0.12.0/packages/contracts/src/artifact/integrity.ts#L56-L92
// The pinned compiler records and rejects imports and re-exports before publication.
// https://github.com/nakafaai/aksara/blob/contracts-v0.12.0/packages/compiler/src/policy.ts#L206-L222
// https://github.com/nakafaai/aksara/blob/contracts-v0.12.0/packages/compiler/src/engine.ts#L201-L205
// MDX documents `run()` as the execution API for already-compiled code.
// https://mdxjs.com/packages/mdx/#run
// react-doctor-disable-next-line react-doctor/mdx-ssr-execution-risk
import { run } from "@mdx-js/mdx";
import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import type { StoredProtectedRuntimeItem } from "@nakafa/aksara-contracts/history/decode";
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

interface EvaluateHistoricalArtifactInput {
  readonly artifact: StoredProtectedRuntimeItem["artifact"];
  readonly components: MDXComponents;
}

interface EvaluateCompiledCodeInput {
  readonly compiledCode: string;
  readonly components: MDXComponents;
  readonly contentKey: SignedContentArtifact["payload"]["contentKey"];
}

/** Authenticated module and projections consumed by a Nakafa route shell. */
export interface RenderableContent {
  readonly artifact: SignedContentArtifact;
  readonly Content: ComponentType;
}

/** Authenticated historical module retaining its exact immutable wire type. */
interface RenderableHistoricalContent {
  readonly artifact: StoredProtectedRuntimeItem["artifact"];
  readonly Content: ComponentType;
}

/** Evaluates already-authenticated compiled code without changing its schema. */
const evaluateCompiledCode = Effect.fn("NakafaContent.evaluateCompiledCode")(
  function* (input: EvaluateCompiledCodeInput) {
    const module = yield* Effect.tryPromise({
      catch: () =>
        new ContentExecutionError({
          contentKey: input.contentKey,
          stage: "evaluate",
        }),
      try: () =>
        run(input.compiledCode, {
          Fragment,
          jsx,
          jsxs,
          useMDXComponents: () => input.components,
        }),
    });

    if (typeof module.default !== "function") {
      return yield* new ContentExecutionError({
        contentKey: input.contentKey,
        stage: "module",
      });
    }
    return module.default;
  }
);

/** Evaluates an artifact already authenticated by its owning runtime boundary. */
export const evaluateVerifiedArtifact = Effect.fn(
  "NakafaContent.evaluateVerifiedArtifact"
)(function* (input: EvaluateArtifactInput) {
  const Content = yield* evaluateCompiledCode({
    compiledCode: input.artifact.payload.compiledCode,
    components: input.components,
    contentKey: input.artifact.payload.contentKey,
  });

  return {
    Content,
    artifact: input.artifact,
  } satisfies RenderableContent;
});

/** Evaluates an authenticated old artifact without adapting its wire schema. */
export const evaluateVerifiedHistoricalArtifact = Effect.fn(
  "NakafaContent.evaluateVerifiedHistoricalArtifact"
)(function* (input: EvaluateHistoricalArtifactInput) {
  const Content = yield* evaluateCompiledCode({
    compiledCode: input.artifact.payload.compiledCode,
    components: input.components,
    contentKey: input.artifact.payload.contentKey,
  });

  return {
    Content,
    artifact: input.artifact,
  } satisfies RenderableHistoricalContent;
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
