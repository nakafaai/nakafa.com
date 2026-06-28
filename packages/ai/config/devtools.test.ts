import { afterEach, describe, expect, it, vi } from "vitest";

const originalAiSdkDevTools = process.env.AI_SDK_DEVTOOLS;
const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;

const languageModel = vi.hoisted(() => ({
  modelId: "google/gemini-3-flash",
  provider: "gateway",
}));

const gateway = vi.hoisted(() => vi.fn(() => languageModel));
const telemetryIntegration = vi.hoisted(() => ({
  name: "ai-sdk-devtools",
}));
const DevToolsTelemetry = vi.hoisted(() => vi.fn(() => telemetryIntegration));
const registerTelemetry = vi.hoisted(() => vi.fn());

vi.mock("@repo/ai/config/provider", () => ({
  gateway,
}));

vi.mock("@ai-sdk/devtools", () => ({
  DevToolsTelemetry,
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    registerTelemetry,
  };
});

async function importDevToolsConfig() {
  vi.resetModules();

  return await import("@repo/ai/config/devtools");
}

function resetDevToolsEnvironment() {
  gateway.mockClear();
  DevToolsTelemetry.mockClear();
  registerTelemetry.mockClear();
  globalThis.NAKAFA_AI_SDK_DEVTOOLS_REGISTERED = undefined;
  process.env.NODE_ENV = "development";
  delete process.env.AI_SDK_DEVTOOLS;
  delete process.env.VERCEL_ENV;
}

function restoreOriginalEnvironment() {
  globalThis.NAKAFA_AI_SDK_DEVTOOLS_REGISTERED = undefined;

  if (originalAiSdkDevTools === undefined) {
    delete process.env.AI_SDK_DEVTOOLS;
  } else {
    process.env.AI_SDK_DEVTOOLS = originalAiSdkDevTools;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnv;
  }
}

describe("AI SDK DevTools configuration", () => {
  afterEach(() => {
    restoreOriginalEnvironment();
  });

  it("registers v7 telemetry once and returns the plain Gateway model", async () => {
    resetDevToolsEnvironment();
    process.env.AI_SDK_DEVTOOLS = "true";
    process.env.NODE_ENV = "development";

    const { createAppLanguageModel, registerAiSdkDevToolsTelemetry } =
      await importDevToolsConfig();

    registerAiSdkDevToolsTelemetry();
    const model = createAppLanguageModel("google/gemini-3-flash");

    expect(model).toBe(languageModel);
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(gateway).toHaveBeenCalledWith("google/gemini-3-flash");
    expect(DevToolsTelemetry).toHaveBeenCalledTimes(1);
    expect(registerTelemetry).toHaveBeenCalledTimes(1);
    expect(registerTelemetry).toHaveBeenCalledWith(telemetryIntegration);
  });

  it("leaves DevTools disabled when the flag is off", async () => {
    resetDevToolsEnvironment();

    const { createAppLanguageModel } = await importDevToolsConfig();

    expect(createAppLanguageModel("google/gemini-3-flash")).toBe(languageModel);
    expect(DevToolsTelemetry).not.toHaveBeenCalled();
    expect(registerTelemetry).not.toHaveBeenCalled();
  });

  it("never registers DevTools in production", async () => {
    resetDevToolsEnvironment();
    process.env.AI_SDK_DEVTOOLS = "true";
    process.env.NODE_ENV = "production";

    const { registerAiSdkDevToolsTelemetry } = await importDevToolsConfig();

    registerAiSdkDevToolsTelemetry();

    expect(DevToolsTelemetry).not.toHaveBeenCalled();
    expect(registerTelemetry).not.toHaveBeenCalled();
  });

  it("allows explicit development deployments", async () => {
    resetDevToolsEnvironment();
    process.env.AI_SDK_DEVTOOLS = "true";
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "development";

    const { registerAiSdkDevToolsTelemetry } = await importDevToolsConfig();

    registerAiSdkDevToolsTelemetry();

    expect(DevToolsTelemetry).toHaveBeenCalledTimes(1);
    expect(registerTelemetry).toHaveBeenCalledTimes(1);
  });

  it("keeps Vercel preview and production deployments clean", async () => {
    resetDevToolsEnvironment();
    process.env.AI_SDK_DEVTOOLS = "true";
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "preview";

    const { registerAiSdkDevToolsTelemetry } = await importDevToolsConfig();

    registerAiSdkDevToolsTelemetry();

    expect(DevToolsTelemetry).not.toHaveBeenCalled();
    expect(registerTelemetry).not.toHaveBeenCalled();
  });
});
