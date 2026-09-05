import "server-only";

import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import {
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
  protectedRuntimeResponseBytes,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  decodeProtectedContentRuntimeRequest,
  type ProtectedContentRuntimeFound,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import { verifyProtectedContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/protected/verify";
import {
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
} from "@repo/backend/client/content/errors";
import {
  decodeArtifactJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { TryoutBodyBatch } from "@repo/backend/convex/tryouts/runtime/body";
import { Effect, Schema } from "effect";

/** Authenticates original attempt bytes against their frozen selectors and renderer. */
export const verifyAttemptContent = Effect.fn("NakafaContent.verifyAttempt")(
  function* (
    input: unknown,
    row: TryoutBodyBatch | null,
    rendererManifest: unknown
  ) {
    const request = yield* decodeProtectedContentRuntimeRequest(input).pipe(
      Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
    );
    if (!row) {
      return yield* new ContentRuntimeMissingError({ request });
    }
    if (
      protectedRuntimeResponseBytes(row) > MAX_PROTECTED_RUNTIME_RESPONSE_BYTES
    ) {
      return yield* new ContentRuntimeVerificationError({
        cause: "Try-out history exceeds its response byte limit.",
      });
    }
    const [bundle, storedRenderer, items] = yield* Effect.all([
      decodeTryoutRuntimeBundleJson(row.bundleJson),
      decodeRendererJson(row.rendererJson),
      Effect.forEach(row.items, (item) =>
        Effect.all({
          artifact: decodeArtifactJson(item.artifactJson),
          delivery: Effect.succeed(item.delivery),
          sourcePath: Schema.decodeEffect(CorpusSourcePathSchema)(
            item.sourcePath
          ),
        })
      ),
    ]).pipe(
      Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
    );
    const response: ProtectedContentRuntimeFound = {
      bundle,
      items,
      kind: "found",
      rendererManifest: storedRenderer,
    };
    yield* verifyProtectedContentRuntimeExchange({
      rendererManifest,
      request,
      response,
    }).pipe(
      Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
    );
    return response;
  }
);
