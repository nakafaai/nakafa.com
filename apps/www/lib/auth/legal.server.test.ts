// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Option } from "effect";
import {
  readAuthLegalAnswer,
  readAuthLegalLinks,
} from "@/lib/auth/legal.server";
import type { PageNavigation } from "@/lib/content/page/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/privacy-policy"),
}));

let pages: Pick<
  PageNavigation,
  "privacyPolicyHref" | "termsOfServiceHref"
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
          privacyPolicyHref: "/privacy-policy",
          termsOfServiceHref: "/terms-of-service",
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

  it("answers the links on the wire, or null when none", async () => {
    pages = {
      privacyPolicyHref: "/privacy-policy",
      termsOfServiceHref: "/terms-of-service",
    };
    await expect(readAuthLegalAnswer("id")).resolves.toStrictEqual(signedLinks);
    pages = null;
    await expect(readAuthLegalAnswer("id")).resolves.toBeNull();
  });
});
