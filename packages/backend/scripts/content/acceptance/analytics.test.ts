import { createServer } from "node:net";
import { describe, expect, it } from "@effect/vitest";
import {
  reserveAnalyticsOrigin,
  withAnalyticsSink,
} from "@repo/backend/scripts/content/acceptance/analytics";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect } from "effect";
import { HttpBody, HttpClient } from "effect/http";

const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/;

/** Whether anything still accepts connections at the origin. */
const isListening = (origin: string) =>
  HttpClient.get(origin).pipe(Effect.isSuccess);

describe("acceptance analytics stand-in", () => {
  it.live("accepts every proxied analytics request until the start ends", () =>
    Effect.gen(function* () {
      const origin = yield* reserveAnalyticsOrigin();
      expect(origin).toMatch(LOOPBACK_ORIGIN);
      expect(yield* isListening(origin)).toBe(false);

      const replies = yield* withAnalyticsSink(
        origin,
        Effect.gen(function* () {
          const capture = yield* HttpClient.post(`${origin}/e/?retry_count=1`, {
            body: HttpBody.jsonUnsafe({ event: "$pageview" }),
          });
          const asset = yield* HttpClient.get(`${origin}/static/array.js`);
          return [capture.status, yield* capture.json, asset.status];
        })
      );

      expect(replies).toEqual([200, { status: 1 }, 200]);
      expect(yield* isListening(origin)).toBe(false);
    }).pipe(Effect.provide(FetchClient))
  );

  it.live("stops when the start fails", () =>
    Effect.gen(function* () {
      const origin = yield* reserveAnalyticsOrigin();
      const failure = acceptanceRuntimeError("test start failure");

      expect(
        yield* withAnalyticsSink(origin, Effect.fail(failure)).pipe(Effect.flip)
      ).toBe(failure);
      expect(yield* isListening(origin)).toBe(false);
    }).pipe(Effect.provide(FetchClient))
  );

  it.live("refuses an occupied port and leaves its listener running", () =>
    Effect.gen(function* () {
      const origin = yield* reserveAnalyticsOrigin();
      const occupant = yield* Effect.acquireRelease(
        Effect.sync(() => createServer()),
        (server) =>
          Effect.callback<void>((resume) => {
            server.close(() => resume(Effect.void));
          })
      );
      yield* Effect.callback<void>((resume) => {
        occupant.listen(Number(new URL(origin).port), "127.0.0.1", () =>
          resume(Effect.void)
        );
      });

      expect(
        yield* withAnalyticsSink(origin, Effect.void).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: `The saved analytics stand-in port at ${origin} is occupied; its process is preserved.`,
      });
      expect(occupant.listening).toBe(true);
    }).pipe(Effect.scoped)
  );
});
