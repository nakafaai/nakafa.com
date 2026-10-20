// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { appendResponseHeader } from "@tanstack/react-start/server";
import { Array as Arr, Effect, Option } from "effect";
import type { PageNavigation } from "@/lib/content/page/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import {
  onboardingPageHandler,
  schoolStartPageHandler,
} from "@/lib/entry/page.fn";
import { recordOnboardingAdmission } from "@/lib/onboarding/server";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

/** The request session, the onboarding status and the policy pages of the current test. */
let session = {
  convexToken: Option.none<string>(),
  setCookies: Arr.empty<string>(),
};
let status = {
  isAuthenticated: true,
  isRequired: true,
  profile: { role: "student" },
};
let pages: Pick<
  PageNavigation,
  "privacyPolicyHref" | "termsOfServiceHref"
> | null = null;

vi.mock("@tanstack/react-start/server", () => ({
  appendResponseHeader: vi.fn(),
  getRequest: () => new Request("https://nakafa.com/en/onboarding"),
}));

vi.mock("@/lib/auth/session.server", () => ({
  createRequestSession: () => Effect.succeed(Effect.succeed(session)),
}));

vi.mock("@/lib/onboarding/server", () => ({
  recordOnboardingAdmission: vi.fn(() => Effect.succeed(status)),
}));

vi.mock("@/lib/content/page/navigation", () => ({
  getShellPageNavigation: vi.fn(() => Promise.resolve(pages)),
}));

const signedIn = () => Option.some("convex-token");

describe("onboarding page", () => {
  it("sends a visitor without a session to sign in, in the locale", async () => {
    session = { convexToken: Option.none(), setCookies: [] };
    await expect(
      onboardingPageHandler({ data: { locale: "en" } })
    ).resolves.toStrictEqual({ _tag: "Redirect", href: "/en/auth" });
  });

  it("sends an account that the server does not authenticate to sign in", async () => {
    session = { convexToken: signedIn(), setCookies: [] };
    status = {
      isAuthenticated: false,
      isRequired: true,
      profile: { role: "student" },
    };
    await expect(
      onboardingPageHandler({ data: { locale: "id" } })
    ).resolves.toStrictEqual({ _tag: "Redirect", href: "/id/auth" });
  });

  it("sends an account whose questionnaire is done to its destination", async () => {
    session = { convexToken: signedIn(), setCookies: [] };
    status = {
      isAuthenticated: true,
      isRequired: false,
      profile: { role: "student" },
    };
    await expect(
      onboardingPageHandler({ data: { locale: "de" } })
    ).resolves.toStrictEqual({ _tag: "Redirect", href: "/de/home" });
  });

  it("sends an account that starts a school to its destination first", async () => {
    session = { convexToken: signedIn(), setCookies: [] };
    status = {
      isAuthenticated: true,
      isRequired: true,
      profile: { role: "student" },
    };
    await expect(
      onboardingPageHandler({
        data: { intent: "/en/school/new", locale: "en" },
      })
    ).resolves.toStrictEqual({ _tag: "Redirect", href: "/en/school/new" });
  });

  it("returns the questionnaire with the profile of a required account", async () => {
    session = { convexToken: signedIn(), setCookies: ["refreshed=1"] };
    status = {
      isAuthenticated: true,
      isRequired: true,
      profile: { role: "teacher" },
    };
    const page = await onboardingPageHandler({ data: { locale: "en" } });
    expect(page).toStrictEqual({
      _tag: "Questionnaire",
      intent: { kind: "none", reason: "absent" },
      profile: { role: "teacher" },
    });
    expect(appendResponseHeader).toHaveBeenCalledWith(
      "set-cookie",
      "refreshed=1"
    );
    expect(recordOnboardingAdmission).toHaveBeenCalledWith("convex-token");
  });
});

describe("school start page", () => {
  it("sends a visitor to sign in, back to the school start page", async () => {
    session = { convexToken: Option.none(), setCookies: [] };
    await expect(
      schoolStartPageHandler({ data: { locale: "en" } })
    ).resolves.toStrictEqual({
      _tag: "Redirect",
      href: "/en/auth?redirect=%2Fen%2Fschool%2Fnew",
    });
  });

  it("links the policy pages of the locale for a signed-in visitor", async () => {
    session = { convexToken: signedIn(), setCookies: [] };
    pages = {
      privacyPolicyHref: "/privacy-policy",
      termsOfServiceHref: "/terms-of-service",
    };
    await expect(
      schoolStartPageHandler({ data: { locale: "id" } })
    ).resolves.toStrictEqual({
      _tag: "Start",
      legal: {
        privacy: "https://nakafa.com/id/privacy-policy",
        terms: "https://nakafa.com/id/terms-of-service",
      },
    });
    expect(getShellPageNavigation).toHaveBeenCalledWith("id");
  });

  it("starts without policy links when the locale has no page navigation", async () => {
    session = { convexToken: signedIn(), setCookies: [] };
    pages = null;
    await expect(
      schoolStartPageHandler({ data: { locale: "de" } })
    ).resolves.toStrictEqual({ _tag: "Start", legal: null });
  });
});
