"use node";

import { ACTIVE_SIGNING_KEY_ID } from "@nakafa/aksara-contracts/signature/trusted";
import type { StageGroupRequest } from "@nakafa/aksara-contracts/transport/group";
import { stagePublication } from "@repo/backend/confect/contentRelease/ingress/stage";
import { Effect } from "effect";

/** Executes decoded transaction-safe requests inside one authenticated exchange. */
export const stagePublicationGroup = Effect.fn(
  "contentRelease.stagePublicationGroup"
)(function* (request: StageGroupRequest, activeKeyId = ACTIVE_SIGNING_KEY_ID) {
  yield* Effect.forEach(
    request.requests,
    (stagedRequest) => stagePublication(stagedRequest, activeKeyId),
    {
      concurrency: 1,
      discard: true,
    }
  );
  return {
    ok: true,
    operation: request.operation,
    value: {
      releaseId: request.releaseId,
      requestCount: request.requests.length,
    },
  };
});
