import "@tanstack/react-start/server-only";

import {
  computePreviewRendererProof,
  PREVIEW_RENDERER_AUTH_FORMAT,
  PreviewRendererNonceSchema,
} from "@nakafa/aksara-contracts/preview/auth";
import { Effect, Option, Redacted, Schema } from "effect";
import { env } from "@/env";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";
import { readPreviewRendererConfig } from "@/lib/content/preview/config";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const PRIVATE_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };
const PREVIEW_NONCE_HEADER = "x-aksara-preview-nonce";

/** Answers with a JSON body that no cache may keep. */
function privateJson(body: object, status = 200) {
  return Response.json(body, { headers: PRIVATE_RESPONSE_HEADERS, status });
}

/**
 * Returns the exact renderer envelope to authenticated Aksara tooling. The
 * publication token opens the manifest; a preview renderer token with its nonce
 * opens the manifest with a proof that binds it to that nonce.
 */
export function serveContentRenderer({
  request,
}: {
  readonly request: Request;
}) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const authorization = request.headers.get("Authorization");
      const isInternalAuthorized = yield* isInternalContentAuthorized(
        authorization,
        env.AKSARA_PUBLICATION_TOKEN
      );

      if (isInternalAuthorized) {
        const manifest = yield* rendererManifest;
        return privateJson(manifest);
      }

      const previewConfig = yield* readPreviewRendererConfig();
      const nonce = Schema.decodeUnknownOption(PreviewRendererNonceSchema)(
        request.headers.get(PREVIEW_NONCE_HEADER)
      );

      if (Option.isNone(previewConfig) || Option.isNone(nonce)) {
        return privateJson({ error: "Unauthorized" }, 401);
      }

      const isPreviewAuthorized = yield* isInternalContentAuthorized(
        authorization,
        Redacted.value(previewConfig.value.token)
      );
      if (!isPreviewAuthorized) {
        return privateJson({ error: "Unauthorized" }, 401);
      }

      const manifest = yield* rendererManifest;
      const proof = yield* computePreviewRendererProof({
        manifestHash: manifest.hash,
        nonce: nonce.value,
        secret: previewConfig.value.secret,
      });

      return privateJson({
        format: PREVIEW_RENDERER_AUTH_FORMAT,
        manifest,
        proof,
      });
    })
  );
}
