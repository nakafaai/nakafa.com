// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Option } from "effect";
import {
  readAuthLegalAnswer,
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
  getShellPageNavigation: vi.fn(() => Promise.resolve(pages)),
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

  it("answers the links of the locale the request names, or of the one it negotiates", async () => {
    pages = {
      privacyPolicyPath: "privacy-policy",
      termsOfServicePath: "terms-of-service",
    };
    await expect(readAuthLegalHandler("id")).resolves.toStrictEqual(
      signedLinks
    );
    await expect(readAuthLegalHandler(undefined)).resolves.toStrictEqual({
      privacy: new URL("/de/privacy-policy", SITE_ORIGIN).href,
      terms: new URL("/de/terms-of-service", SITE_ORIGIN).href,
    });
    expect(getShellPageNavigation).toHaveBeenLastCalledWith("de");
  });

  it("answers the links on the wire, or null when none", async () => {
    pages = {
      privacyPolicyPath: "privacy-policy",
      termsOfServicePath: "terms-of-service",
    };
    await expect(readAuthLegalAnswer("id")).resolves.toStrictEqual(signedLinks);
    pages = null;
    await expect(readAuthLegalAnswer("id")).resolves.toBeNull();
  });
});
