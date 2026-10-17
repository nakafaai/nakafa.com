import { describe, expect, it } from "@effect/vitest";
import {
  expireHostOnlySessionCookie,
  hostOnlySessionCookieHandler,
  isLoopbackHostname,
  readHostOnlySessionCookieName,
  readSchoolTrustedOrigins,
  sharedCookieReaches,
} from "@repo/backend/confect/auth/host";

const SECURE_NAME = "__Secure-better-auth.session_token";
const PLAIN_NAME = "better-auth.session_token";

describe("school trusted origins", () => {
  it("admits every school host of a production site", () => {
    expect(readSchoolTrustedOrigins(new URL("https://nakafa.com"))).toEqual([
      "https://*.nakafa.com",
    ]);
  });

  it("admits every local school host and the site's own host on any port", () => {
    expect(readSchoolTrustedOrigins(new URL("http://localhost:3000"))).toEqual([
      "http://*.localhost:*",
      "http://localhost:*",
    ]);
  });

  it("admits only the school hosts on the site's own port when the site is not local", () => {
    expect(
      readSchoolTrustedOrigins(new URL("https://nakafa.com:8443"))
    ).toEqual(["https://*.nakafa.com:8443"]);
  });
});

describe("loopback hostname", () => {
  it("names localhost, its subdomains and the loopback addresses", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("harapan.localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
  });

  it("does not name a host that merely ends with localhost", () => {
    expect(isLoopbackHostname("nakafa.com")).toBe(false);
    expect(isLoopbackHostname("evillocalhost")).toBe(false);
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

describe("host-only session expiry", () => {
  it("leaves a response that does not touch the session cookie unchanged", () => {
    const response = new Response("ok", {
      headers: { "set-cookie": "other=1; Path=/" },
    });

    expect(
      expireHostOnlySessionCookie(response, {
        cookieDomain: "nakafa.com",
        hostname: "nakafa.com",
        name: SECURE_NAME,
      })
    ).toBeUndefined();
  });

  it("puts a secure expiry without a Domain attribute ahead of the shared cookie", () => {
    const shared = `${SECURE_NAME}=token; Domain=nakafa.com; Path=/; Secure; HttpOnly`;
    const response = new Response(null, {
      headers: { "set-cookie": shared },
    });

    const expired = expireHostOnlySessionCookie(response, {
      cookieDomain: "nakafa.com",
      hostname: "nakafa.com",
      name: SECURE_NAME,
    });

    expect(expired?.headers.getSetCookie()).toEqual([
      `${SECURE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`,
      shared,
    ]);
  });

  it("omits Secure for a cookie name without the secure prefix", () => {
    const response = new Response(null, {
      headers: { "set-cookie": `${PLAIN_NAME}=; Path=/; Max-Age=0` },
    });

    const expired = expireHostOnlySessionCookie(response, {
      cookieDomain: "localhost",
      hostname: "localhost",
      name: PLAIN_NAME,
    });

    expect(expired?.headers.getSetCookie()).toContain(
      `${PLAIN_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
    );
  });

  it("expires the host-only cookie of a school host under a registrable domain", () => {
    const response = new Response(null, {
      headers: { "set-cookie": `${SECURE_NAME}=token; Domain=nakafa.com` },
    });

    const expired = expireHostOnlySessionCookie(response, {
      cookieDomain: "nakafa.com",
      hostname: "harapan.nakafa.com",
      name: SECURE_NAME,
    });

    expect(expired?.headers.getSetCookie()).toContain(
      `${SECURE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`
    );
  });

  it("leaves the host-only cookie alone when the shared cookie does not reach the host that answered", () => {
    const response = new Response(null, {
      headers: { "set-cookie": `${PLAIN_NAME}=token; Domain=localhost` },
    });

    expect(
      expireHostOnlySessionCookie(response, {
        cookieDomain: "localhost",
        hostname: "127.0.0.1",
        name: PLAIN_NAME,
      })
    ).toBeUndefined();
  });

  it("leaves the host-only cookie of a school host under a local site alone", () => {
    const response = new Response(null, {
      headers: { "set-cookie": `${PLAIN_NAME}=token; Domain=localhost` },
    });

    expect(
      expireHostOnlySessionCookie(response, {
        cookieDomain: "localhost",
        hostname: "harapan.localhost",
        name: PLAIN_NAME,
      })
    ).toBeUndefined();
  });

  it("keeps the status and body of the response it extends", async () => {
    const response = new Response("signed out", {
      headers: { "set-cookie": `${SECURE_NAME}=; Path=/; Max-Age=0` },
      status: 200,
    });

    const expired = expireHostOnlySessionCookie(response, {
      cookieDomain: "nakafa.com",
      hostname: "nakafa.com",
      name: SECURE_NAME,
    });

    expect(expired?.status).toBe(200);
    expect(await expired?.text()).toBe("signed out");
  });
});

describe("host-only session handler", () => {
  const siteUrl = new URL("https://nakafa.com");
  const shared = `${SECURE_NAME}=token; Domain=nakafa.com`;
  const expiry = `${SECURE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`;

  it("adds the expiry to an answer for a school host that the shared cookie reaches", async () => {
    const handler = hostOnlySessionCookieHandler(
      () =>
        Promise.resolve(
          new Response(null, { headers: { "set-cookie": shared } })
        ),
      siteUrl
    );

    const response = await handler(
      new Request("https://nakafa.com/api/auth/get-session", {
        headers: { "x-forwarded-host": "harapan.nakafa.com" },
      })
    );

    expect(response.headers.getSetCookie()).toEqual([expiry, shared]);
  });

  it("names the host without its port", async () => {
    const handler = hostOnlySessionCookieHandler(
      () =>
        Promise.resolve(
          new Response(null, {
            headers: { "set-cookie": `${PLAIN_NAME}=token; Domain=localhost` },
          })
        ),
      new URL("http://localhost:3000")
    );

    const response = await handler(
      new Request("http://localhost:3400/api/auth/get-session", {
        headers: { "x-forwarded-host": "localhost:3400" },
      })
    );

    expect(response.headers.getSetCookie()).toEqual([
      `${PLAIN_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
      `${PLAIN_NAME}=token; Domain=localhost`,
    ]);
  });

  it("leaves an answer alone when the host it answers is outside the site", async () => {
    const answered = new Response(null, {
      headers: { "set-cookie": `${PLAIN_NAME}=token; Domain=localhost` },
    });
    const handler = hostOnlySessionCookieHandler(
      () => Promise.resolve(answered),
      new URL("http://localhost:3000")
    );

    const response = await handler(
      new Request("http://localhost:3400/api/auth/get-session", {
        headers: { "x-forwarded-host": "127.0.0.1:3400" },
      })
    );

    expect(response).toBe(answered);
  });

  it("leaves an answer alone when the request names no host", async () => {
    const answered = new Response(null, { headers: { "set-cookie": shared } });
    const handler = hostOnlySessionCookieHandler(
      () => Promise.resolve(answered),
      siteUrl
    );

    const response = await handler(
      new Request("https://nakafa.com/api/auth/get-session")
    );

    expect(response).toBe(answered);
  });

  it.each([
    "not a host",
    "harapan.nakafa.com/classes",
    "evil.example@harapan.nakafa.com",
  ])(
    "leaves an answer alone when the forwarded value names no host: %s",
    async (forwarded) => {
      const answered = new Response(null, {
        headers: { "set-cookie": shared },
      });
      const handler = hostOnlySessionCookieHandler(
        () => Promise.resolve(answered),
        siteUrl
      );

      const response = await handler(
        new Request("https://nakafa.com/api/auth/get-session", {
          headers: { "x-forwarded-host": forwarded },
        })
      );

      expect(response).toBe(answered);
    }
  );
});
