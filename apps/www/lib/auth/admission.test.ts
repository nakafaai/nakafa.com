// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { getTestInstance } from "better-auth/test";
import { Effect, Option } from "effect";
import {
  getPostAuthContinuationHref,
  getPostAuthDestination,
  getPostAuthIntentSource,
  getPostAuthOnboardingHref,
  getPostAuthProviderErrorHref,
  getPostAuthProviderRetryHref,
  getPostAuthSignInHref,
  getPostAuthSignInHrefForLocation,
  isPostAuthProviderError,
  PostAuthIntentSchema,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";

describe("post-auth admission", () => {
  it("uses localized continuation without inventing an intent", () => {
    expect(getPostAuthContinuationHref(undefined, "id")).toBe(
      "/id/auth/continue"
    );
    expect(getPostAuthContinuationHref(undefined, "unsupported")).toBe(
      "/en/auth/continue"
    );
  });

  it("preserves a trusted browser location as one exact intent source", () => {
    expect(
      getPostAuthIntentSource("/search", "?q=geometry&page=2", "#comments")
    ).toBe("/search?q=geometry&page=2#comments");
    expect(getPostAuthIntentSource("/search", "q=geometry", "comments")).toBe(
      "/search?q=geometry#comments"
    );
    expect(getPostAuthIntentSource("/search", "")).toBe("/search");
  });

  it("builds hash-preserving auth entry from a synthetic location snapshot", () => {
    expect(
      getPostAuthSignInHrefForLocation(
        {
          hash: "#comments",
          pathname: "/id/search",
          search: "?q=geometry&page=2",
        },
        "id"
      )
    ).toBe(
      "/auth?redirect=%2Fid%2Fsearch%3Fq%3Dgeometry%26page%3D2%23comments"
    );
  });

  it("normalizes one localized internal intent", () => {
    const resolution = resolvePostAuthIntent(
      "/id/search?q=a%2Cb#search-results"
    );

    expect(resolution).toEqual({
      intent: "/id/search?q=a%2Cb#search-results",
      kind: "resume",
      locale: "id",
    });
    expect(getPostAuthDestination(resolution, "en")).toEqual({
      href: "/search?q=a%2Cb#search-results",
      locale: "id",
    });
  });

  it("keeps an explicit source locale authoritative across auth", () => {
    expect(getPostAuthContinuationHref("/en/search", "id")).toBe(
      "/id/auth/continue?intent=%2Fen%2Fsearch"
    );
  });

  it("uses the configured default when neither path nor request has a locale", () => {
    expect(resolvePostAuthIntent("/search", "unsupported")).toEqual({
      intent: "/en/search",
      kind: "resume",
      locale: "en",
    });
  });

  it("preserves a deep try-out capability through one query round trip", () => {
    const source =
      "/id/try-out/indonesia/snbt/2027/set-1?attemptId=attempt%2Fone";
    const callback = new URL(
      getPostAuthContinuationHref(source, "id"),
      "https://nakafa.com"
    );
    const intent = callback.searchParams.get("intent");

    expect(intent).toBe(
      "/id/try-out/indonesia/snbt/2027/set-1?attemptId=attempt%2Fone"
    );
    expect(resolvePostAuthIntent(intent)).toEqual({
      intent: "/id/try-out/indonesia/snbt/2027/set-1?attemptId=attempt%2Fone",
      kind: "resume",
      locale: "id",
    });
  });

  it.effect("isolates diagnostics appended by installed Better Auth", () =>
    Effect.gen(function* () {
      const { auth } = yield* Effect.promise(() =>
        getTestInstance({}, { disableTestUser: true })
      );
      const errorCallbackURL = getPostAuthProviderErrorHref(
        "/en/search?q=geometry#results",
        "en"
      );
      const signInResponse = yield* Effect.promise(() =>
        auth.handler(
          new Request("http://localhost:3000/api/auth/sign-in/social", {
            body: JSON.stringify({
              callbackURL: "/en/auth/continue",
              errorCallbackURL,
              provider: "google",
            }),
            headers: {
              "content-type": "application/json",
              origin: "http://localhost:3000",
            },
            method: "POST",
          })
        )
      );
      const authorizationLocation = yield* Effect.fromNullishOr(
        signInResponse.headers.get("location")
      ).pipe(Effect.orDie);
      const state = yield* Effect.fromNullishOr(
        new URL(authorizationLocation).searchParams.get("state")
      ).pipe(Effect.orDie);
      const cookie = signInResponse.headers
        .getSetCookie()
        .map((value) => value.split(";", 1)[0])
        .join("; ");

      const providerResponse = yield* Effect.promise(() =>
        auth.handler(
          new Request(
            `http://localhost:3000/api/auth/callback/google?${new URLSearchParams(
              {
                error: "access_denied",
                error_description: "provider diagnostic",
                state,
              }
            )}`,
            { headers: { cookie } }
          )
        )
      );
      const providerLocation = yield* Effect.fromNullishOr(
        providerResponse.headers.get("location")
      ).pipe(Effect.orDie);
      const providerUrl = new URL(providerLocation, "http://localhost:3000");

      expect(providerResponse.status).toBe(302);
      expect(`${providerUrl.pathname}${providerUrl.search}`).toBe(
        `${errorCallbackURL}&error=access_denied&error_description=provider+diagnostic`
      );

      const retryHref = getPostAuthProviderRetryHref(
        resolvePostAuthIntent(providerUrl.searchParams.get("intent"), "en")
      );
      expect(retryHref).toBe(
        "/auth?redirect=%2Fen%2Fsearch%3Fq%3Dgeometry%23results&error=oauth"
      );
      expect(retryHref).not.toContain("access_denied");
      expect(retryHref).not.toContain("error_description");
      expect(retryHref).not.toContain("provider+diagnostic");
    })
  );

  it("resumes a localized public path in its source locale", () => {
    const intent = resolvePostAuthIntent(
      "/id/kurikulum/merdeka/matematika",
      "de"
    );

    expect(getPostAuthDestination(intent, "de")).toEqual({
      href: "/kurikulum/merdeka/matematika",
      locale: "id",
    });
  });

  it("routes marketing and entry paths without recursive intents", () => {
    expect(resolvePostAuthIntent("/id")).toEqual({
      kind: "none",
      reason: "marketing-root",
    });
    expect(resolvePostAuthIntent("/id/?utm_source=homepage")).toEqual({
      kind: "none",
      reason: "marketing-root",
    });
    expect(resolvePostAuthIntent("/id/auth/continue?intent=/search")).toEqual({
      kind: "none",
      reason: "entry-route",
    });
    expect(resolvePostAuthIntent("/onboarding")).toEqual({
      kind: "none",
      reason: "entry-route",
    });
    expect(resolvePostAuthIntent("/id/home")).toEqual({
      kind: "none",
      reason: "default-route",
    });
  });

  it.each([
    "https://evil.example/search",
    "//evil.example/search",
    "/\\evil.example/search",
    "/search\nmalformed",
    "/api/internal",
    "/_next/static/chunk.js",
    `/${"a".repeat(4096)}`,
  ])("rejects unsafe intent %s", (source) => {
    expect(resolvePostAuthIntent(source)).toEqual({
      kind: "none",
      reason: "invalid",
    });
  });

  it("rejects a URL-normalized intent that expands past the size limit", () => {
    expect(resolvePostAuthIntent(`/${"😀".repeat(400)}`, "id")).toEqual({
      kind: "none",
      reason: "invalid",
    });
  });

  it("rejects an intent whose derived locale prefix exceeds the size limit", () => {
    expect(resolvePostAuthIntent(`/${"a".repeat(4095)}`, "id")).toEqual({
      kind: "none",
      reason: "invalid",
    });
  });

  it.each(["/id/..//evil.example", "/id/%2e%2e//evil.example"])(
    "rejects protocol-relative pathname produced by normalizing %s",
    (source) => {
      expect(resolvePostAuthIntent(source, "id")).toEqual({
        kind: "none",
        reason: "invalid",
      });
      expect(PostAuthIntentSchema.makeOption(source)).toEqual(Option.none());
    }
  );

  it.each([
    "relative",
    "//evil.example/search",
    "/\\evil.example/search",
    "/search\nmalformed",
    `/${"a".repeat(4096)}`,
    "/",
    "/id/home",
    "/id/auth",
    "/id/api/internal",
  ])("keeps invalid values outside the branded intent contract", (source) => {
    expect(PostAuthIntentSchema.makeOption(source)).toEqual(Option.none());
  });

  it("accepts only a localized canonical intent contract", () => {
    expect(PostAuthIntentSchema.makeOption("/id/search")).toEqual(
      Option.some("/id/search")
    );
    expect(PostAuthIntentSchema.makeOption("/search")).toEqual(Option.none());
    expect(PostAuthIntentSchema.makeOption("/unsupported/search")).toEqual(
      Option.none()
    );
  });

  it("rejects duplicate search values represented by the page contract", () => {
    expect(resolvePostAuthIntent(["/search", "/chat/one"])).toEqual({
      kind: "none",
      reason: "invalid",
    });
  });

  it("builds every entry and destination href from the same decision", () => {
    const resume = resolvePostAuthIntent("/chat/chat-id");
    const none = resolvePostAuthIntent(undefined);

    expect(getPostAuthSignInHref(resume)).toBe(
      "/auth?redirect=%2Fen%2Fchat%2Fchat-id"
    );
    expect(getPostAuthOnboardingHref(resume)).toBe(
      "/onboarding?intent=%2Fen%2Fchat%2Fchat-id"
    );
    expect(getPostAuthDestination(resume, "id")).toEqual({
      href: "/chat/chat-id",
      locale: "en",
    });
    expect(getPostAuthSignInHref(none)).toBe("/auth");
    expect(getPostAuthOnboardingHref(none)).toBe("/onboarding");
    expect(getPostAuthDestination(none, "id")).toEqual({
      href: "/home",
      locale: "id",
    });
    expect(getPostAuthDestination(none, "unsupported")).toEqual({
      href: "/home",
      locale: "en",
    });
    expect(getPostAuthProviderErrorHref("/id/search?q=geometry", "id")).toBe(
      "/id/auth/error?intent=%2Fid%2Fsearch%3Fq%3Dgeometry"
    );
    expect(
      getPostAuthProviderErrorHref("https://evil.example", "unsupported")
    ).toBe("/en/auth/error");
    expect(getPostAuthProviderRetryHref(resume)).toBe(
      "/auth?redirect=%2Fen%2Fchat%2Fchat-id&error=oauth"
    );
    expect(getPostAuthProviderRetryHref(none)).toBe("/auth?error=oauth");
    expect(isPostAuthProviderError("oauth")).toBe(true);
    expect(isPostAuthProviderError("access_denied")).toBe(false);
  });
});
