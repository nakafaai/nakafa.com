// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { readSessionCookie } from "@/lib/auth/cookie.server";

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
