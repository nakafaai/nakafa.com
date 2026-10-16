import { describe, expect, it } from "@effect/vitest";
import { sanitizeProviderErrorRedirectResponse } from "@repo/backend/confect/auth/redirect";

const SITE_URL = new URL("http://localhost:3000");
describe("auth/redirect", () => {
  it("preserves every response cookie while scrubbing provider diagnostics", () => {
    const headers = new Headers({
      location:
        "http://localhost:3000/id/auth/error?intent=%2Fid%2Fsearch&error=access_denied&error_description=private",
    });
    headers.append(
      "set-cookie",
      "better-auth.state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    );
    headers.append(
      "set-cookie",
      "better-auth.transient=retained; Path=/; HttpOnly; SameSite=Lax"
    );
    const original = new Response(null, {
      headers,
      status: 302,
    });
    const sanitized = sanitizeProviderErrorRedirectResponse(original, SITE_URL);
    expect(sanitized?.headers.getSetCookie()).toEqual(
      original.headers.getSetCookie()
    );
    expect(sanitized?.headers.get("location")).toBe(
      "http://localhost:3000/id/auth/error?intent=%2Fid%2Fsearch"
    );
  });
  it.each([
    ["an invalid location", "http://[invalid"],
    ["a different origin", "https://example.com/en/auth/error?error=private"],
    ["a non-error app route", "http://localhost:3000/en/search?error=private"],
  ])("does not rewrite %s", (_label, location) => {
    const response = new Response(null, {
      headers: {
        location,
      },
      status: 302,
    });
    expect(
      sanitizeProviderErrorRedirectResponse(response, SITE_URL)
    ).toBeUndefined();
    expect(response.headers.get("location")).toBe(location);
  });
  it.each([
    [
      "a response that is not a redirect",
      new Response(null, {
        headers: {
          location: "http://localhost:3000/en/auth/error?error=private",
        },
        status: 200,
      }),
    ],
    [
      "a redirect without a location",
      new Response(null, {
        status: 302,
      }),
    ],
  ])("does not rewrite %s", (_label, response) => {
    const location = response.headers.get("location");
    expect(
      sanitizeProviderErrorRedirectResponse(response, SITE_URL)
    ).toBeUndefined();
    expect(response.headers.get("location")).toBe(location);
  });
  it("removes every provider value when no continuation intent exists", () => {
    const response = Response.redirect(
      "http://localhost:3000/de/auth/error?error=access_denied#error-fragment",
      302
    );
    const sanitized = sanitizeProviderErrorRedirectResponse(response, SITE_URL);
    expect(sanitized?.headers.get("location")).toBe(
      "http://localhost:3000/de/auth/error"
    );
  });
});
