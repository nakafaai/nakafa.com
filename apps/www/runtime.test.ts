// @vitest-environment node

import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import {
  assertRuntimeTarget,
  type RuntimeTarget,
  readRuntimeConfig,
  UnsafeRuntimeError,
} from "@/runtime";

const NEXT_CLI = fileURLToPath(
  new URL("./node_modules/next/dist/bin/next", import.meta.url)
);
const TASK_QUERY = "https://helpful-capybara-123.convex.cloud";
const TASK_SITE = "https://helpful-capybara-123.convex.site";
const OTHER_SITE = "https://different-capybara-456.convex.site";
const emptyBuild = {
  snapshot: undefined,
} satisfies RuntimeTarget["build"];
const localBuild = {
  snapshot: "/tmp/runtime/serving/snapshot.json",
} satisfies RuntimeTarget["build"];

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
  build: emptyBuild,
  query: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`,
  site: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`,
  vercel: emptyIdentity,
} satisfies RuntimeTarget;

afterEach(() => vi.unstubAllEnvs());

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

function target(value: Partial<RuntimeTarget>) {
  return { ...productionTarget, ...value } satisfies RuntimeTarget;
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

  it.effect("blocks Preview production while loading Next configuration", () =>
    Effect.gen(function* () {
      const command = yield* ChildProcess.make(
        process.execPath,
        [NEXT_CLI, "typegen"],
        {
          cwd: import.meta.dirname,
          env: {
            ...process.env,
            NEXT_PUBLIC_CONVEX_SITE_URL: productionTarget.site,
            NEXT_PUBLIC_CONVEX_URL: productionTarget.query,
            VERCEL: "1",
            VERCEL_ENV: "preview",
          },
          stdout: "ignore",
        }
      );
      const [exitCode, stderr] = yield* Effect.all(
        [command.exitCode, Stream.mkString(Stream.decodeText(command.stderr))],
        { concurrency: 2 }
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain("UnsafeRuntimeError");
      expect(stderr).toContain("untrusted-production");
    }).pipe(Effect.provide(NodeServices.layer))
  );

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
    expectSuccess(target({ agent: "anonymous", query, site }))
  );

  it.effect("accepts a non-agent loopback target", () =>
    expectSuccess(
      target({
        query: "http://127.0.0.1:3210",
        site: "http://127.0.0.1:3211",
      })
    )
  );

  it.effect.each([{ site: TASK_SITE }, { site: undefined }])(
    "accepts a task-owned Convex deployment",
    ({ site }) => expectSuccess(target({ query: TASK_QUERY, site }))
  );

  it.effect.each([
    { name: "query and HTTP", site: productionTarget.site },
    { name: "query only", site: undefined },
  ])("accepts protected production with $name", ({ site }) =>
    expectSuccess(
      target({ build: localBuild, site, vercel: productionIdentity })
    )
  );

  it.effect("rejects a production build without an isolated snapshot", () =>
    expectFailure(
      target({ vercel: productionIdentity }),
      "unisolated-production"
    )
  );

  it.effect.each([
    { snapshot: "snapshot.json", name: "a relative descriptor path" },
    {
      snapshot: "https://example.com/snapshot.json",
      name: "a remote descriptor",
    },
    {
      snapshot: "/tmp/runtime/data.json",
      name: "a data file instead of its descriptor",
    },
  ])("rejects protected production with $name", ({ snapshot }) =>
    expectFailure(
      target({ build: { snapshot }, vercel: productionIdentity }),
      "unisolated-production"
    )
  );

  it.effect.each([
    { name: "both default domains", target: productionTarget },
    {
      name: "only the query domain",
      target: target({ site: undefined }),
    },
    {
      name: "a nested Convex-like hostname",
      target: target({
        query: "https://nested.helpful-capybara-123.convex.cloud",
        site: undefined,
      }),
    },
    {
      name: "an empty Convex deployment hostname",
      target: target({
        query: "https://.convex.cloud",
        site: undefined,
      }),
    },
    {
      name: "a DNS-equivalent production hostname",
      target: target({ query: `${productionTarget.query}.` }),
    },
  ])("rejects untrusted $name", ({ target }) =>
    expectFailure(target, "untrusted-production")
  );

  it.effect("rejects anonymous production", () =>
    expectFailure(
      target({ agent: "anonymous", vercel: productionIdentity }),
      "anonymous-production"
    )
  );

  it.effect.each([
    ["marker", identity({ marker: undefined })] as const,
    ["deployment", identity({ deployment: undefined })] as const,
    [
      "deployment format",
      identity({ deployment: "not-a-deployment" }),
    ] as const,
    ["environment", identity({ environment: "preview" })] as const,
    ["target", identity({ target: "preview" })] as const,
    ["project", identity({ project: "prj_other" })] as const,
    ["Git provider", identity({}, { provider: "gitlab" })] as const,
    ["Git owner", identity({}, { owner: "other" })] as const,
    ["Git repository", identity({}, { repository: "other" })] as const,
    ["Git branch", identity({}, { branch: "feature/cost" })] as const,
    ["commit", identity({}, { commit: undefined })] as const,
    ["commit format", identity({}, { commit: "not-a-commit" })] as const,
  ])("rejects production when the %s credential is wrong", ([, vercel]) =>
    expectFailure(target({ vercel }), "untrusted-production")
  );

  it.effect.each([
    {
      name: "a task-owned default deployment",
      query: TASK_QUERY,
      site: TASK_SITE,
    },
    {
      name: "a task-owned HTTP deployment",
      query: productionTarget.query,
      site: TASK_SITE,
    },
    {
      name: "loopback",
      query: "http://127.0.0.1:3210",
      site: "http://127.0.0.1:3211",
    },
  ])("rejects protected production with $name", ({ query, site }) =>
    expectFailure(
      target({ query, site, vercel: productionIdentity }),
      "untrusted-production"
    )
  );

  it.effect("rejects anonymous cloud targets", () =>
    expectFailure(
      target({
        agent: "anonymous",
        query: TASK_QUERY,
        site: TASK_SITE,
      }),
      "anonymous-production"
    )
  );

  it.effect.each([
    {
      name: "a production query and development HTTP target",
      query: productionTarget.query,
      site: TASK_SITE,
    },
    {
      name: "a development query and production HTTP target",
      query: TASK_QUERY,
      site: productionTarget.site,
    },
    {
      name: "different development deployments",
      query: TASK_QUERY,
      site: OTHER_SITE,
    },
  ])("rejects mixed targets with $name", ({ query, site }) =>
    expectFailure(target({ query, site }), "mixed-production")
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
    expectFailure(target({ query, site }), "invalid-target")
  );
});
