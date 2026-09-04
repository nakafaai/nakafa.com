// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Effect } from "effect";
import {
  assertContentRuntimeBuildTarget,
  type ContentRuntimeBuildTarget,
  UnsafeContentRuntimeBuildTargetError,
} from "@/content-runtime-build-target";

const productionTarget = {
  agentMode: undefined,
  convexSiteUrl: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`,
  convexUrl: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`,
  vercel: undefined,
  vercelEnvironment: undefined,
  vercelGitCommitSha: undefined,
} satisfies ContentRuntimeBuildTarget;

const failureMessages = {
  "anonymous-production":
    "Anonymous Convex Agent Mode cannot use the production content runtime.",
  "invalid-target":
    "The content runtime build target must use valid Convex URLs.",
  "mixed-production":
    "The content runtime query and HTTP targets cannot mix production with another deployment.",
  "untrusted-production":
    "Production content is restricted to the protected Vercel production build. Import the verified snapshot into isolated Convex Agent Mode for local or CI builds.",
} satisfies Record<UnsafeContentRuntimeBuildTargetError["reason"], string>;

function expectFailure(
  target: ContentRuntimeBuildTarget,
  reason: UnsafeContentRuntimeBuildTargetError["reason"]
) {
  return Effect.gen(function* () {
    const failure = yield* assertContentRuntimeBuildTarget(target).pipe(
      Effect.flip
    );
    expect(failure).toEqual(
      new UnsafeContentRuntimeBuildTargetError({ reason })
    );
    expect(failure.message).toBe(failureMessages[reason]);
  });
}

describe("content runtime build target", () => {
  it.effect("accepts the isolated anonymous Convex runner", () =>
    Effect.gen(function* () {
      expect(
        yield* assertContentRuntimeBuildTarget({
          ...productionTarget,
          agentMode: "anonymous",
          convexSiteUrl: "http://127.0.0.1:3211",
          convexUrl: "http://127.0.0.1:3210",
        })
      ).toBeUndefined();
    })
  );

  it.effect("accepts a task-owned cloud development deployment", () =>
    Effect.gen(function* () {
      expect(
        yield* assertContentRuntimeBuildTarget({
          ...productionTarget,
          convexSiteUrl: "https://helpful-capybara-123.convex.site",
          convexUrl: "https://helpful-capybara-123.convex.cloud",
        })
      ).toBeUndefined();
    })
  );

  it.effect(
    "accepts a development query target before its HTTP URL exists",
    () =>
      Effect.gen(function* () {
        expect(
          yield* assertContentRuntimeBuildTarget({
            ...productionTarget,
            convexSiteUrl: undefined,
            convexUrl: "https://helpful-capybara-123.convex.cloud",
          })
        ).toBeUndefined();
      })
  );

  it.effect("accepts the protected Vercel production build", () =>
    Effect.gen(function* () {
      expect(
        yield* assertContentRuntimeBuildTarget({
          ...productionTarget,
          vercel: "1",
          vercelEnvironment: "production",
          vercelGitCommitSha: "c0730ceec243abd58cf8e0cc98bd04f2da5164c2",
        })
      ).toBeUndefined();
    })
  );

  it.effect(
    "accepts protected Vercel type generation before its HTTP URL exists",
    () =>
      Effect.gen(function* () {
        expect(
          yield* assertContentRuntimeBuildTarget({
            ...productionTarget,
            convexSiteUrl: undefined,
            vercel: "1",
            vercelEnvironment: "production",
            vercelGitCommitSha: "c0730ceec243abd58cf8e0cc98bd04f2da5164c2",
          })
        ).toBeUndefined();
      })
  );

  it.effect("rejects production targets from a local build", () =>
    expectFailure(productionTarget, "untrusted-production")
  );

  it.effect("rejects a local production query before its HTTP URL exists", () =>
    expectFailure(
      { ...productionTarget, convexSiteUrl: undefined },
      "untrusted-production"
    )
  );

  it.effect.each([
    {
      convexSiteUrl: productionTarget.convexSiteUrl,
      convexUrl: `${productionTarget.convexUrl}.`,
      name: "query",
    },
    {
      convexSiteUrl: `${productionTarget.convexSiteUrl}.`,
      convexUrl: productionTarget.convexUrl,
      name: "HTTP",
    },
  ])("rejects a DNS-equivalent production $name target", (urls) =>
    expectFailure({ ...productionTarget, ...urls }, "untrusted-production")
  );

  it.effect("rejects production hidden behind anonymous Agent Mode", () =>
    expectFailure(
      { ...productionTarget, agentMode: "anonymous" },
      "anonymous-production"
    )
  );

  it.effect("rejects production from a Vercel preview", () =>
    expectFailure(
      {
        ...productionTarget,
        vercel: "1",
        vercelEnvironment: "preview",
        vercelGitCommitSha: "c0730ceec243abd58cf8e0cc98bd04f2da5164c2",
      },
      "untrusted-production"
    )
  );

  it.effect.each([
    {
      name: "a missing commit identity",
      target: {
        ...productionTarget,
        vercel: "1" as const,
        vercelEnvironment: "production",
      },
    },
    {
      name: "a blank commit identity",
      target: {
        ...productionTarget,
        vercel: "1" as const,
        vercelEnvironment: "production",
        vercelGitCommitSha: "   ",
      },
    },
  ])("rejects production from Vercel with $name", ({ target }) =>
    expectFailure(target, "untrusted-production")
  );

  it.effect("rejects mixed production query and HTTP targets", () =>
    expectFailure(
      {
        ...productionTarget,
        convexSiteUrl: "https://helpful-capybara-123.convex.site",
      },
      "mixed-production"
    )
  );

  it.effect("rejects mixed development query and production HTTP targets", () =>
    expectFailure(
      {
        ...productionTarget,
        convexUrl: "https://helpful-capybara-123.convex.cloud",
      },
      "mixed-production"
    )
  );

  it.effect("rejects invalid target URLs before build work begins", () =>
    expectFailure(
      { ...productionTarget, convexUrl: "not a URL" },
      "invalid-target"
    )
  );

  it.effect("rejects an invalid HTTP target before build work begins", () =>
    expectFailure(
      { ...productionTarget, convexSiteUrl: "not a URL" },
      "invalid-target"
    )
  );
});
