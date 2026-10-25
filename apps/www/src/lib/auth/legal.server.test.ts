// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Option } from "effect";
import {
  readAuthLegalHandler,
  readAuthLegalLinks,
} from "@/lib/auth/legal.server";
import type { PageNavigation } from "@/lib/content/page/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/privacy-policy"),
  getRequestHeaders: () => new Headers({ "accept-language": "de" }),
}));

let pages: Pick<
  PageNavigation,
  "privacyPolicyPath" | "termsOfServicePath"
> | null = null;

vi.mock("@/lib/content/page/navigation", () => ({
  getShellPageNavigation: vi.fn(() => Effect.succeed(pages)),
}));

const signedLinks = {
  privacy: new URL("/id/privacy-policy", SITE_ORIGIN).href,
  terms: new URL("/id/terms-of-service", SITE_ORIGIN).href,
};

describe("sign-in legal links", () => {
  it.effect(
    "links the privacy and terms pages of the locale on the main site",
    () =>
      Effect.gen(function* () {
        pages = {
          privacyPolicyPath: "privacy-policy",
          termsOfServicePath: "terms-of-service",
        };
        const links = yield* readAuthLegalLinks("id");
        expect(Option.getOrNull(links)).toStrictEqual(signedLinks);
        expect(getShellPageNavigation).toHaveBeenCalledWith("id");
      })
  );

  it.effect("answers none when no signed page answers", () =>
    Effect.gen(function* () {
      pages = null;
      const links = yield* readAuthLegalLinks("id");
      expect(Option.isNone(links)).toBe(true);
    })
  );

  it.effect(
    "answers the links of the locale the request names, or of the one it negotiates",
    () =>
      Effect.gen(function* () {
        pages = {
          privacyPolicyPath: "privacy-policy",
          termsOfServicePath: "terms-of-service",
        };
        expect(
          Option.getOrNull(yield* readAuthLegalHandler("id"))
        ).toStrictEqual(signedLinks);
        expect(
          Option.getOrNull(yield* readAuthLegalHandler(undefined))
        ).toStrictEqual({
          privacy: new URL("/de/privacy-policy", SITE_ORIGIN).href,
          terms: new URL("/de/terms-of-service", SITE_ORIGIN).href,
        });
        expect(getShellPageNavigation).toHaveBeenLastCalledWith("de");
      })
  );

  it.effect("answers no links when no signed page answers", () =>
    Effect.gen(function* () {
      pages = null;
      expect(Option.isNone(yield* readAuthLegalHandler("id"))).toBe(true);
    })
  );
});
