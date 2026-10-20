// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  createNotFoundRequest,
  NOT_FOUND_LOCALE_HEADER,
  NOT_FOUND_PATH,
  readNotFoundLocale,
  withContentLanguage,
} from "@/lib/routing/not-found";

describe("readNotFoundLocale", () => {
  it("reads the locale that the server names in its header", () => {
    expect(
      readNotFoundLocale(new Headers({ [NOT_FOUND_LOCALE_HEADER]: "id" }))
    ).toBe("id");
  });

  it("answers the default locale for a missing or unknown locale", () => {
    expect(readNotFoundLocale(new Headers())).toBe("en");
    expect(
      readNotFoundLocale(new Headers({ [NOT_FOUND_LOCALE_HEADER]: "zz" }))
    ).toBe("en");
  });
});

describe("createNotFoundRequest", () => {
  it("moves the request to the standalone page with its locale, keeping the host and the cookies", () => {
    const next = createNotFoundRequest(
      new Request("https://harapan.nakafa.com/exams/?page=2", {
        headers: {
          cookie: "session=1",
          host: "harapan.nakafa.com",
        },
        method: "HEAD",
      }),
      "de"
    );

    expect(new URL(next.url).href).toBe(
      `https://harapan.nakafa.com${NOT_FOUND_PATH}`
    );
    expect(next.method).toBe("GET");
    expect(next.headers.get(NOT_FOUND_LOCALE_HEADER)).toBe("de");
    expect(next.headers.get("cookie")).toBe("session=1");
    expect(next.headers.get("host")).toBe("harapan.nakafa.com");
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
