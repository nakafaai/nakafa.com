import { describe, expect, it } from "@effect/vitest";
import { readSiteUrl, SiteConfigError } from "@repo/backend/convex/site/config";
import { ConfigProvider, Effect } from "effect";

describe("site/config", () => {
  it.effect.each([
    "https://nakafa.com",
    "https://local.nakafa.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000/app",
  ])("uses the explicitly configured site %s", (configured) =>
    Effect.gen(function* () {
      const site = yield* readSiteUrl().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ SITE_URL: configured })
        )
      );

      expect(site.href).toBe(new URL(configured).href);
      expect(site.origin).toBe(new URL(configured).origin);
    })
  );

  it.effect.each([
    undefined,
    "",
    " ",
    "not-a-url",
    "/en/home",
    "ftp://nakafa.com",
    "javascript:alert(1)",
  ])("rejects an absent or invalid SITE_URL: %s", (configured) =>
    Effect.gen(function* () {
      const failure = yield* readSiteUrl().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ SITE_URL: configured })
        ),
        Effect.flip
      );

      expect(failure).toBeInstanceOf(SiteConfigError);
      expect(failure.code).toBe("SITE_URL_INVALID");
      expect(failure.message).toContain("SITE_URL");
    })
  );
});
