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

/** The origins that the shared sign-in trusts for one POST to `site` with these headers. */
function trustedFor(site: string, headers: Record<string, string> = {}) {
  return readSchoolTrustedOrigins(new URL(site))(
    new Request("https://nakafa.com/api/auth/sign-out", {
      headers,
      method: "POST",
    })
  );
}

describe("school trusted origins", () => {
  it("trusts the origin of a school host of a production site", () => {
    expect(
      trustedFor("https://nakafa.com", { origin: "https://harapan.nakafa.com" })
    ).toEqual(["https://harapan.nakafa.com"]);
  });

  it.each(["api", "app", "cas", "mcp", "school", "www"])(
    "refuses the reserved host %s, which the school router refuses too",
    (label) => {
      expect(
        trustedFor("https://nakafa.com", {
          origin: `https://${label}.nakafa.com`,
        })
      ).toEqual([]);
    }
  );

  it.each([
    "harapan.sma.nakafa.com",
    "a.b.nakafa.com",
    "t.nakafa.com",
    "sma_1.nakafa.com",
    "-nf.nakafa.com",
    "xn--nf.nakafa.com",
  ])("refuses a host that is not a school label: %s", (host) => {
    expect(
      trustedFor("https://nakafa.com", { origin: `https://${host}` })
    ).toEqual([]);
  });

  it.each([
    "https://Harapan.nakafa.com",
    "https://harapan.nakafa.com/",
    "https://harapan.nakafa.com:443",
  ])("refuses an origin that a browser would not write: %s", (origin) => {
    expect(trustedFor("https://nakafa.com", { origin })).toEqual([]);
  });

  it.each([
    "http://harapan.nakafa.com",
    "https://harapan.nakafa.com:8443",
    "https://evilnakafa.com",
    "https://harapan.nakafa.com.evil.com",
  ])("refuses an origin that is not a school of the site: %s", (origin) => {
    expect(trustedFor("https://nakafa.com", { origin })).toEqual([]);
  });

  it("trusts a school host on the site's own port alone when the site is not local", () => {
    expect(
      trustedFor("https://nakafa.com:8443", {
        origin: "https://harapan.nakafa.com:8443",
      })
    ).toEqual(["https://harapan.nakafa.com:8443"]);
    expect(
      trustedFor("https://nakafa.com:8443", {
        origin: "https://harapan.nakafa.com",
      })
    ).toEqual([]);
  });

  it("keeps a local site's own host and its school hosts on any port", () => {
    expect(
      trustedFor("http://localhost:3000", { origin: "http://localhost:3400" })
    ).toEqual(["http://localhost:3400"]);
    expect(
      trustedFor("http://localhost:3000", {
        origin: "http://harapan.localhost:3400",
      })
    ).toEqual(["http://harapan.localhost:3400"]);
  });

  it("refuses a local school host under another protocol", () => {
    expect(
      trustedFor("http://localhost:3000", {
        origin: "https://harapan.localhost:3400",
      })
    ).toEqual([]);
  });

  it("trusts nothing for a request with no Origin or Referer, an origin that is not a URL, or no request", () => {
    expect(trustedFor("https://nakafa.com")).toEqual([]);
    expect(trustedFor("https://nakafa.com", { origin: "null" })).toEqual([]);
    expect(readSchoolTrustedOrigins(new URL("https://nakafa.com"))()).toEqual(
      []
    );
  });
});

describe("school trusted origins from the Referer", () => {
  it("trusts the origin of the Referer of a request with no Origin, as Better Auth checks it", () => {
    expect(
      trustedFor("https://nakafa.com", {
        referer: "https://harapan.nakafa.com/classes",
      })
    ).toEqual(["https://harapan.nakafa.com"]);
  });

  it("reads the Referer when the Origin header is empty, as Better Auth does", () => {
    expect(
      trustedFor("https://nakafa.com", {
        origin: "",
        referer: "https://harapan.nakafa.com/classes",
      })
    ).toEqual(["https://harapan.nakafa.com"]);
  });

  it("prefers the Origin header to the Referer", () => {
    expect(
      trustedFor("https://nakafa.com", {
        origin: "https://harapan.nakafa.com",
        referer: "https://cas.nakafa.com/",
      })
    ).toEqual(["https://harapan.nakafa.com"]);
  });

  it("refuses the Referer of a reserved service host", () => {
    expect(
      trustedFor("https://nakafa.com", { referer: "https://cas.nakafa.com/" })
    ).toEqual([]);
  });

  it("refuses a Referer that is not a URL", () => {
    expect(
      trustedFor("https://nakafa.com", {
        referer: "harapan.nakafa.com/classes",
      })
    ).toEqual([]);
  });

  it("keeps a local site's school hosts on any port for the Referer", () => {
    expect(
      trustedFor("http://localhost:3000", {
        referer: "http://harapan.localhost:3400/classes",
      })
    ).toEqual(["http://harapan.localhost:3400"]);
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
