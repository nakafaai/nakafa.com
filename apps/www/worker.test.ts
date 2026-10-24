// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Record, Redacted } from "effect";
import { deployedWorkerBindings, workerEnvironment } from "#www/worker";

/** Installs the server values that every reader requires, so each assertion starts complete. */
function stubRequiredEnvironment() {
  vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "publication-token");
  vi.stubEnv("CONTENT_RUNTIME_TOKEN", "runtime-token");
  vi.stubEnv("POSTHOG_PROXY_HOST", undefined);
  vi.stubEnv("VITE_POSTHOG_PROXY_HOST", "https://t.nakafa.com");
  vi.stubEnv("SITE_URL", "https://nakafa.com");
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("OPENWEATHER_API_KEY", undefined);
}

beforeEach(() => {
  stubRequiredEnvironment();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Reads the text of a secret binding, or the text of a plain one. */
function revealed(binding: unknown) {
  return Redacted.isRedacted(binding) ? Redacted.value(binding) : binding;
}

describe("workerEnvironment", () => {
  it("binds the Convex site that the server calls, with every other required value", () => {
    const environment = workerEnvironment();

    expect(environment.VITE_CONVEX_SITE_URL).toBe(
      "https://example.convex.site"
    );
    expect(environment.SITE_URL).toBe("https://nakafa.com");
    expect(environment.VITE_POSTHOG_PROXY_HOST).toBe("https://t.nakafa.com");
    expect(environment.AKSARA_PUBLICATION_TOKEN).toBe("publication-token");
    expect(environment.CONTENT_RUNTIME_TOKEN).toBe("runtime-token");
  });

  it("reads the weather key only when it is set", () => {
    expect(workerEnvironment().OPENWEATHER_API_KEY).toBeUndefined();

    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    expect(workerEnvironment().OPENWEATHER_API_KEY).toBe("weather-key");
  });

  it("fails before any binding when a required value is missing", () => {
    vi.stubEnv("SITE_URL", undefined);

    expect(() => workerEnvironment()).toThrow("SITE_URL");
  });
});

describe("deployedWorkerBindings", () => {
  it("binds a public VITE_ value as text and every server value as a secret", () => {
    const bindings = deployedWorkerBindings();

    expect(bindings.VITE_CONVEX_SITE_URL).toBe("https://example.convex.site");
    expect(bindings.VITE_POSTHOG_PROXY_HOST).toBe("https://t.nakafa.com");
    expect(Redacted.isRedacted(bindings.AKSARA_PUBLICATION_TOKEN)).toBe(true);
    expect(revealed(bindings.CONTENT_RUNTIME_TOKEN)).toBe("runtime-token");
  });

  it("deploys in production and drops every unset value", () => {
    const bindings = deployedWorkerBindings();

    expect(revealed(bindings.NODE_ENV)).toBe("production");
    expect(bindings).not.toHaveProperty("OPENWEATHER_API_KEY");
    expect(Record.values(bindings)).not.toContain(undefined);
  });
});
