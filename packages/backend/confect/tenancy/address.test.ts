import { describe, expect, it } from "@effect/vitest";
import { schoolAddress } from "@repo/backend/confect/tenancy/address";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";

const harapan = Schema.decodeSync(TenantSlug)("harapan");

describe("tenancy/address schoolAddress", () => {
  it.effect("answers the school's own host under the site's domain", () =>
    Effect.gen(function* () {
      expect(yield* schoolAddress(new URL("https://nakafa.com"), harapan)).toBe(
        "https://harapan.nakafa.com/"
      );
    })
  );

  it.effect("keeps the protocol and the port of a local run", () =>
    Effect.gen(function* () {
      expect(
        yield* schoolAddress(new URL("http://localhost:3000"), harapan)
      ).toBe("http://harapan.localhost:3000/");
    })
  );

  it.effect(
    "answers the root of the host, whatever path the site URL carries",
    () =>
      Effect.gen(function* () {
        expect(
          yield* schoolAddress(new URL("https://nakafa.com/en/"), harapan)
        ).toBe("https://harapan.nakafa.com/");
      })
  );

  it.effect.each(["http://127.0.0.1:3000", "http://[::1]:3000"])(
    "fails as a site configuration error, not a defect, on an IP address site: %s",
    (site) =>
      Effect.gen(function* () {
        const error = yield* schoolAddress(new URL(site), harapan).pipe(
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "SiteConfigError",
          code: "SITE_URL_INVALID",
        });
      })
  );
});
