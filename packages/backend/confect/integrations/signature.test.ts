import { describe, expect, it } from "@effect/vitest";
import { signBody } from "@repo/backend/confect/integrations/signature";
import { Effect } from "effect";

describe("signBody", () => {
  it.effect("signs the timestamp, a dot and the body with HMAC-SHA-256", () =>
    Effect.gen(function* () {
      // printf '1700000000.{"id":"1"}' | openssl dgst -sha256 -hmac secret
      expect(yield* signBody("secret", 1_700_000_000, '{"id":"1"}')).toBe(
        "t=1700000000,v1=086f6aff7bd084c98679825129c5a64dbad88c760016d6d2c0fb123f27951d54"
      );
    })
  );

  it.effect("signs another timestamp differently, so a replay fails", () =>
    Effect.gen(function* () {
      expect(yield* signBody("secret", 1, "body")).not.toBe(
        yield* signBody("secret", 2, "body")
      );
    })
  );
});
