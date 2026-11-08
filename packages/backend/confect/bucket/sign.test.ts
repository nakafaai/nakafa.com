import { describe, expect, it } from "@effect/vitest";
import {
  objectAddress,
  objectKeyOf,
  presign,
} from "@repo/backend/confect/bucket/sign";
import { ConfigProvider, Effect, Option, Redacted } from "effect";

/** A presigned DELETE address of the example object, up to its credential scope. */
const SIGNED_DELETE_ADDRESS =
  /^https:\/\/account\.r2\.cloudflarestorage\.com\/nakafa-files\/library\/school\/file\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=key%2F\d{8}%2Fauto%2Fs3%2Faws4_request&/u;

/** The credentials of the presigned example in the S3 documentation. */
const EXAMPLE = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  region: "us-east-1",
  secretAccessKey: Redacted.make("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"),
  signedAt: Date.UTC(2013, 4, 24),
};

/** A bucket configured as the dev deployment configures R2, with a fixed clock. */
const configured = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    R2_ACCESS_KEY_ID: "key",
    R2_BUCKET: "nakafa-files",
    R2_ENDPOINT: "https://account.r2.cloudflarestorage.com/",
    R2_SECRET_ACCESS_KEY: "secret",
  })
);

describe("bucket.presign", () => {
  it.effect("matches the presigned GET of the S3 documentation", () =>
    Effect.gen(function* () {
      const address = yield* presign({
        ...EXAMPLE,
        expiresSeconds: 86_400,
        headers: {},
        method: "GET",
        query: {},
        url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      });
      expect(address).toBe(
        "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
      );
    })
  );

  it.effect(
    "binds an upload's length and type, and encodes a query RFC 3986 asks",
    () =>
      Effect.gen(function* () {
        const plain = yield* presign({
          ...EXAMPLE,
          expiresSeconds: 900,
          headers: { "Content-Length": "4", "Content-Type": "image/png" },
          method: "PUT",
          query: {},
          url: new URL("https://examplebucket.s3.amazonaws.com/a/b.png"),
        });
        const named = yield* presign({
          ...EXAMPLE,
          expiresSeconds: 900,
          headers: {},
          method: "GET",
          query: { "response-content-disposition": "inline; name=(1)!" },
          url: new URL("https://examplebucket.s3.amazonaws.com/a/b.png"),
        });
        expect(plain).toContain(
          "X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost"
        );
        expect(named).toContain(
          "response-content-disposition=inline%3B%20name%3D%281%29%21"
        );
      })
  );
});

describe("bucket.objectAddress", () => {
  it.effect("addresses the object path style under the configured bucket", () =>
    Effect.gen(function* () {
      const address = yield* objectAddress("library/school/file", {
        expiresSeconds: 300,
        method: "DELETE",
      }).pipe(Effect.provide(configured));
      expect(address).toMatch(SIGNED_DELETE_ADDRESS);
    })
  );
});

describe("bucket.objectKeyOf", () => {
  it.effect(
    "reads back the key of an address of the configured bucket, and none for any other address",
    () =>
      Effect.gen(function* () {
        const address = yield* objectAddress("files/accounts/a b", {
          expiresSeconds: 300,
          method: "GET",
        });
        expect(yield* objectKeyOf(address)).toEqual(
          Option.some("files/accounts/a b")
        );
        expect(
          yield* objectKeyOf("https://elsewhere.test/nakafa-files/files/x")
        ).toEqual(Option.none());
        expect(
          yield* objectKeyOf(
            "https://account.r2.cloudflarestorage.com/other/files/x"
          )
        ).toEqual(Option.none());
        expect(yield* objectKeyOf("not an address")).toEqual(Option.none());
        expect(
          yield* objectKeyOf(
            "https://account.r2.cloudflarestorage.com/nakafa-files/%E0%A4%A"
          )
        ).toEqual(Option.none());
      }).pipe(Effect.provide(configured))
  );
});
