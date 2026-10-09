// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  createContentEndpoint,
  encodeContentRequest,
} from "@repo/backend/client/content/endpoint";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import { PUBLIC_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { Effect, Schema } from "effect";

const endpoint = `https://example.convex.site${PUBLIC_CONTENT_RUNTIME_PATH}`;

/** A request body that refers to itself, so that JSON encoding must reject it. */
const CyclicRequestSchema = Schema.Struct({
  self: Schema.mutableKey(Schema.optionalKey(Schema.Unknown)),
});

describe("content runtime endpoint", () => {
  it.live("builds only fixed HTTPS or loopback endpoints", () =>
    Effect.gen(function* () {
      expect(
        yield* createContentEndpoint(
          "https://example.convex.site/ignored",
          PUBLIC_CONTENT_RUNTIME_PATH
        )
      ).toBe(endpoint);
      expect(
        yield* createContentEndpoint(
          "http://localhost:3211/ignored",
          PUBLIC_CONTENT_RUNTIME_PATH
        )
      ).toBe(`http://localhost:3211${PUBLIC_CONTENT_RUNTIME_PATH}`);

      for (const siteUrl of [
        "not a URL",
        "http://example.com",
        "ftp://localhost",
        "https://user:secret@example.com",
      ]) {
        expect(
          yield* createContentEndpoint(
            siteUrl,
            PUBLIC_CONTENT_RUNTIME_PATH
          ).pipe(Effect.flip)
        ).toEqual(new ContentTransportError({ reason: "url" }));
      }
    })
  );

  it.live("serializes bounded request JSON and rejects invalid values", () =>
    Effect.gen(function* () {
      expect(yield* encodeContentRequest({ locale: "en" }, 1024)).toBe(
        '{"locale":"en"}'
      );
      const cyclic: typeof CyclicRequestSchema.Type = {};
      cyclic.self = cyclic;
      for (const input of [cyclic, undefined]) {
        expect(
          yield* encodeContentRequest(input, 1024).pipe(Effect.flip)
        ).toMatchObject({ reason: "request" });
      }
      expect(
        yield* encodeContentRequest({ value: "x".repeat(1024) }, 10).pipe(
          Effect.flip
        )
      ).toMatchObject({ reason: "request-size" });
    })
  );
});
