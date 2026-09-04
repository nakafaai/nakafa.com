import { MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_RESPONSE_BYTES } from "@repo/backend/content/archive";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { Effect, Redacted, Schema } from "effect";

export interface ArchiveCredential {
  readonly header: string;
  readonly token: Redacted.Redacted;
}

const readControlSource = Effect.fn("contentRuntimeTransport.read")(function* (
  response: Response,
  operation: string
) {
  return yield* Effect.tryPromise({
    catch: () => contentRuntimeCiError(`${operation} returned no JSON body.`),
    try: async () => {
      if (!response.body) {
        return { kind: "source", source: "" } as const;
      }
      const reader = response.body.getReader({ mode: "byob" });
      const decoder = new TextDecoder();
      let byteLength = 0;
      let source = "";
      try {
        while (true) {
          const remaining =
            MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_RESPONSE_BYTES - byteLength;
          const chunk = await reader.read(
            new Uint8Array(Math.min(1024, remaining + 1))
          );
          if (chunk.done) {
            return {
              kind: "source",
              source: source + decoder.decode(),
            } as const;
          }
          byteLength += chunk.value.byteLength;
          if (byteLength > MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_RESPONSE_BYTES) {
            await reader.cancel();
            return { kind: "oversized" } as const;
          }
          source += decoder.decode(chunk.value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
});

/** Performs one archive HTTP operation without retaining sensitive response text. */
export const fetchArchive = Effect.fn("contentRuntimeTransport.fetch")(
  function* (
    fetcher: typeof fetch,
    operation: string,
    url: string,
    init: RequestInit
  ) {
    return yield* Effect.tryPromise({
      catch: () =>
        contentRuntimeCiError(`${operation} could not reach Convex storage.`),
      try: () => fetcher(url, init),
    });
  }
);

/** Strictly decodes one bounded archive control response. */
export const decodeControlResponse = Effect.fn(
  "contentRuntimeTransport.decode"
)(function* <A, I>(
  response: Response,
  schema: Schema.Codec<A, I, never, never>,
  operation: string
) {
  const body = yield* readControlSource(response, operation);
  if (body.kind === "oversized") {
    return yield* contentRuntimeCiError(
      `${operation} returned an oversized control response.`
    );
  }
  return yield* Schema.decodeEffect(Schema.fromJsonString(schema))(
    body.source,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(`${operation} returned an invalid response.`)
    )
  );
});

/** Posts one authenticated JSON control request without following redirects. */
export const postArchiveControl = Effect.fn("contentRuntimeTransport.post")(
  function* (
    fetcher: typeof fetch,
    siteUrl: string,
    path: string,
    body: unknown,
    credential: ArchiveCredential,
    operation: string
  ) {
    return yield* fetchArchive(fetcher, operation, `${siteUrl}${path}`, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        [credential.header]: Redacted.value(credential.token),
      },
      method: "POST",
      redirect: "error",
    });
  }
);

export function archiveHttpError(operation: string, status: number) {
  return contentRuntimeCiError(`${operation} failed with HTTP ${status}.`);
}
