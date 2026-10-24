import "@tanstack/react-start/server-only";

import { ProtectedContentRuntimeFoundSchema } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyAttemptContent } from "@repo/backend/client/content/attempt";
import type { TryoutBodyBatch } from "@repo/backend/confect/tryouts/runtime/body";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { readContentStore } from "@/lib/content/store/read";

/**
 * Verifies one attempt batch that the signed page read returned. The verified
 * result is kept for the active release under the exact request and the exact
 * rows, so repeated views of the same bytes skip the signature checks and the
 * artifact decoding. The rows still come from the owner-checked read of each
 * request: this cache only reuses a verification, never an access decision.
 * A row that fails verification is never kept.
 */
export const readVerifiedAttemptBatch = Effect.fn(
  "NakafaContent.readVerifiedAttemptBatch"
)(function* (
  request: unknown,
  row: TryoutBodyBatch | null,
  rendererManifest: unknown
) {
  return yield* readContentStore({
    kind: "tryout.verifiedAttemptBatch",
    load: Effect.suspend(() =>
      verifyAttemptContent(request, row, rendererManifest)
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    ),
    parts: [encodeJsonText(request), encodeJsonText(row)],
    schema: ProtectedContentRuntimeFoundSchema,
  });
});
