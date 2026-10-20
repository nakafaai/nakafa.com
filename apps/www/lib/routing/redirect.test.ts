// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readRedirectResponse } from "@/lib/routing/redirect";

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
});
