import "@tanstack/react-start/server-only";

import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import { ProtectedContentRuntimeFoundSchema } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyAttemptContent } from "@repo/backend/client/content/attempt";
import type { TryoutBodyBatch } from "@repo/backend/confect/tryouts/runtime/body";
import {
  contentKeyResolver,
  contentTrustedKeys,
} from "@repo/backend/content/trust";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import type { TryoutRuntimeRequest } from "@/components/tryout/content/request";
import { readContentStore } from "@/lib/content/store/read";

/**
 * Version of the verification that a stored verdict records. Bump it whenever
 * the verification changes: the contracts package that performs it is pinned by
 * the lockfile, and the package exports no version to key on.
 */
const VERIFICATION_VERSION = "1";

/**
 * Verifies one attempt batch that the signed page read returned. The verdict is
 * kept for the active release under the exact request and rows, and under the
 * three inputs that decide it: the live renderer contract, the trusted content
 * keys, and the verification version. A deploy that changes one of them verifies
 * again instead of reusing a verdict that no longer holds. Repeated views of the
 * same bytes under the same code skip the signature checks and the artifact
 * decoding. The rows still come from the owner-checked read of each request: this
 * cache only reuses a verification, never an access decision. A row that fails
 * verification is never kept.
 */
export const readVerifiedAttemptBatch = Effect.fn(
  "NakafaContent.readVerifiedAttemptBatch"
)(function* (
  request: TryoutRuntimeRequest,
  row: TryoutBodyBatch | null,
  liveRenderer: RendererManifestEnvelope
) {
  return yield* readContentStore({
    kind: "tryout.verifiedAttemptBatch",
    load: Effect.suspend(() =>
      verifyAttemptContent(request, row, liveRenderer)
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    ),
    parts: [
      encodeJsonText(request),
      encodeJsonText(row),
      liveRenderer.hash,
      encodeJsonText(contentTrustedKeys),
      VERIFICATION_VERSION,
    ],
    schema: ProtectedContentRuntimeFoundSchema,
  });
});
