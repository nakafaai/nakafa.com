import { Effect, Option, Redacted } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";
import { readPreviewConfig } from "@/lib/content/preview/config";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const PRIVATE_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

/** Returns the exact renderer envelope to authenticated Aksara tooling. */
export const GET = (request: NextRequest) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const authorization = request.headers.get("Authorization");
      const previewConfig = yield* readPreviewConfig();
      const isInternalAuthorized = isInternalContentAuthorized(
        authorization,
        env.INTERNAL_CONTENT_API_KEY
      );
      const isPreviewAuthorized = Option.exists(previewConfig, (config) =>
        isInternalContentAuthorized(authorization, Redacted.value(config.token))
      );

      if (!(isInternalAuthorized || isPreviewAuthorized)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { headers: PRIVATE_RESPONSE_HEADERS, status: 401 }
        );
      }

      const manifest = yield* rendererManifest;

      return NextResponse.json(manifest, {
        headers: PRIVATE_RESPONSE_HEADERS,
      });
    })
  );
