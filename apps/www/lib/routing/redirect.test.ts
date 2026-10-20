// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  readMigrationResponse,
  readRedirectResponse,
  readRemovedAddressNotFound,
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

describe("readRedirectResponse", () => {
  it("answers the root with the negotiated locale, a 307 and its Vary headers", () => {
    const response = readRedirectResponse(
      request("https://nakafa.com/", "id-ID,id;q=0.9")
    );

    expect(Option.isSome(response)).toBe(true);
    const found = Option.getOrThrow(response);
    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe("/id");
    expect(found.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it("leaves the root of a school host to the school home, which the router serves", () => {
    expect(
      Option.isNone(
        readRedirectResponse(request("https://harapan.nakafa.com/"))
      )
    ).toBe(true);
  });

  it("answers a trailing slash on a public path with a 308 to the canonical path", () => {
    const found = Option.getOrThrow(
      readRedirectResponse(request("https://nakafa.com/en/curriculum/"))
    );

    expect(found.status).toBe(308);
    expect(found.headers.get("location")).toBe("/en/curriculum");
  });

  it("leaves a canonical path and a shared path to the router", () => {
    expect(
      Option.isNone(
        readRedirectResponse(request("https://nakafa.com/en/curriculum"))
      )
    ).toBe(true);
    expect(
      Option.isNone(
        readRedirectResponse(request("https://nakafa.com/api/ping/"))
      )
    ).toBe(true);
  });

  it("keeps a school host without a locale redirect on its home", () => {
    expect(
      Option.isNone(
        readRedirectResponse(request("https://harapan.nakafa.com/"))
      )
    ).toBe(true);
  });
  it("answers an address that moved with its successor before the locale rules", () => {
    const found = Option.getOrThrow(
      readRedirectResponse(request("https://nakafa.com/community?ref=app"))
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe(
      "https://discord.gg/CPCSfKhvfQ?ref=app"
    );
  });

  it("opens a bare profile address and its tab in the negotiated locale, with a 307 and its Vary headers", () => {
    const found = Option.getOrThrow(
      readRedirectResponse(
        request("https://nakafa.com/@nobody_has_this/chat?tab=1", "id-ID")
      )
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe(
      "/id/@nobody_has_this/chat?tab=1"
    );
    expect(found.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it("leaves a bare profile address of a school host to the router", () => {
    expect(
      Option.isNone(
        readRedirectResponse(
          request("https://harapan.nakafa.com/@nobody_has_this")
        )
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
        expect(found.headers.get("vary")).toBe("Cookie");
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
