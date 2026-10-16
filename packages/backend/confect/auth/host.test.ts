import { describe, expect, it } from "@effect/vitest";
import {
  expireHostOnlySessionCookie,
  hostOnlySessionCookiePlugin,
  readHostOnlySessionCookieName,
  readSchoolTrustedOrigins,
} from "@repo/backend/confect/auth/host";

const SECURE_NAME = "__Secure-better-auth.session_token";
const PLAIN_NAME = "better-auth.session_token";

describe("school trusted origins", () => {
  it("admits every school host of a production site", () => {
    expect(readSchoolTrustedOrigins(new URL("https://nakafa.com"))).toEqual([
      "https://*.nakafa.com",
    ]);
  });

  it("admits every local school host on the port of a local site", () => {
    expect(readSchoolTrustedOrigins(new URL("http://localhost:3000"))).toEqual([
      "http://*.localhost:*",
    ]);
  });
});

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

describe("host-only session expiry", () => {
  it("leaves a response that does not touch the session cookie unchanged", () => {
    const response = new Response("ok", {
      headers: { "set-cookie": "other=1; Path=/" },
    });

    expect(expireHostOnlySessionCookie(response, SECURE_NAME)).toBeUndefined();
  });

  it("adds a secure expiry without a Domain attribute when the response sets the shared cookie", () => {
    const response = new Response(null, {
      headers: {
        "set-cookie": `${SECURE_NAME}=token; Domain=nakafa.com; Path=/; Secure; HttpOnly`,
      },
    });

    const expired = expireHostOnlySessionCookie(response, SECURE_NAME);

    expect(expired?.headers.getSetCookie()).toEqual([
      `${SECURE_NAME}=token; Domain=nakafa.com; Path=/; Secure; HttpOnly`,
      `${SECURE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`,
    ]);
  });

  it("omits Secure for a cookie name without the secure prefix", () => {
    const response = new Response(null, {
      headers: { "set-cookie": `${PLAIN_NAME}=; Path=/; Max-Age=0` },
    });

    const expired = expireHostOnlySessionCookie(response, PLAIN_NAME);

    expect(expired?.headers.getSetCookie()).toContain(
      `${PLAIN_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
    );
  });

  it("keeps the status and body of the response it extends", async () => {
    const response = new Response("signed out", {
      headers: { "set-cookie": `${SECURE_NAME}=; Path=/; Max-Age=0` },
      status: 200,
    });

    const expired = expireHostOnlySessionCookie(response, SECURE_NAME);

    expect(expired?.status).toBe(200);
    expect(await expired?.text()).toBe("signed out");
  });
});

describe("host-only session plugin", () => {
  it("answers a response that sets the shared cookie with the expiry", async () => {
    const plugin = hostOnlySessionCookiePlugin(SECURE_NAME);
    const response = new Response(null, {
      headers: { "set-cookie": `${SECURE_NAME}=token; Domain=nakafa.com` },
    });

    const answer = await plugin.onResponse(response);

    expect(answer?.response.headers.getSetCookie()).toContain(
      `${SECURE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`
    );
  });

  it("leaves a response without the shared cookie alone", async () => {
    const plugin = hostOnlySessionCookiePlugin(SECURE_NAME);

    expect(await plugin.onResponse(new Response(null))).toBeUndefined();
  });
});
