import { describe, expect, it } from "@effect/vitest";
import {
  readAuthCookiePrefix,
  readHostOnlySessionCookieName,
  sharedCookieReaches,
} from "@repo/backend/confect/auth/cookie";

const SECURE_NAME = "__Secure-better-auth.session_token";
const PLAIN_NAME = "better-auth.session_token";

describe("host-only session cookie", () => {
  it("names the cookie with the secure prefix on an HTTPS site", () => {
    expect(readHostOnlySessionCookieName(new URL("https://nakafa.com"))).toBe(
      SECURE_NAME
    );
  });

  it("names the cookie without the secure prefix on a local HTTP site", () => {
    expect(
      readHostOnlySessionCookieName(new URL("http://localhost:3000"))
    ).toBe(PLAIN_NAME);
  });
});

describe("site cookie prefix", () => {
  it.each(["https://nakafa.com", "http://localhost:3000"])(
    "keeps Better Auth's names on %s, which production's cookie does not shadow",
    (site) => {
      expect(readAuthCookiePrefix(new URL(site))).toBe("better-auth");
    }
  );

  it.each(["https://staging.nakafa.com", "https://nakafa.local.nakafa.com"])(
    "names the cookies of %s apart, because production's cookie reaches it",
    (site) => {
      expect(readAuthCookiePrefix(new URL(site))).toBe("nakafa-dev");
      expect(readHostOnlySessionCookieName(new URL(site))).toBe(
        "__Secure-nakafa-dev.session_token"
      );
    }
  );
});

describe("shared session cookie reach", () => {
  it("reaches the host that its domain names", () => {
    expect(sharedCookieReaches("nakafa.com", "nakafa.com")).toBe(true);
    expect(sharedCookieReaches("localhost", "localhost")).toBe(true);
  });

  it("reaches a school host under a registrable domain", () => {
    expect(sharedCookieReaches("harapan.nakafa.com", "nakafa.com")).toBe(true);
  });

  it("does not reach a host that only ends with its domain", () => {
    expect(sharedCookieReaches("evilnakafa.com", "nakafa.com")).toBe(false);
  });

  it("does not reach a school host under a single-label domain", () => {
    expect(sharedCookieReaches("harapan.localhost", "localhost")).toBe(false);
  });

  it("does not reach another host", () => {
    expect(sharedCookieReaches("127.0.0.1", "localhost")).toBe(false);
  });
});
