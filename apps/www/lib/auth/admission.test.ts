// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { JsonTextSchema } from "@repo/utilities/json";
import { getTestInstance } from "better-auth/test";
import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect";
import {
  getPostAuthDestination,
  getPostAuthIntentSource,
  getPostAuthOnboardingHref,
  getPostAuthProviderErrorHref,
  getPostAuthProviderRetrySearch,
  getPostAuthSignInHref,
  getPostAuthSignInHrefForLocation,
  isPostAuthProviderError,
  PostAuthIntentSchema,
  resolvePostAuthIntent,
  startsSchool,
} from "@/lib/auth/admission";

describe("post-auth admission", () => {
  it("uses localized onboarding without inventing an intent", () => {
    expect(getPostAuthOnboardingHref(undefined, "id")).toBe("/id/onboarding");
    expect(getPostAuthOnboardingHref(undefined, "unsupported")).toBe(
      "/en/onboarding"
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

  it("never carries a share token into an auth route, whichever helper builds it", () => {
    // 43 URL-safe characters, the shape of a share token.
    const token = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";
    const source = `/en/chat/chat-id#share=${token}`;
    const resume = resolvePostAuthIntent(source, "en");

    expect(resume).toEqual({
      intent: "/en/chat/chat-id",
      kind: "resume",
      locale: "en",
    });
    expect(
      getPostAuthSignInHrefForLocation(
        { hash: `#share=${token}`, pathname: "/en/chat/chat-id", search: "" },
        "en"
      )
    ).toBe("/auth?redirect=%2Fen%2Fchat%2Fchat-id");
    for (const href of [
      getPostAuthSignInHref(resume),
      getPostAuthOnboardingHref(source, "en"),
      getPostAuthProviderErrorHref(source, "en"),
      new URLSearchParams(getPostAuthProviderRetrySearch(resume)).toString(),
      getPostAuthDestination(resume, "en").href,
    ]) {
      expect(href).not.toContain(token);
      expect(href).not.toContain("share");
    }
  });

  it("keeps the other entries of a fragment that carried a share token", () => {
    expect(
      resolvePostAuthIntent(`/en/chat/chat-id#a=1&share=${"A".repeat(43)}`)
    ).toMatchObject({ intent: "/en/chat/chat-id#a=1", kind: "resume" });
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
    expect(getPostAuthOnboardingHref("/en/search", "id")).toBe(
      "/id/onboarding?intent=%2Fen%2Fsearch"
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
      getPostAuthOnboardingHref(source, "id"),
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
      const signInBody = yield* Schema.encodeEffect(JsonTextSchema)({
        callbackURL: "/en/onboarding",
        errorCallbackURL,
        provider: "google",
      });
      const signInResponse = yield* Effect.promise(() =>
        auth.handler(
          new Request("http://localhost:3000/api/auth/sign-in/social", {
            body: signInBody,
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
      const cookie = Arr.join(
        Arr.map(
          signInResponse.headers.getSetCookie(),
          (value) => value.split(";", 1)[0]
        ),
        "; "
      );

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

      const retrySearch = getPostAuthProviderRetrySearch(
        resolvePostAuthIntent(providerUrl.searchParams.get("intent"), "en")
      );
      expect(retrySearch).toStrictEqual({
        error: "oauth",
        redirect: "/en/search?q=geometry#results",
      });
      expect(Rec.values(retrySearch)).not.toContain("access_denied");
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
    expect(resolvePostAuthIntent("/id/auth/error?intent=/search")).toEqual({
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
    "/assets/index-chunk.js",
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
    expect(getPostAuthOnboardingHref("/chat/chat-id", "en")).toBe(
      "/en/onboarding?intent=%2Fen%2Fchat%2Fchat-id"
    );
    expect(getPostAuthDestination(resume, "id")).toEqual({
      href: "/chat/chat-id",
      locale: "en",
    });
    expect(getPostAuthSignInHref(none)).toBe("/auth");
    expect(getPostAuthOnboardingHref(undefined, "id")).toBe("/id/onboarding");
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
    expect(getPostAuthProviderRetrySearch(resume)).toStrictEqual({
      error: "oauth",
      redirect: "/en/chat/chat-id",
    });
    expect(getPostAuthProviderRetrySearch(none)).toStrictEqual({
      error: "oauth",
    });
    expect(isPostAuthProviderError("oauth")).toBe(true);
    expect(isPostAuthProviderError("access_denied")).toBe(false);
  });
  it("lets the page that opens a school stand in for the learner's first run", () => {
    expect(startsSchool(resolvePostAuthIntent("/id/school/new", "id"))).toBe(
      true
    );
    expect(
      startsSchool(resolvePostAuthIntent("/en/school/new?from=pricing", "id"))
    ).toBe(true);
    expect(startsSchool(resolvePostAuthIntent("/id/try-out", "id"))).toBe(
      false
    );
    expect(startsSchool(resolvePostAuthIntent(undefined, "id"))).toBe(false);
  });
});
