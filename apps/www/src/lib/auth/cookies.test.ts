// @vitest-environment node
import { AUTH_JWT_COOKIE, AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { describe, expect, it } from "@effect/vitest";
import {
  hasSessionCookie,
  inboundCookieHeader,
  outboundSetCookie,
  siteAuthCookies,
} from "@/lib/auth/cookies";

const PREFIX = "nakafa-dev.";

describe("siteAuthCookies", () => {
  it("names production's cookies for its whole domain, without a prefix", () => {
    expect(siteAuthCookies(new URL("https://nakafa.com"))).toEqual({
      options: { domain: "nakafa.com", secure: true },
      prefix: "",
    });
  });

  it("gives staging its own names, so production's session never reads as its own", () => {
    expect(siteAuthCookies(new URL("https://staging.nakafa.com"))).toEqual({
      options: { secure: true },
      prefix: PREFIX,
    });
  });

  it("keeps a local site's cookies plain and not secure", () => {
    expect(siteAuthCookies(new URL("http://localhost:3000"))).toEqual({
      options: { secure: false },
      prefix: "",
    });
  });
});

describe("inboundCookieHeader", () => {
  it("passes the header through on a site without a prefix", () => {
    const header = `${AUTH_REFRESH_COOKIE}=refresh; theme=dark`;

    expect(inboundCookieHeader(header, "")).toBe(header);
  });

  it("reads the site's own cookies under Convex Auth's names and drops production's", () => {
    expect(
      inboundCookieHeader(
        `${AUTH_REFRESH_COOKIE}=production; ${PREFIX}${AUTH_REFRESH_COOKIE}=staging; ${PREFIX}${AUTH_JWT_COOKIE}=jwt; theme=dark; broken`,
        PREFIX
      )
    ).toBe(
      `${AUTH_REFRESH_COOKIE}=staging; ${AUTH_JWT_COOKIE}=jwt; theme=dark`
    );
  });
});

describe("outboundSetCookie", () => {
  it("passes a cookie through on a site without a prefix", () => {
    const value = `${AUTH_JWT_COOKIE}=jwt; Path=/`;

    expect(outboundSetCookie(value, "")).toBe(value);
  });

  it("renames only the auth cookies with the site's prefix", () => {
    expect(outboundSetCookie(`${AUTH_JWT_COOKIE}=jwt; Path=/`, PREFIX)).toBe(
      `${PREFIX}${AUTH_JWT_COOKIE}=jwt; Path=/`
    );
    expect(outboundSetCookie("theme=dark; Path=/", PREFIX)).toBe(
      "theme=dark; Path=/"
    );
  });
});

describe("hasSessionCookie", () => {
  /** A request to `site` that carries `cookie`, if any. */
  const visit = (site: string, cookie?: string) =>
    new Request(site, cookie === undefined ? {} : { headers: { cookie } });

  it("finds the site's refresh cookie with a value", () => {
    const site = new URL("https://nakafa.com");

    expect(
      hasSessionCookie(
        visit(site.href, `theme=dark; ${AUTH_REFRESH_COOKIE}=refresh`),
        site
      )
    ).toBe(true);
    expect(
      hasSessionCookie(visit(site.href, `${AUTH_REFRESH_COOKIE}=`), site)
    ).toBe(false);
    expect(hasSessionCookie(visit(site.href), site)).toBe(false);
  });

  it("reads staging's own name and not production's", () => {
    const site = new URL("https://staging.nakafa.com");

    expect(
      hasSessionCookie(
        visit(site.href, `${AUTH_REFRESH_COOKIE}=production`),
        site
      )
    ).toBe(false);
    expect(
      hasSessionCookie(
        visit(site.href, `${PREFIX}${AUTH_REFRESH_COOKIE}=staging`),
        site
      )
    ).toBe(true);
  });
});
