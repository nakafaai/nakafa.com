import { describe, expect, it } from "@effect/vitest";
import { objectAddress, presign } from "@repo/backend/confect/bucket/sign";
import {
  reserveAnalyticsOrigin,
  withAnalyticsSink,
} from "@repo/backend/scripts/content/acceptance/analytics";
import {
  BUCKET_PATH,
  localBucketEnvironment,
} from "@repo/backend/scripts/content/acceptance/bucket";
import { nodePlatform } from "@repo/backend/test/platform";
import { FetchClient } from "@repo/utilities/http/client";
import { Clock, ConfigProvider, Effect, FileSystem, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/** Signs addresses for the stand-in at an origin, as the local backend does. */
const signedFor = (origin: string) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown({
      ...localBucketEnvironment,
      R2_ENDPOINT: `${origin}${BUCKET_PATH}`,
    })
  );

describe("acceptance bucket stand-in", () => {
  it.live(
    "stores a signed upload, answers its size, bytes and range with the asked type and name, and deletes it",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-bucket-test-",
        });
        const origin = yield* reserveAnalyticsOrigin();
        const client = yield* HttpClient.HttpClient;
        const address = (
          method: "DELETE" | "GET" | "HEAD" | "PUT",
          headers: Record<string, string> = {},
          query: Record<string, string> = {}
        ) =>
          objectAddress("library/school/file", {
            expiresSeconds: 60,
            headers,
            method,
            query,
          }).pipe(signedFor(origin));
        const replies = yield* withAnalyticsSink(
          origin,
          directory,
          Effect.gen(function* () {
            const preflight = yield* client.execute(
              HttpClientRequest.options(`${origin}${BUCKET_PATH}/files/x`)
            );
            const unsigned = yield* client.get(
              `${origin}${BUCKET_PATH}/nakafa-files/library/school/file`
            );
            const missing = yield* client.get(yield* address("GET"));
            const put = yield* client.execute(
              HttpClientRequest.put(
                yield* address("PUT", {
                  "content-length": "5",
                  "content-type": "application/pdf",
                })
              ).pipe(
                HttpClientRequest.bodyUint8Array(
                  new TextEncoder().encode("%PDF-"),
                  "application/pdf"
                )
              )
            );
            const head = yield* client.execute(
              HttpClientRequest.head(yield* address("HEAD"))
            );
            const range = yield* client.execute(
              HttpClientRequest.get(
                yield* address("GET", { range: "bytes=0-1" })
              ).pipe(HttpClientRequest.setHeader("range", "bytes=0-1"))
            );
            const named = yield* client.get(
              yield* address(
                "GET",
                {},
                {
                  "response-content-disposition": "attachment",
                  "response-content-type": "image/png",
                }
              )
            );
            const removed = yield* client.execute(
              HttpClientRequest.delete(yield* address("DELETE"))
            );
            const gone = yield* client.get(yield* address("GET"));
            return {
              gone: gone.status,
              head: [head.status, head.headers["content-length"]],
              missing: missing.status,
              named: [
                named.status,
                named.headers["content-type"],
                named.headers["content-disposition"],
                yield* named.text,
              ],
              preflight: preflight.status,
              put: put.status,
              range: [range.status, yield* range.text],
              removed: removed.status,
              unsigned: unsigned.status,
            };
          })
        );
        expect(replies).toEqual({
          gone: 404,
          head: [200, "5"],
          missing: 404,
          named: [200, "image/png", "attachment", "%PDF-"],
          preflight: 204,
          put: 200,
          range: [206, "%P"],
          removed: 204,
          unsigned: 403,
        });
      }).pipe(
        Effect.scoped,
        Effect.provide(FetchClient),
        Effect.provide(nodePlatform)
      )
  );

  it.live(
    "keeps an upload sent without a type, and refuses an expired address and a method it does not sign",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-bucket-test-",
        });
        const origin = yield* reserveAnalyticsOrigin();
        const client = yield* HttpClient.HttpClient;
        const url = new URL(
          `${origin}${BUCKET_PATH}/${localBucketEnvironment.R2_BUCKET}/plain`
        );
        const sign = (method: "GET" | "PUT", signedAt: number) =>
          presign({
            accessKeyId: localBucketEnvironment.R2_ACCESS_KEY_ID,
            expiresSeconds: 60,
            headers: {},
            method,
            query: {},
            region: "auto",
            secretAccessKey: Redacted.make(
              localBucketEnvironment.R2_SECRET_ACCESS_KEY
            ),
            signedAt,
            url,
          });
        const replies = yield* withAnalyticsSink(
          origin,
          directory,
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            const put = yield* client.execute(
              HttpClientRequest.put(yield* sign("PUT", now)).pipe(
                HttpClientRequest.bodyUint8Array(new Uint8Array([1, 2]))
              )
            );
            const typed = yield* client.get(yield* sign("GET", now));
            const expired = yield* client.get(
              yield* sign("GET", now - 3_600_000)
            );
            const posted = yield* client.post(yield* sign("GET", now));
            return [
              put.status,
              typed.headers["content-type"],
              expired.status,
              posted.status,
            ];
          })
        );
        expect(replies).toEqual([200, "application/octet-stream", 403, 403]);
      }).pipe(
        Effect.scoped,
        Effect.provide(FetchClient),
        Effect.provide(nodePlatform)
      )
  );
});
