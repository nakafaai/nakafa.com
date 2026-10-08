import "server-only";

// Only Aksara artifacts that pass exact schema, hash, source, Ed25519 signature,
// and renderer compatibility verification reach `run()` below.
// https://github.com/nakafaai/aksara/blob/9b8cbbd9cc82704d9d7e36af04eb6bb439953fcd/packages/contracts/src/artifact/verify.ts#L9-L37
// https://github.com/nakafaai/aksara/blob/9b8cbbd9cc82704d9d7e36af04eb6bb439953fcd/packages/contracts/src/artifact/integrity.ts#L56-L92
// The pinned compiler records and rejects imports and re-exports before publication.
// https://github.com/nakafaai/aksara/blob/9b8cbbd9cc82704d9d7e36af04eb6bb439953fcd/packages/compiler/src/policy.ts#L206-L222
// https://github.com/nakafaai/aksara/blob/9b8cbbd9cc82704d9d7e36af04eb6bb439953fcd/packages/compiler/src/engine.ts#L201-L205
// MDX documents `run()` as the execution API for already-compiled code.
// https://mdxjs.com/packages/mdx/#run
// react-doctor-disable-next-line react-doctor/mdx-ssr-execution-risk
import { run } from "@mdx-js/mdx";
import type { ArtifactVerificationRequest } from "@nakafa/aksara-contracts/artifact/spec";
import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";

import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Schema } from "effect";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ContentExecutionError } from "@/lib/content/published/errors";
import { resolveRendererComponents } from "@/lib/content/renderer/components";

/**
 * Inputs required to authenticate and execute one trusted content artifact.
 * The artifact stays unknown until the verifier decodes it against its contract.
 */
type ExecuteArtifactInput = Pick<
  ArtifactVerificationRequest,
  "rendererManifest"
> &
  Record<"artifact", unknown>;

const EvaluateArtifactInputSchema = Schema.Struct({
  artifact: SignedContentArtifactSchema,
});
type EvaluateArtifactInput = typeof EvaluateArtifactInputSchema.Type;

const EvaluateCompiledCodeInputSchema = Schema.Struct({
  compiledCode: Schema.String,
  contentKey: ContentKeySchema,
});
type EvaluateCompiledCodeInput = typeof EvaluateCompiledCodeInputSchema.Type;

/** Evaluates already-authenticated compiled code without changing its schema. */
const evaluateCompiledCode = Effect.fn("NakafaContent.evaluateCompiledCode")(
  function* (input: EvaluateCompiledCodeInput, components: MDXComponents) {
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
          useMDXComponents: () => components,
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
  const components = yield* resolveRendererComponents(input.artifact.payload);
  const Content = yield* evaluateCompiledCode(
    {
      compiledCode: input.artifact.payload.compiledCode,
      contentKey: input.artifact.payload.contentKey,
    },
    components
  );

  return {
    Content,
    artifact: input.artifact,
  };
});

/** Authenticated module and projections consumed by a Nakafa route shell. */
export type RenderableContent = Effect.Success<
  ReturnType<typeof evaluateVerifiedArtifact>
>;

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
    rendererManifest: input.rendererManifest,
  });
  return yield* evaluateVerifiedArtifact({ artifact });
});
