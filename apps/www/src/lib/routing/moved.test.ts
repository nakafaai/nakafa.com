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

  it("leaves a locale's about page to the router, which serves the signed page", () => {
    expect(Option.isNone(readAt("/en/about"))).toBe(true);
  });

  it("answers a bare retired address with its successor", () => {
    expect(Option.getOrThrow(readAt("/about"))).toEqual({
      location: "/en/about",
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
    expect(
      Option.getOrThrow(
        readAt("/de/lehrplaene/singapur-moe/sekundarstufe/naturwissenschaften")
      )
    ).toEqual({
      location: "/de/lehrplaene/singapur-moe/sekundarstufe",
      status: 308,
    });
    expect(
      Option.getOrThrow(
        readAt("/en/curriculum/singapore-moe/secondary/science")
      )
    ).toEqual({
      location: "/en/curriculum/singapore-moe/secondary",
      status: 308,
    });
    expect(
      Option.getOrThrow(readAt("/id/kurikulum/singapore-moe/secondary/sains"))
    ).toEqual({
      location: "/id/kurikulum/singapore-moe/secondary",
      status: 308,
    });
    expect(
      Option.getOrThrow(
        readAt("/ms/kurikulum/singapore-moe/sekolah-menengah/sains")
      )
    ).toEqual({
      location: "/ms/kurikulum/singapore-moe/sekolah-menengah",
      status: 308,
    });
    expect(Option.isNone(readAt("/id/latihan/tka/matematika"))).toBe(true);
  });

  it("answers a path that names its locale twice with the same path under it once", () => {
    expect(
      readMovedRedirect(
        new URL(
          "https://nakafa.com/de/de/faecher/mathematik/funktionen-und-modelle/exponentialfunktion"
        )
      )
    ).toStrictEqual(
      Option.some({
        location:
          "/de/faecher/mathematik/funktionen-und-modelle/exponentialfunktion",
        status: 308,
      })
    );
    expect(
      readMovedRedirect(
        new URL(
          "https://nakafa.com/en/en/subjects/mathematics/function-transformation/horizontal-translation?x=1"
        )
      )
    ).toStrictEqual(
      Option.some({
        location:
          "/en/subjects/mathematics/function-transformation/horizontal-translation?x=1",
        status: 308,
      })
    );
  });

  it("leaves a current address and an unknown locale to the router", () => {
    expect(Option.isNone(readAt("/en/curriculum"))).toBe(true);
    expect(Option.isNone(readAt("/fr/about"))).toBe(true);
  });
});
