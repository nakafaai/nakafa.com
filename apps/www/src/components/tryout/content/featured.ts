import "@tanstack/react-start/server-only";

import type { ProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { ContentHttpTarget } from "@repo/backend/client/content/endpoint";
import {
  decodeProtectedRequest,
  decodeProtectedResponseInput,
  fetchProtectedResponse,
  verifyProtectedResponse,
} from "@repo/backend/client/content/protected";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { readContentStore } from "@/lib/content/store/read";

/** A found answer as the runtime sent it, with the HTTP status, which the store keeps as received. */
const KeptAnswerSchema = Schema.Struct({
  input: Schema.Unknown,
  status: Schema.Finite,
});
type KeptAnswer = typeof KeptAnswerSchema.Type;

/** Raised for an answer that is not found: it is verified on every read and never kept. */
class UnkeptAnswer extends Schema.TaggedError<UnkeptAnswer>()("UnkeptAnswer", {
  kept: KeptAnswerSchema,
}) {}

/** Fetches one answer and keeps it only when the runtime found the content. */
const fetchFoundAnswer = Effect.fn("NakafaContent.fetchFoundAnswer")(function* (
  target: ContentHttpTarget,
  request: ProtectedContentRuntimeRequest
) {
  const fetched = yield* fetchProtectedResponse(target, request);
  const kept: KeptAnswer = { input: fetched.input, status: fetched.status };
  if (fetched.response.kind !== "found") {
    return yield* new UnkeptAnswer({ kept });
  }
  return kept;
});

/**
 * Reads the signed featured question for the home page. A found answer is kept
 * for the active release under its request as the runtime sent it, so the home
 * page reads the runtime once for each release. Every read decodes and verifies
 * the signed exchange again. A missing or failed answer is never kept.
 */
export const readFeaturedProtectedContent = Effect.fn(
  "NakafaContent.readFeaturedProtectedContent"
)(function* (
  target: ContentHttpTarget,
  input: unknown,
  rendererManifest: unknown
) {
  const request = yield* decodeProtectedRequest(input);
  const kept = yield* readContentStore({
    kind: "tryout.featured.protectedAnswer",
    load: fetchFoundAnswer(target, request),
    parts: [encodeJsonText(request)],
    schema: KeptAnswerSchema,
  }).pipe(
    Effect.catchTag("UnkeptAnswer", (error) => Effect.succeed(error.kept))
  );
  const response = yield* decodeProtectedResponseInput(kept.input, kept.status);
  return yield* verifyProtectedResponse(
    request,
    response,
    rendererManifest,
    kept.status
  );
});
