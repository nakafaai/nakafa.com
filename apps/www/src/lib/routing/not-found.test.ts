// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  notFoundPageOf,
  readNotFoundContext,
  readNotFoundPageLocale,
  withContentLanguage,
} from "@/lib/routing/not-found";

describe("notFoundPageOf", () => {
  it("names the locale, on the main site", () => {
    expect(
      notFoundPageOf(
        new Request("https://nakafa.com/en/school/xyz", {
          headers: { host: "nakafa.com" },
        }),
        "id"
      )
    ).toStrictEqual({ locale: "id", school: false });
  });

  it("knows a request that came to a school host", () => {
    expect(
      notFoundPageOf(
        new Request("https://harapan.nakafa.com/settings", {
          headers: { host: "harapan.nakafa.com" },
        }),
        "de"
      )
    ).toStrictEqual({ locale: "de", school: true });
  });
});

describe("readNotFoundContext", () => {
  it("reads the not-found page that the server context names", () => {
    expect(
      readNotFoundContext({ notFound: { locale: "en", school: true } })
    ).toStrictEqual(Option.some({ locale: "en", school: true }));
  });

  it("answers none for a request that the router answers, and in the browser", () => {
    expect(Option.isNone(readNotFoundContext({}))).toBe(true);
    expect(Option.isNone(readNotFoundContext(undefined))).toBe(true);
    expect(
      Option.isNone(
        readNotFoundContext({ notFound: { locale: "zz", school: false } })
      )
    ).toBe(true);
  });
});

describe("readNotFoundPageLocale", () => {
  it("reads the locale of the not-found error of the standalone page", () => {
    expect(
      readNotFoundPageLocale({
        data: { locale: "id", school: false },
        isNotFound: true,
      })
    ).toStrictEqual(Option.some("id"));
  });

  it("answers none for any other error, and for a page error without a known locale", () => {
    expect(Option.isNone(readNotFoundPageLocale(new Error("broken")))).toBe(
      true
    );
    expect(
      Option.isNone(
        readNotFoundPageLocale({
          data: { locale: "zz", school: false },
          isNotFound: true,
        })
      )
    ).toBe(true);
    expect(Option.isNone(readNotFoundPageLocale({ isNotFound: true }))).toBe(
      true
    );
  });
});

describe("withContentLanguage", () => {
  it("names the language of the page and keeps its status and headers", async () => {
    const answered = withContentLanguage(
      new Response("missing", {
        headers: { "x-robots-tag": "noindex" },
        status: 404,
        statusText: "Not Found",
      }),
      "id"
    );

    expect(answered.status).toBe(404);
    expect(answered.statusText).toBe("Not Found");
    expect(answered.headers.get("content-language")).toBe("id");
    expect(answered.headers.get("x-robots-tag")).toBe("noindex");
    expect(await answered.text()).toBe("missing");
  });
});
