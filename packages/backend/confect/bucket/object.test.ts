import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  inspectObject,
  putObject,
  readObject,
  removeObject,
} from "@repo/backend/confect/bucket/object";
import { makeBucket, stubBucket } from "@repo/backend/test/bucket";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Option } from "effect";
import { FetchHttpClient } from "effect/http";

const fetcher = vi.fn<typeof fetch>();
const bucket = makeBucket();

/** Provides the fetch double to a bucket call. */
const withFetch = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("bucket/object", () => {
  beforeEach(() => {
    bucket.state.objects = {};
    bucket.state.failing = false;
    fetcher.mockReset();
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "stores bytes, reads their size and leading bytes, reads them whole, and removes them",
    () =>
      Effect.gen(function* () {
        const bytes = new TextEncoder().encode("%PDF-1.7 body");
        yield* withFetch(putObject("library/a", bytes, "application/pdf"));
        expect(
          yield* withFetch(inspectObject("library/a", 5)).pipe(
            Effect.map(Option.getOrThrow)
          )
        ).toEqual({
          byteSize: bytes.byteLength,
          head: new TextEncoder().encode("%PDF-"),
        });
        expect(yield* withFetch(readObject("library/a"))).toEqual(
          Option.some(bytes)
        );
        yield* withFetch(removeObject("library/a"));
        yield* withFetch(removeObject("library/a"));
        expect(yield* withFetch(inspectObject("library/a", 5))).toEqual(
          Option.none()
        );
        expect(yield* withFetch(readObject("library/a"))).toEqual(
          Option.none()
        );
      })
  );

  it.effect("fails when R2 answers an error or cannot be reached", () =>
    Effect.gen(function* () {
      bucket.state.failing = true;
      expect(
        yield* withFetch(readObject("library/a")).pipe(Effect.flip)
      ).toMatchObject({ _tag: "BucketFailed", status: 500 });
      fetcher.mockRejectedValueOnce(new TypeError("offline"));
      expect(
        yield* withFetch(removeObject("library/a")).pipe(Effect.flip)
      ).toMatchObject({ _tag: "BucketFailed" });
    })
  );
});
