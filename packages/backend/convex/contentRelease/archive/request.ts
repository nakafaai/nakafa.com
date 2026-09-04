import {
  ContentRuntimeArchiveErrorCodeSchema,
  MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_BYTES,
} from "@repo/backend/content/archive";
import { readJsonBody } from "@repo/backend/convex/contentRelease/http/body";
import { matchesHttpSecret } from "@repo/backend/convex/contentRelease/http/secret";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect, Result, Schema } from "effect";

export class RuntimeArchiveHttpError extends Schema.TaggedError<RuntimeArchiveHttpError>()(
  "RuntimeArchiveHttpError",
  {
    code: ContentRuntimeArchiveErrorCodeSchema,
    status: Schema.Literals([400, 401, 404, 409, 413, 415, 500]),
  }
) {}

export function archiveError(
  code: RuntimeArchiveHttpError["code"],
  status: RuntimeArchiveHttpError["status"]
) {
  return new RuntimeArchiveHttpError({ code, status });
}

/** Authenticates before consuming one bounded archive control body. */
export const readArchiveRequest = Effect.fn(
  "contentRuntimeArchive.readRequest"
)(function* <A, I>(
  request: Request,
  schema: Schema.Codec<A, I, never, never>,
  header: string,
  secret: string
) {
  const authenticated = yield* matchesHttpSecret(
    request.headers.get(header) ?? "",
    secret
  ).pipe(Effect.result);
  if (Result.isFailure(authenticated)) {
    return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_INTERNAL", 500);
  }
  if (!authenticated.success) {
    return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_UNAUTHORIZED", 401);
  }
  const body = yield* readJsonBody(
    request,
    MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_BYTES
  ).pipe(
    Effect.mapError((error) => {
      if (error.reason === "size") {
        return archiveError("CONTENT_RUNTIME_ARCHIVE_INVALID", 413);
      }
      if (error.reason === "unsupported") {
        return archiveError("CONTENT_RUNTIME_ARCHIVE_INVALID", 415);
      }
      return archiveError("CONTENT_RUNTIME_ARCHIVE_INVALID", 400);
    })
  );
  return yield* Schema.decodeEffect(Schema.fromJsonString(schema))(
    body.source,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() => archiveError("CONTENT_RUNTIME_ARCHIVE_INVALID", 400))
  );
});

/** Calls one internal archive operation without exposing backend failures. */
export function callArchive<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () => archiveError("CONTENT_RUNTIME_ARCHIVE_INTERNAL", 500),
    try: operation,
  });
}

/** Encodes one private archive control response. */
export function archiveResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
    status,
  });
}

/** Runs one archive route at the HTTP framework boundary. */
export async function runArchiveRoute(
  program: Effect.Effect<Response, RuntimeArchiveHttpError>
) {
  const result = await runConvexProgram(program.pipe(Effect.result));
  return Result.isFailure(result)
    ? archiveResponse({ code: result.failure.code }, result.failure.status)
    : result.success;
}
