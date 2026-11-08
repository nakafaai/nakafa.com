// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readBareAddress } from "@/lib/routing/locale/bare";

vi.mock("@/lib/routing/rendered", async () => {
  const { isBarePath } = await import("@/lib/routing/template");
  const { routeRewrite } = await import("@/lib/routing/rewrite");
  /** The route templates of a stand-in tree with its own Worker routes, without loading the router. */
  const templates = [
    "/$locale/chat",
    "/$locale/quran/$surah",
    "/.well-known/agent-skills/index.json",
    "/api/v1/$",
    "/mcp",
    "/school/$slug/exams",
  ];
  return {
    isBareRoutePath: (url: URL) =>
      isBarePath(routeRewrite.input({ url }).pathname, templates),
  };
});

/** A request to an address, with the visitor's languages and cookie when given. */
const request = (
  address: string,
  headers: { readonly language?: string; readonly cookie?: string } = {}
) =>
  new Request(address, {
    headers: {
      ...(headers.language === undefined
        ? {}
        : { "accept-language": headers.language }),
      ...(headers.cookie === undefined ? {} : { cookie: headers.cookie }),
    },
  });

/** The location that a bare address moves to, or none. */
const locationOf = (
  address: string,
  headers?: { readonly language?: string; readonly cookie?: string }
) =>
  Option.map(readBareAddress(request(address, headers)), (answer) =>
    answer.headers.get("location")
  );

describe("readBareAddress", () => {
  it("opens a bare page address and its query in the negotiated locale, with a 307 that varies", () => {
    const found = Option.getOrThrow(
      readBareAddress(
        request("https://nakafa.com/@nobody_has_this/chat?tab=1", {
          language: "id-ID",
        })
      )
    );

    expect(found.status).toBe(307);
    expect(found.headers.get("location")).toBe(
      "/id/@nobody_has_this/chat?tab=1"
    );
    expect(found.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it.each([
    [
      "https://nakafa.com/quran/2?ayah=5",
      "en-US,en;q=0.9",
      "/en/quran/2?ayah=5",
    ],
    ["https://nakafa.com/chat", "de-DE", "/de/chat"],
    [
      "https://nakafa.com/try-out/indonesia/snbt",
      "id",
      "/id/try-out/indonesia/snbt",
    ],
    ["https://nakafa.com/school", "id-ID,id;q=0.9", "/id/school"],
    [
      "https://nakafa.com/school/pricing?plan=pro&period=12",
      "de",
      "/de/school/pricing?plan=pro&period=12",
    ],
    ["https://nakafa.com/school/enter", "en", "/en/school/enter"],
    ["https://nakafa.com/school/new", "fr-FR", "/id/school/new"],
  ])("opens %s for %s at %s", (address, language, location) => {
    expect(locationOf(address, { language })).toStrictEqual(
      Option.some(location)
    );
  });

  it("opens a bare address in Indonesian when the visitor names no Nakafa language", () => {
    expect(
      locationOf("https://nakafa.com/quran/2", { language: "fr-FR,ja" })
    ).toStrictEqual(Option.some("/id/quran/2"));
    expect(locationOf("https://nakafa.com/school")).toStrictEqual(
      Option.some("/id/school")
    );
  });

  it("opens a bare address in the locale of the visitor's cookie before their languages", () => {
    expect(
      locationOf("https://nakafa.com/school", {
        cookie: "NAKAFA_LOCALE=de",
        language: "en",
      })
    ).toStrictEqual(Option.some("/de/school"));
  });

  it("opens a bare address in the locale that its first segment spells, with a 308 that no request header changes", () => {
    for (const [address, location] of [
      [
        "https://nakafa.com/materi/ai-ds/pemrograman-ai/fungsi-print?ctx=a",
        "/id/materi/ai-ds/pemrograman-ai/fungsi-print?ctx=a",
      ],
      [
        "https://nakafa.com/subjects/ai-ds/ai-programming/numbers",
        "/en/subjects/ai-ds/ai-programming/numbers",
      ],
      ["https://nakafa.com/lehrplaene", "/de/lehrplaene"],
    ] as const) {
      const found = Option.getOrThrow(
        readBareAddress(request(address, { language: "fr-FR" }))
      );

      expect(found.status).toBe(308);
      expect(found.headers.get("location")).toBe(location);
      expect(found.headers.get("vary")).toBeNull();
    }
  });

  it.each([
    "https://nakafa.com/wp-login.php",
    "https://nakafa.com/robots.txt",
    "https://nakafa.com/sitemap/missing.xml",
    "https://nakafa.com/feed.xml",
    "https://nakafa.com/fr/subjects",
    "https://nakafa.com/EN",
    "https://nakafa.com/",
    "https://nakafa.com/id/quran/2",
    "https://nakafa.com/api/v1/me",
    "https://nakafa.com/mcp",
    "https://nakafa.com/.well-known/agent-skills/index.json",
    "https://nakafa.com/school/harapan",
    "https://nakafa.com/school/pricing/extra",
    "https://harapan.nakafa.com/exams",
    "https://harapan.nakafa.com/school/pricing",
  ])("leaves %s to the other answers", (address) => {
    expect(
      Option.isNone(readBareAddress(request(address, { language: "id" })))
    ).toBe(true);
  });
});
