// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  isConvexTokenCookieName,
  readConvexTokenCookie,
  readSessionCookie,
} from "@/lib/auth/cookie.server";

const PRODUCTION_COOKIE = "__Secure-better-auth.session_token=production.value";
const STAGING_COOKIE = "__Secure-nakafa-dev.session_token=staging.value";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readSessionCookie", () => {
  it("reads Better Auth's session cookie on production", () => {
    vi.stubEnv("SITE_URL", "https://nakafa.com");

    expect(readSessionCookie(new Headers({ cookie: PRODUCTION_COOKIE }))).toBe(
      "production.value"
    );
  });

  it("reads staging's own cookie and never production's, which the browser also sends there", () => {
    vi.stubEnv("SITE_URL", "https://staging.nakafa.com");

    expect(
      readSessionCookie(
        new Headers({ cookie: `${PRODUCTION_COOKIE}; ${STAGING_COOKIE}` })
      )
    ).toBe("staging.value");
    expect(
      readSessionCookie(new Headers({ cookie: PRODUCTION_COOKIE }))
    ).toBeNull();
  });
});

describe("the Convex token cookie", () => {
  it("reads and recognizes the site's own token cookie, with or without the secure prefix", () => {
    vi.stubEnv("SITE_URL", "https://staging.nakafa.com");

    expect(
      readConvexTokenCookie(
        new Headers({
          cookie:
            "__Secure-better-auth.convex_jwt=production; __Secure-nakafa-dev.convex_jwt=staging",
        })
      )
    ).toBe("staging");
    expect(isConvexTokenCookieName("__Secure-nakafa-dev.convex_jwt")).toBe(
      true
    );
    expect(isConvexTokenCookieName("nakafa-dev.convex_jwt")).toBe(true);
    expect(isConvexTokenCookieName("__Secure-better-auth.convex_jwt")).toBe(
      false
    );
    expect(isConvexTokenCookieName("convex_jwt")).toBe(false);
  });
});
