// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/profiles";
import { Option } from "effect";
import { readMovedRedirect } from "@/lib/routing/moved";

const readAt = (address: string) =>
  readMovedRedirect(new URL(address, "https://nakafa.com"));

describe("readMovedRedirect", () => {
  it("answers a retired localized page with its successor under the same locale and query", () => {
    expect(Option.getOrThrow(readAt("/en/settings?tab=profile"))).toEqual({
      location: "/en/user/settings?tab=profile",
      status: 308,
    });
  });

  it("answers the retired about page of a locale with the locale root", () => {
    expect(Option.getOrThrow(readAt("/id/about"))).toEqual({
      location: "/id",
      status: 308,
    });
  });

  it("answers a bare retired address with its successor", () => {
    expect(Option.getOrThrow(readAt("/about"))).toEqual({
      location: "/",
      status: 308,
    });
    expect(Option.getOrThrow(readAt("/sitemap.txt"))).toEqual({
      location: "/sitemap.xml",
      status: 308,
    });
  });

  it("answers the community links with a temporary redirect to Discord", () => {
    expect(Option.getOrThrow(readAt("/community"))).toEqual({
      location: COMPANY_SOCIAL_PROFILES.discord,
      status: 307,
    });
    expect(Option.getOrThrow(readAt("/discord"))).toEqual({
      location: COMPANY_SOCIAL_PROFILES.discord,
      status: 307,
    });
  });

  it("answers a retired page that search still shows with the page that took over its job", () => {
    expect(Option.getOrThrow(readAt("/id/latihan/tka"))).toEqual({
      location: "/id/try-out/indonesia/tka",
      status: 308,
    });
    expect(Option.getOrThrow(readAt("/en/subject/high-school/11"))).toEqual({
      location: "/en/curriculum/merdeka/class-11",
      status: 308,
    });
    expect(Option.isNone(readAt("/id/latihan/tka/matematika"))).toBe(true);
  });

  it("leaves a current address and an unknown locale to the router", () => {
    expect(Option.isNone(readAt("/en/curriculum"))).toBe(true);
    expect(Option.isNone(readAt("/fr/about"))).toBe(true);
  });
});
