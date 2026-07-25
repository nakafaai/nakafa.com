import {
  computePreviewRendererProof,
  PREVIEW_RENDERER_AUTH_FORMAT,
  PreviewRendererNonceSchema,
} from "@nakafa/aksara-contracts/preview/auth";
import { contentApiKeys } from "@repo/next-config/keys";
import { Effect, Option, Redacted, Schema } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";
import { readPreviewRendererConfig } from "@/lib/content/preview/config";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const PRIVATE_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };
const PREVIEW_NONCE_HEADER = "x-aksara-preview-nonce";
const rendererAuth = contentApiKeys();

/** Returns the exact renderer envelope to authenticated Aksara tooling. */
export const GET = (request: NextRequest) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const authorization = request.headers.get("Authorization");
      const isInternalAuthorized = isInternalContentAuthorized(
        authorization,
        rendererAuth.INTERNAL_CONTENT_API_KEY
      );

      if (isInternalAuthorized) {
        const manifest = yield* rendererManifest;
        return NextResponse.json(manifest, {
          headers: PRIVATE_RESPONSE_HEADERS,
        });
      }

      const previewConfig = yield* readPreviewRendererConfig();
      const unauthorizedResponse = NextResponse.json(
        { error: "Unauthorized" },
        { headers: PRIVATE_RESPONSE_HEADERS, status: 401 }
      );
      const nonce = Schema.decodeUnknownOption(PreviewRendererNonceSchema)(
        request.headers.get(PREVIEW_NONCE_HEADER)
      );

      if (Option.isNone(previewConfig) || Option.isNone(nonce)) {
        return unauthorizedResponse;
      }

      const isPreviewAuthorized = isInternalContentAuthorized(
        authorization,
        Redacted.value(previewConfig.value.token)
      );
      if (!isPreviewAuthorized) {
        return unauthorizedResponse;
      }

      const manifest = yield* rendererManifest;
      const proof = yield* computePreviewRendererProof({
        manifestHash: manifest.hash,
        nonce: nonce.value,
        secret: previewConfig.value.secret,
      });

      return NextResponse.json(
        {
          format: PREVIEW_RENDERER_AUTH_FORMAT,
          manifest,
          proof,
        },
        { headers: PRIVATE_RESPONSE_HEADERS }
      );
    })
  );
