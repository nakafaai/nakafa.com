// @vitest-environment node

import {
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
} from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  readBareRedirect,
  readMainSiteRedirect,
  readMigrationResponse,
  readMovedResponse,
  readRemovedAddressNotFound,
  readRootRedirectResponse,
  readSlashRedirectResponse,
  readSpellingRedirectResponse,
} from "@/lib/routing/redirect";

vi.hoisted(() => {
  vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "test-publication-token");
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

const migration = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/lib/routing/public/migration", () => ({
  readPublicUrlMigrationRedirect: migration.read,
}));

const request = (address: string, acceptLanguage?: string) =>
  new Request(
    address,
    acceptLanguage === undefined
      ? undefined
      : { headers: { "accept-language": acceptLanguage } }
  );

describe("readRootRedirectResponse", () => {
  it("answers the root with the negotiated locale, a 307 and its Vary headers", () => {
    const found = Option.getOrThrow(
      readRootRedirectResponse(request("https://nakafa.com/", "id-ID,id;q=0.9"))
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe("/id");
    expect(found.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it("leaves a school host's home and every other path to the next decision", () => {
    expect(
      Option.isNone(
        readRootRedirectResponse(request("https://harapan.nakafa.com/"))
      )
    ).toBe(true);
    expect(
      Option.isNone(
        readRootRedirectResponse(request("https://nakafa.com/en/curriculum"))
      )
    ).toBe(true);
  });
});

describe("readBareRedirect", () => {
  it("opens a bare page address and its query in the negotiated locale, with a 307 and its Vary headers", () => {
    const found = Option.getOrThrow(
      readBareRedirect(
        request("https://nakafa.com/@nobody_has_this/chat?tab=1", "id-ID")
      )
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe(
      "/id/@nobody_has_this/chat?tab=1"
    );
    expect(found.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it("opens a bare page address in English when the visitor names no served language", () => {
    expect(
      Option.getOrThrow(
        readBareRedirect(request("https://nakafa.com/quran/2", "fr-FR,ja"))
      ).headers.get("location")
    ).toBe("/en/quran/2");
  });

  it("leaves a file and a locale-shaped first segment missing", () => {
    for (const address of [
      "https://nakafa.com/wp-login.php",
      "https://nakafa.com/sitemap/missing.xml",
      "https://nakafa.com/fr/subjects",
      "https://nakafa.com/EN",
    ]) {
      expect(Option.isNone(readBareRedirect(request(address, "id")))).toBe(
        true
      );
    }
  });
});

describe("readSpellingRedirectResponse", () => {
  it("answers a non-public spelling with a 308 to the public spelling and keeps the query", () => {
    const found = Option.getOrThrow(
      readSpellingRedirectResponse(
        request("https://nakafa.com/en/curricula/x?page=2")
      )
    );

    expect(found.status).toBe(308);
    expect(found.headers.get("location")).toBe("/en/curriculum/x?page=2");
    expect(found.headers.get("vary")).toBeNull();
  });

  it("leaves the public spelling and a school host to the next decision", () => {
    expect(
      Option.isNone(
        readSpellingRedirectResponse(
          request("https://nakafa.com/en/curriculum")
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        readSpellingRedirectResponse(
          request("https://harapan.nakafa.com/en/curricula")
        )
      )
    ).toBe(true);
  });
});

describe("readSlashRedirectResponse", () => {
  it("answers a trailing slash with a 308 to the canonical path and keeps the query", () => {
    const found = Option.getOrThrow(
      readSlashRedirectResponse(
        request("https://nakafa.com/en/curriculum/?page=2")
      )
    );

    expect(found.status).toBe(308);
    expect(found.headers.get("location")).toBe("/en/curriculum?page=2");
    expect(found.headers.get("vary")).toBeNull();
  });

  it("leaves a canonical path and a shared path to the next decision", () => {
    expect(
      Option.isNone(
        readSlashRedirectResponse(request("https://nakafa.com/en/curriculum"))
      )
    ).toBe(true);
    expect(
      Option.isNone(
        readSlashRedirectResponse(request("https://nakafa.com/api/ping/"))
      )
    ).toBe(true);
  });
});

describe("readMovedResponse", () => {
  it("answers an address that moved with its successor and its status", () => {
    const found = Option.getOrThrow(
      readMovedResponse(request("https://nakafa.com/community?ref=app"))
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe(
      "https://discord.gg/CPCSfKhvfQ?ref=app"
    );
  });

  it("answers a localized address that moved under the locale of its path", () => {
    const found = Option.getOrThrow(
      readMovedResponse(request("https://nakafa.com/id/settings?tab=profile"))
    );

    expect(found.status).toBe(308);
    expect(found.headers.get("location")).toBe("/id/user/settings?tab=profile");
  });

  it("leaves an address that did not move to the next decision", () => {
    expect(
      Option.isNone(
        readMovedResponse(request("https://nakafa.com/en/curriculum"))
      )
    ).toBe(true);
  });
});

describe("readMigrationResponse", () => {
  beforeEach(() => {
    migration.read.mockReset();
  });

  const migrationRequest = (address: string, cookie?: string) =>
    new Request(
      address,
      cookie === undefined ? undefined : { headers: { cookie } }
    );

  it.effect(
    "answers a retired try-out address with its status and the query of the request",
    () =>
      Effect.gen(function* () {
        migration.read.mockReturnValue(
          Effect.succeed({ destination: "/en/tryout/sets/exam", status: 307 })
        );

        const found = Option.getOrThrow(
          yield* readMigrationResponse(
            migrationRequest("https://nakafa.com/en/tryout/old?page=2")
          )
        );

        expect(found.status).toBe(307);
        expect(found.headers.get("location")).toBe(
          "/en/tryout/sets/exam?page=2"
        );
        expect(found.headers.get("vary")).toBeNull();
        expect(migration.read.mock.calls[0]?.[0]).toMatchObject({
          hasAttemptCapability: false,
          markdown: false,
          method: "GET",
          pathname: "/en/tryout/old",
        });
      })
  );

  it.effect(
    "answers a retired profile id with a permanent redirect for the session that asks",
    () =>
      Effect.gen(function* () {
        migration.read.mockReturnValue(
          Effect.succeed({ destination: "/en/@nabilfatih/chat", status: 308 })
        );

        const found = Option.getOrThrow(
          yield* readMigrationResponse(
            migrationRequest(
              "https://nakafa.com/en/user/abc123/chat",
              "session=1"
            )
          )
        );

        expect(found.status).toBe(308);
        expect(found.headers.get("location")).toBe("/en/@nabilfatih/chat");
        expect(found.headers.get("vary")).toBe("Cookie");
        expect(migration.read.mock.calls[0]?.[0].headers.get("cookie")).toBe(
          "session=1"
        );
      })
  );

  it.effect(
    "keeps the Markdown suffix on the successor and asks for the page without it",
    () =>
      Effect.gen(function* () {
        migration.read.mockReturnValue(
          Effect.succeed({ destination: "/de/politik", status: 308 })
        );

        const found = Option.getOrThrow(
          yield* readMigrationResponse(
            migrationRequest("https://nakafa.com/de/articles/politics.md?x=1")
          )
        );

        expect(found.headers.get("location")).toBe("/de/politik.md?x=1");
        expect(migration.read.mock.calls[0]?.[0]).toMatchObject({
          markdown: true,
          pathname: "/de/articles/politics",
        });
      })
  );

  it.effect("answers none when no retired address matches", () =>
    Effect.gen(function* () {
      migration.read.mockReturnValue(Effect.succeed(null));

      expect(
        Option.isNone(
          yield* readMigrationResponse(
            migrationRequest("https://nakafa.com/en/curriculum")
          )
        )
      ).toBe(true);
    })
  );
});

describe("readRemovedAddressNotFound", () => {
  it.effect(
    "answers a removed feature route with not found in the locale it negotiates",
    () =>
      Effect.gen(function* () {
        const locale = Option.getOrThrow(
          yield* readRemovedAddressNotFound(
            request("https://nakafa.com/api/chat/finance", "id-ID")
          )
        );

        expect(locale).toBe("id");
      })
  );

  it.effect(
    "leaves an address that stays to the migrations and the router",
    () =>
      Effect.gen(function* () {
        expect(
          Option.isNone(
            yield* readRemovedAddressNotFound(
              request("https://nakafa.com/en/curriculum")
            )
          )
        ).toBe(true);
      })
  );
});

describe("readMainSiteRedirect", () => {
  it("sends a host under the production domain that names no school to the main site, with its path and query, as a 307", () => {
    const found = Option.getOrThrow(
      readMainSiteRedirect(
        new Request("https://www.nakafa.com/en/curriculum?page=2", {
          headers: { host: "www.nakafa.com" },
        })
      )
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe(
      "https://nakafa.com/en/curriculum?page=2"
    );
  });

  it("keeps a path that starts with two slashes on the main site", () => {
    const found = Option.getOrThrow(
      readMainSiteRedirect(
        new Request("https://www.nakafa.com//evil.com/", {
          headers: { host: "www.nakafa.com" },
        })
      )
    );

    expect(found.headers.get("location")).toBe("https://nakafa.com//evil.com/");
  });

  it("leaves a shared root file on a host that names no school to the router", () => {
    expect(
      Option.isNone(
        readMainSiteRedirect(
          new Request("https://www.nakafa.com/robots.txt", {
            headers: { host: "www.nakafa.com" },
          })
        )
      )
    ).toBe(true);
  });

  it("leaves a school host, the main host and a request without a host to the router", () => {
    for (const host of ["harapan.nakafa.com", "nakafa.com", undefined]) {
      expect(
        Option.isNone(
          readMainSiteRedirect(
            new Request("https://nakafa.com/en", {
              headers: host === undefined ? {} : { host },
            })
          )
        ),
        String(host)
      ).toBe(true);
    }
  });

  it("sends the reserved staging label to the main site when production serves it", () => {
    const found = Option.getOrThrow(
      readMainSiteRedirect(
        new Request("https://staging.nakafa.com/en", {
          headers: { host: "staging.nakafa.com" },
        })
      )
    );

    expect(found.headers.get("location")).toBe("https://nakafa.com/en");
  });

  it("leaves the deployment's own host to the router, and still moves every other refused host", () => {
    vi.stubEnv("SITE_URL", "https://staging.nakafa.com");
    onTestFinished(() => {
      vi.stubEnv("SITE_URL", "https://nakafa.com");
    });
    const answer = (host: string) =>
      readMainSiteRedirect(
        new Request(`https://${host}/en`, { headers: { host } })
      );

    expect(Option.isNone(answer("staging.nakafa.com"))).toBe(true);
    expect(
      Option.getOrThrow(answer("www.nakafa.com")).headers.get("location")
    ).toBe("https://nakafa.com/en");
  });
});
