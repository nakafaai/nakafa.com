import "@tanstack/react-start/server-only";

import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { ContentHttpTarget } from "@repo/backend/client/content/endpoint";
import {
  decodeProtectedRequest,
  decodeProtectedResponseInput,
  fetchProtectedResponse,
  verifyProtectedResponse,
} from "@repo/backend/client/content/protected";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Option, Schema } from "effect";
import { readContentStore } from "@/lib/content/store/read";

/** A runtime answer as the runtime sent it, with the HTTP status that gave it. */
const RuntimeAnswerSchema = Schema.Struct({
  input: Schema.Unknown,
  status: Schema.Finite,
});
type RuntimeAnswer = typeof RuntimeAnswerSchema.Type;

/**
 * Whether an answer still decodes as the found answer that the store keeps. An
 * entry of another shape, or a missing answer, is a store miss, so the read asks
 * the runtime again instead of failing on a stored answer it can no longer read.
 */
function isFoundAnswer({ input, status }: RuntimeAnswer) {
  return Option.match(
    Schema.decodeUnknownOption(ProtectedContentRuntimeResponseSchema)(input),
    {
      onNone: () => false,
      onSome: (response) => response.kind === "found" && status === 200,
    }
  );
}

/** A found answer that the store keeps for the release, as the runtime sent it. */
const KeptAnswerSchema = RuntimeAnswerSchema.check(
  Schema.makeFilter(isFoundAnswer)
);

/** Raised for an answer that is not found: it is verified on every read and never kept. */
class UnkeptAnswer extends Schema.TaggedError<UnkeptAnswer>()("UnkeptAnswer", {
  kept: RuntimeAnswerSchema,
}) {}

/** Fetches one answer and keeps it only when the runtime found the content. */
const fetchFoundAnswer = Effect.fn("NakafaContent.fetchFoundAnswer")(function* (
  target: ContentHttpTarget,
  request: ProtectedContentRuntimeRequest
) {
  const fetched = yield* fetchProtectedResponse(target, request);
  const answer: RuntimeAnswer = {
    input: fetched.input,
    status: fetched.status,
  };
  if (fetched.response.kind !== "found") {
    return yield* new UnkeptAnswer({ kept: answer });
  }
  return answer;
});

/**
 * Reads the signed featured question for the home page. A found answer is kept
 * for the active release under its request as the runtime sent it, so the home
 * page reads the runtime once for each release. Every read decodes and verifies
 * the signed exchange again. A missing or failed answer is never kept, and a kept
 * answer that no longer decodes is loaded again.
 */
export const readFeaturedProtectedContent = Effect.fn(
  "NakafaContent.readFeaturedProtectedContent"
)(function* (
  target: ContentHttpTarget,
  input: unknown,
  rendererManifest: RendererManifestEnvelope
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
