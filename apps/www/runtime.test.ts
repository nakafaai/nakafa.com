// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Effect } from "effect";
import {
  assertRuntimeTarget,
  type RuntimeTarget,
  readRuntimeConfig,
  UnsafeRuntimeError,
} from "@/runtime";

const emptyIdentity = {
  deployment: undefined,
  environment: undefined,
  git: {
    branch: undefined,
    commit: undefined,
    owner: undefined,
    provider: undefined,
    repository: undefined,
  },
  marker: undefined,
  project: undefined,
  target: undefined,
} satisfies RuntimeTarget["vercel"];

const productionIdentity = {
  deployment: "dpl_CRMGPNJvKacYy5e7i77WkJXLS3FK",
  environment: "production",
  git: {
    branch: "main",
    commit: "c0730ceec243abd58cf8e0cc98bd04f2da5164c2",
    owner: "nakafaai",
    provider: "github",
    repository: "nakafa.com",
  },
  marker: "1",
  project: "prj_QfxvXBST46wuSTOXPn4PE32NqbF4",
  target: "production",
} as const satisfies RuntimeTarget["vercel"];

const productionTarget = {
  agent: undefined,
  query: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`,
  site: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`,
  vercel: emptyIdentity,
} satisfies RuntimeTarget;

afterEach(() => {
  vi.unstubAllEnvs();
});

function identity(
  value: Partial<Omit<RuntimeTarget["vercel"], "git">> = {},
  git: Partial<RuntimeTarget["vercel"]["git"]> = {}
) {
  return {
    ...productionIdentity,
    ...value,
    git: { ...productionIdentity.git, ...git },
  } satisfies RuntimeTarget["vercel"];
}

function expectFailure(
  target: RuntimeTarget,
  reason: UnsafeRuntimeError["reason"]
) {
  return Effect.gen(function* () {
    const result = yield* assertRuntimeTarget(target).pipe(Effect.flip);
    expect(result).toEqual(new UnsafeRuntimeError({ reason }));
    expect(result.message.length).toBeGreaterThan(0);
  });
}

function expectSuccess(target: RuntimeTarget) {
  return Effect.gen(function* () {
    expect(yield* assertRuntimeTarget(target)).toBeUndefined();
  });
}

describe("content runtime target", () => {
  it("accepts an isolated environment at the Next configuration boundary", () => {
    vi.stubEnv("CONVEX_AGENT_MODE", "anonymous");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3210");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "http://127.0.0.1:3211");

    expect(readRuntimeConfig).not.toThrow();
  });

  it("blocks unsafe production at the Next configuration boundary", () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", productionTarget.query);
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", productionTarget.site);

    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "untrusted-production" })
    );
  });

  it.effect.each([
    {
      name: "IPv4",
      query: "http://127.0.0.1:3210",
      site: "http://127.0.0.1:3211",
    },
    {
      name: "IPv6 without an HTTP target",
      query: "http://[::1]:3210",
      site: undefined,
    },
    {
      name: "localhost",
      query: "http://localhost:3210",
      site: "http://localhost:3211",
    },
  ])("accepts isolated anonymous $name", ({ query, site }) =>
    expectSuccess({ ...productionTarget, agent: "anonymous", query, site })
  );

  it.effect("accepts a non-agent loopback target", () =>
    expectSuccess({
      ...productionTarget,
      query: "http://127.0.0.1:3210",
      site: "http://127.0.0.1:3211",
    })
  );

  it.effect.each([
    { site: "https://helpful-capybara-123.convex.site" },
    { site: undefined },
  ])("accepts a task-owned Convex deployment", ({ site }) =>
    expectSuccess({
      ...productionTarget,
      query: "https://helpful-capybara-123.convex.cloud",
      site,
    })
  );

  it.effect.each([
    { name: "query and HTTP", site: productionTarget.site },
    { name: "query only", site: undefined },
  ])("accepts protected production with $name", ({ site }) =>
    expectSuccess({
      ...productionTarget,
      site,
      vercel: productionIdentity,
    })
  );

  it.effect.each([
    { name: "both default domains", target: productionTarget },
    {
      name: "only the query domain",
      target: { ...productionTarget, site: undefined },
    },
    {
      name: "a nested Convex-like hostname",
      target: {
        ...productionTarget,
        query: "https://nested.helpful-capybara-123.convex.cloud",
        site: undefined,
      },
    },
    {
      name: "an empty Convex deployment hostname",
      target: {
        ...productionTarget,
        query: "https://.convex.cloud",
        site: undefined,
      },
    },
    {
      name: "a DNS-equivalent production hostname",
      target: { ...productionTarget, query: `${productionTarget.query}.` },
    },
  ])("rejects untrusted $name", ({ target }) =>
    expectFailure(target, "untrusted-production")
  );

  it.effect("rejects anonymous production", () =>
    expectFailure(
      {
        ...productionTarget,
        agent: "anonymous",
        vercel: productionIdentity,
      },
      "anonymous-production"
    )
  );

  it.effect.each([
    { name: "marker", vercel: identity({ marker: undefined }) },
    { name: "deployment", vercel: identity({ deployment: undefined }) },
    {
      name: "deployment format",
      vercel: identity({ deployment: "not-a-deployment" }),
    },
    { name: "environment", vercel: identity({ environment: "preview" }) },
    { name: "target", vercel: identity({ target: "preview" }) },
    { name: "project", vercel: identity({ project: "prj_other" }) },
    { name: "Git provider", vercel: identity({}, { provider: "gitlab" }) },
    { name: "Git owner", vercel: identity({}, { owner: "other" }) },
    {
      name: "Git repository",
      vercel: identity({}, { repository: "other" }),
    },
    { name: "Git branch", vercel: identity({}, { branch: "feature/cost" }) },
    { name: "commit", vercel: identity({}, { commit: undefined }) },
    {
      name: "commit format",
      vercel: identity({}, { commit: "not-a-commit" }),
    },
  ])("rejects production when the $name credential is wrong", ({ vercel }) =>
    expectFailure({ ...productionTarget, vercel }, "untrusted-production")
  );

  it.effect.each([
    {
      name: "a task-owned default deployment",
      query: "https://helpful-capybara-123.convex.cloud",
      site: "https://helpful-capybara-123.convex.site",
      vercel: productionIdentity,
    },
    {
      name: "a task-owned HTTP deployment",
      query: productionTarget.query,
      site: "https://helpful-capybara-123.convex.site",
      vercel: productionIdentity,
    },
    {
      name: "loopback",
      query: "http://127.0.0.1:3210",
      site: "http://127.0.0.1:3211",
      vercel: productionIdentity,
    },
  ])("rejects protected production with $name", ({ query, site, vercel }) =>
    expectFailure(
      { ...productionTarget, query, site, vercel },
      "untrusted-production"
    )
  );

  it.effect("rejects anonymous cloud targets", () =>
    expectFailure(
      {
        ...productionTarget,
        agent: "anonymous",
        query: "https://helpful-capybara-123.convex.cloud",
        site: "https://helpful-capybara-123.convex.site",
      },
      "anonymous-production"
    )
  );

  it.effect.each([
    {
      name: "a production query and development HTTP target",
      query: productionTarget.query,
      site: "https://helpful-capybara-123.convex.site",
    },
    {
      name: "a development query and production HTTP target",
      query: "https://helpful-capybara-123.convex.cloud",
      site: productionTarget.site,
    },
    {
      name: "different development deployments",
      query: "https://helpful-capybara-123.convex.cloud",
      site: "https://different-capybara-456.convex.site",
    },
  ])("rejects mixed targets with $name", ({ query, site }) =>
    expectFailure({ ...productionTarget, query, site }, "mixed-production")
  );

  it.effect.each([
    { name: "an unparsable query URL", query: "not a URL", site: undefined },
    {
      name: "an unparsable HTTP URL",
      query: productionTarget.query,
      site: "not a URL",
    },
    {
      name: "credentials",
      query: "https://user:password@example.convex.cloud",
      site: undefined,
    },
    { name: "a file URL", query: "file:///tmp/convex", site: undefined },
    {
      name: "an insecure remote URL",
      query: "http://helpful-capybara-123.convex.cloud",
      site: undefined,
    },
  ])("rejects $name", ({ query, site }) =>
    expectFailure({ ...productionTarget, query, site }, "invalid-target")
  );
});
