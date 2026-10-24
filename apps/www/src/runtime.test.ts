// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { Effect } from "effect";
import {
  assertRuntimeTarget,
  readRuntimeConfig,
  UnsafeRuntimeError,
} from "@/runtime";

const PRODUCTION_QUERY = `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`;
const PRODUCTION_SITE = `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`;
const DEVELOPMENT_QUERY = "https://helpful-capybara-123.convex.cloud";
const DEVELOPMENT_SITE = "https://helpful-capybara-123.convex.site";
const LOOPBACK_QUERY = "http://127.0.0.1:3210";
const LOOPBACK_SITE = "http://127.0.0.1:3211";

type RuntimeTarget = Parameters<typeof assertRuntimeTarget>[0];

/** A target that names one deploy stage and its Convex addresses. */
function targetOf(value: Partial<RuntimeTarget>): RuntimeTarget {
  return {
    agent: undefined,
    deploy: { stage: undefined },
    query: DEVELOPMENT_QUERY,
    site: DEVELOPMENT_SITE,
    ...value,
  };
}

/** The reason that a target is refused, or nothing when it is allowed. */
const refusalOf = (value: RuntimeTarget) =>
  assertRuntimeTarget(value).pipe(
    Effect.as(undefined),
    Effect.catchTag("UnsafeRuntimeError", (error) =>
      Effect.succeed(error.reason)
    )
  );

/** Sets the environment that the app configuration reads, and nothing else. */
function stubRuntimeEnvironment(values: Record<string, string>) {
  for (const name of [
    "CONVEX_AGENT_MODE",
    "DEPLOY_STAGE",
    "VITE_CONVEX_SITE_URL",
    "VITE_CONVEX_URL",
  ]) {
    vi.stubEnv(name, values[name]);
  }
}

describe("content runtime target", () => {
  it.effect("allows a development build against a development deployment", () =>
    Effect.gen(function* () {
      expect(yield* refusalOf(targetOf({}))).toBeUndefined();
    })
  );

  it.effect("allows loopback addresses outside the production stage", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({ query: LOOPBACK_QUERY, site: LOOPBACK_SITE })
        )
      ).toBeUndefined();
    })
  );

  it.effect(
    "allows the production stage against the production deployment",
    () =>
      Effect.gen(function* () {
        expect(
          yield* refusalOf(
            targetOf({
              deploy: { stage: "production" },
              query: PRODUCTION_QUERY,
              site: PRODUCTION_SITE,
            })
          )
        ).toBeUndefined();
      })
  );

  it.effect("refuses the production stage against another deployment", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(targetOf({ deploy: { stage: "production" } }))
      ).toBe("untrusted-production");
    })
  );

  it.effect(
    "refuses the production stage with a site of another deployment",
    () =>
      Effect.gen(function* () {
        expect(
          yield* refusalOf(
            targetOf({
              deploy: { stage: "production" },
              query: PRODUCTION_QUERY,
              site: DEVELOPMENT_SITE,
            })
          )
        ).toBe("untrusted-production");
      })
  );

  it.effect(
    "refuses anonymous Agent Mode against the production deployment",
    () =>
      Effect.gen(function* () {
        expect(
          yield* refusalOf(
            targetOf({
              agent: "anonymous",
              query: PRODUCTION_QUERY,
              site: PRODUCTION_SITE,
            })
          )
        ).toBe("anonymous-production");
      })
  );

  it.effect(
    "refuses a URL with credentials, and a plain HTTP host that is not loopback",
    () =>
      Effect.gen(function* () {
        expect(
          yield* refusalOf(
            targetOf({
              query: "https://user:secret@helpful-capybara-123.convex.cloud",
            })
          )
        ).toBe("invalid-target");
        expect(
          yield* refusalOf(targetOf({ query: "http://example.com" }))
        ).toBe("invalid-target");
      })
  );
});

describe("content runtime refusals", () => {
  it.effect("refuses a production stage with anonymous Agent Mode", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({
            agent: "anonymous",
            deploy: { stage: "production" },
            query: PRODUCTION_QUERY,
            site: PRODUCTION_SITE,
          })
        )
      ).toBe("anonymous-production");
    })
  );

  it.effect("allows anonymous Agent Mode against a loopback deployment", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({
            agent: "anonymous",
            query: LOOPBACK_QUERY,
            site: LOOPBACK_SITE,
          })
        )
      ).toBeUndefined();
    })
  );

  it.effect("refuses a deployment that mixes production and development", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({ query: PRODUCTION_QUERY, site: DEVELOPMENT_SITE })
        )
      ).toBe("mixed-production");
    })
  );

  it.effect("refuses a host that is neither loopback nor a deployment", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({ query: "https://example.com", site: undefined })
        )
      ).toBe("untrusted-production");
    })
  );
});

describe("content runtime host names", () => {
  it.effect("accepts a trailing dot on a deployment host", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({
            query: "https://helpful-capybara-123.convex.cloud.",
            site: undefined,
          })
        )
      ).toBeUndefined();
    })
  );

  it.effect("refuses a Convex host whose deployment name is dotted", () =>
    Effect.gen(function* () {
      expect(
        yield* refusalOf(
          targetOf({ query: "https://a.b.convex.cloud", site: undefined })
        )
      ).toBe("untrusted-production");
    })
  );

  it.effect("refuses a site address that is not a Convex site", () =>
    Effect.gen(function* () {
      expect(yield* refusalOf(targetOf({ site: "https://example.com" }))).toBe(
        "untrusted-production"
      );
    })
  );
});

describe("runtime environment", () => {
  it("returns the loopback target from the Convex URL alone", () => {
    stubRuntimeEnvironment({ VITE_CONVEX_URL: LOOPBACK_QUERY });

    expect(readRuntimeConfig()).toStrictEqual({
      agent: undefined,
      query: LOOPBACK_QUERY,
      site: undefined,
      stage: undefined,
    });
  });

  it("returns the deploy stage of the build", () => {
    stubRuntimeEnvironment({
      DEPLOY_STAGE: "production",
      VITE_CONVEX_SITE_URL: PRODUCTION_SITE,
      VITE_CONVEX_URL: PRODUCTION_QUERY,
    });

    expect(readRuntimeConfig().stage).toBe("production");
  });

  it("blocks the production stage with a development Convex URL", () => {
    stubRuntimeEnvironment({
      DEPLOY_STAGE: "production",
      VITE_CONVEX_SITE_URL: DEVELOPMENT_SITE,
      VITE_CONVEX_URL: DEVELOPMENT_QUERY,
    });

    expect(readRuntimeConfig).toThrow(
      "Production content is restricted to the production deploy stage"
    );
  });

  it("throws when the Convex URL is unset", () => {
    stubRuntimeEnvironment({});

    expect(readRuntimeConfig).toThrow();
  });

  it("refuses an empty Convex URL as an invalid target", () => {
    stubRuntimeEnvironment({ VITE_CONVEX_URL: "" });

    expect(readRuntimeConfig).toThrow(
      new UnsafeRuntimeError({ reason: "invalid-target" })
    );
  });
});
