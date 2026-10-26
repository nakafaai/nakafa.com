import { describe, expect, it } from "@effect/vitest";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";
import { isSignInPath, SIGN_IN_PATHS, signInPath } from "@/lib/routing/signin";

describe("sign-in paths", () => {
  it("names the sign-in page of every locale", () => {
    expect(signInPath("id")).toBe("/id/auth");
    expect(SIGN_IN_PATHS).toEqual(
      Arr.map(LOCALES, (locale) => `/${locale}/auth`)
    );
  });

  it("recognizes only a locale's sign-in page", () => {
    expect(isSignInPath("/en/auth")).toBe(true);
    expect(isSignInPath("/de/auth")).toBe(true);
    expect(isSignInPath("/en/auth/error")).toBe(false);
    expect(isSignInPath("/en/onboarding")).toBe(false);
    expect(isSignInPath("/xx/auth")).toBe(false);
    expect(isSignInPath("/auth")).toBe(false);
  });
});
