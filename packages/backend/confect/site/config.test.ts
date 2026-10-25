import { describe, expect, it } from "@effect/vitest";
import {
  readSiteUrl,
  readSiteUrls,
  readStagingSiteUrl,
} from "@repo/backend/confect/site/config";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { Array as Arr, ConfigProvider, Effect, Option } from "effect";

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
          ConfigProvider.fromUnknown({
            SITE_URL: configured,
          })
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
          ConfigProvider.fromUnknown({
            SITE_URL: configured,
          })
        ),
        Effect.flip
      );
      expect(failure).toBeInstanceOf(SiteConfigError);
      expect(failure.code).toBe("SITE_URL_INVALID");
      expect(failure.message).toContain("SITE_URL");
    })
  );
  it.effect(
    "serves only the primary site when staging does not share the deployment",
    () =>
      Effect.gen(function* () {
        const sites = yield* readSiteUrls().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ SITE_URL: "https://nakafa.com" })
          )
        );
        expect(Arr.map(sites, (site) => site.href)).toEqual([
          "https://nakafa.com/",
        ]);
      })
  );
  it.effect("serves the primary site first, then staging", () =>
    Effect.gen(function* () {
      const sites = yield* readSiteUrls().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            SITE_URL: "https://local.nakafa.com",
            STAGING_SITE_URL: "https://staging.nakafa.com",
          })
        )
      );
      expect(Arr.map(sites, (site) => site.origin)).toEqual([
        "https://local.nakafa.com",
        "https://staging.nakafa.com",
      ]);
    })
  );
  it.effect.each(["not-a-url", "ftp://staging.nakafa.com"])(
    "rejects an invalid STAGING_SITE_URL: %s",
    (configured) =>
      Effect.gen(function* () {
        const failure = yield* readStagingSiteUrl().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ STAGING_SITE_URL: configured })
          ),
          Effect.flip
        );
        expect(failure).toBeInstanceOf(SiteConfigError);
        expect(failure.code).toBe("SITE_URL_INVALID");
        expect(failure.message).toContain("STAGING_SITE_URL");
      })
  );
  it.effect("reads no staging site when the value is unset", () =>
    Effect.gen(function* () {
      const staging = yield* readStagingSiteUrl().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        )
      );
      expect(Option.isNone(staging)).toBe(true);
    })
  );
});
