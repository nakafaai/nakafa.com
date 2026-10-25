// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Effect, Record as Rec } from "effect";
import {
  assertRuntimeTarget,
  readRuntimeConfig,
  UnsafeRuntimeError,
} from "@/runtime";

type RuntimeTarget = Parameters<typeof assertRuntimeTarget>[0];

const TASK_QUERY = "https://helpful-capybara-123.convex.cloud";
const TASK_SITE = "https://helpful-capybara-123.convex.site";
const OTHER_SITE = "https://different-capybara-456.convex.site";
const LOOPBACK_QUERY = "http://127.0.0.1:3210";
const LOOPBACK_SITE = "http://127.0.0.1:3211";

const unsetIdentity = { stage: undefined } satisfies RuntimeTarget["deploy"];

const productionIdentity = {
  stage: "prod",
} as const satisfies RuntimeTarget["deploy"];

const productionTarget = {
  agent: undefined,
  query: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`,
  site: `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`,
  deploy: unsetIdentity,
} satisfies RuntimeTarget;

afterEach(() => vi.unstubAllEnvs());

function identity(stage: string | undefined) {
  return { stage } satisfies RuntimeTarget["deploy"];
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
  it("accepts an isolated environment at the configuration boundary", () => {
    vi.stubEnv("CONVEX_AGENT_MODE", "anonymous");
    vi.stubEnv("VITE_CONVEX_URL", LOOPBACK_QUERY);
    vi.stubEnv("VITE_CONVEX_SITE_URL", LOOPBACK_SITE);

    expect(readRuntimeConfig).not.toThrow();
  });

  it("blocks a non-production stage from production content while reading the runtime configuration", () => {
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", "staging");
    vi.stubEnv("VITE_CONVEX_SITE_URL", productionTarget.site);
    vi.stubEnv("VITE_CONVEX_URL", productionTarget.query);

    expect(readRuntimeConfig).toThrow(
      "Production content is restricted to the protected production stage"
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
    expectSuccess(target({ site, deploy: productionIdentity }))
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
      target({ agent: "anonymous", deploy: productionIdentity }),
      "anonymous-production"
    )
  );

  it.effect.each([
    ["an unset stage", identity(undefined)] as const,
    ["an empty stage", identity("")] as const,
    ["a staging stage", identity("staging")] as const,
    ["a preview stage", identity("preview")] as const,
  ])("rejects production when the deploy has %s", ([, deploy]) =>
    expectFailure(target({ deploy }), "untrusted-production")
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
      target({ query, site, deploy: productionIdentity }),
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

const PROTECTED_ENVIRONMENT = {
  NAKAFA_DEPLOY_STAGE: "prod",
  VITE_CONVEX_SITE_URL: productionTarget.site,
  VITE_CONVEX_URL: productionTarget.query,
};
/** Every name the runtime reader reads. */
const RUNTIME_ENVIRONMENT_NAMES = [
  "CONVEX_AGENT_MODE",
  ...Rec.keys(PROTECTED_ENVIRONMENT),
] as const;
/** The deploy stage is the only identity that the protected production check compares. */
const PROTECTED_IDENTITY_NAMES = ["NAKAFA_DEPLOY_STAGE"] as const;

/** Sets the whole runtime environment, so an unnamed key never inherits a shell value. */
function stubRuntimeEnvironment(
  values: Partial<
    Record<(typeof RUNTIME_ENVIRONMENT_NAMES)[number], string | undefined>
  >
) {
  for (const name of RUNTIME_ENVIRONMENT_NAMES) {
    vi.stubEnv(name, values[name]);
  }
}

describe("runtime environment parity", () => {
  it("returns a loopback target from the Convex URL alone", () => {
    stubRuntimeEnvironment({ VITE_CONVEX_URL: LOOPBACK_QUERY });

    expect(readRuntimeConfig()).toStrictEqual({
      agent: undefined,
      query: LOOPBACK_QUERY,
      site: undefined,
      stage: undefined,
    });
  });

  it("throws when the Convex URL is unset", () => {
    stubRuntimeEnvironment({});

    expect(readRuntimeConfig).toThrow();
  });

  it("rejects an empty or unparsable Convex URL as an invalid target", () => {
    stubRuntimeEnvironment({ VITE_CONVEX_URL: "" });
    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "invalid-target" })
    );

    stubRuntimeEnvironment({ VITE_CONVEX_URL: "not a url" });
    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "invalid-target" })
    );
  });

  it("keeps the site URL optional but rejects an empty or unparsable one", () => {
    stubRuntimeEnvironment({
      VITE_CONVEX_SITE_URL: LOOPBACK_SITE,
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig().site).toBe(LOOPBACK_SITE);

    stubRuntimeEnvironment({
      VITE_CONVEX_SITE_URL: "",
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "invalid-target" })
    );

    stubRuntimeEnvironment({
      VITE_CONVEX_SITE_URL: "not a url",
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "invalid-target" })
    );
  });

  it("reads the agent mode literal and rejects an empty or other value", () => {
    stubRuntimeEnvironment({
      CONVEX_AGENT_MODE: "anonymous",
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig().agent).toBe("anonymous");

    stubRuntimeEnvironment({
      CONVEX_AGENT_MODE: "",
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig).toThrow();

    stubRuntimeEnvironment({
      CONVEX_AGENT_MODE: "agent",
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig).toThrow();
  });

  it("reads the deploy stage as text and keeps an unset stage undefined", () => {
    stubRuntimeEnvironment({
      NAKAFA_DEPLOY_STAGE: "staging",
      VITE_CONVEX_URL: LOOPBACK_QUERY,
    });
    expect(readRuntimeConfig().stage).toBe("staging");

    stubRuntimeEnvironment({ VITE_CONVEX_URL: LOOPBACK_QUERY });
    expect(readRuntimeConfig().stage).toBeUndefined();
  });

  it("accepts the complete protected production environment", () => {
    stubRuntimeEnvironment(PROTECTED_ENVIRONMENT);

    expect(readRuntimeConfig()).toStrictEqual({
      agent: undefined,
      query: productionTarget.query,
      site: productionTarget.site,
      stage: "prod",
    });
  });

  it.each(PROTECTED_IDENTITY_NAMES)(
    "rejects production when %s is unset",
    (name) => {
      stubRuntimeEnvironment(PROTECTED_ENVIRONMENT);
      vi.stubEnv(name, undefined);

      expect(readRuntimeConfig).toThrow(
        new UnsafeRuntimeError({ reason: "untrusted-production" })
      );
    }
  );

  it.each(PROTECTED_IDENTITY_NAMES)(
    "rejects production when %s is empty",
    (name) => {
      stubRuntimeEnvironment(PROTECTED_ENVIRONMENT);
      vi.stubEnv(name, "");

      expect(readRuntimeConfig).toThrow(
        new UnsafeRuntimeError({ reason: "untrusted-production" })
      );
    }
  );

  it("rejects anonymous agent mode against the protected production environment", () => {
    stubRuntimeEnvironment({
      ...PROTECTED_ENVIRONMENT,
      CONVEX_AGENT_MODE: "anonymous",
    });

    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "anonymous-production" })
    );
  });
});

describe("content runtime host names", () => {
  it.effect("accepts a trailing dot on a deployment host", () =>
    expectSuccess(
      target({
        query: `${TASK_QUERY}.`,
        site: undefined,
        deploy: unsetIdentity,
      })
    )
  );

  it.effect("refuses a site address that is not a Convex site", () =>
    expectFailure(
      target({ query: TASK_QUERY, site: "https://example.com" }),
      "untrusted-production"
    )
  );
});
