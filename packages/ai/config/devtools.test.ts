import { afterEach, describe, expect, it } from "@effect/vitest";
import { registerTelemetry } from "ai";
import { Effect } from "effect";
import { vi } from "vitest";

const originalAiSdkDevTools = process.env.AI_SDK_DEVTOOLS;
const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;

const languageModel = vi.hoisted(() => ({
  modelId: "google/gemini-3.5-flash-lite",
  provider: "gateway",
}));

const gateway = vi.hoisted(() => vi.fn(() => languageModel));
const telemetryIntegration = vi.hoisted(() => ({
  name: "ai-sdk-devtools",
}));
const DevToolsTelemetry = vi.hoisted(() => vi.fn(() => telemetryIntegration));
const registerTelemetryMock = vi.hoisted(() => vi.fn());

vi.mock("ai", { spy: true });
vi.mocked(registerTelemetry).mockImplementation(registerTelemetryMock);

vi.mock("@repo/ai/config/provider", () => ({
  gateway,
}));

vi.mock("@ai-sdk/devtools", () => ({
  DevToolsTelemetry,
}));

const importDevToolsConfig = Effect.fn("test.ai.devtools.import")(function* () {
  yield* Effect.sync(() => vi.resetModules());
  return yield* Effect.promise(() => import("@repo/ai/config/devtools"));
});

function resetDevToolsEnvironment() {
  gateway.mockClear();
  DevToolsTelemetry.mockClear();
  registerTelemetryMock.mockClear();
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

  it.effect(
    "registers v7 telemetry once and returns the plain Gateway model",
    () =>
      Effect.gen(function* () {
        resetDevToolsEnvironment();
        process.env.AI_SDK_DEVTOOLS = "true";
        process.env.NODE_ENV = "development";

        const { createAppLanguageModel, registerAiSdkDevToolsTelemetry } =
          yield* importDevToolsConfig();

        registerAiSdkDevToolsTelemetry();
        const model = createAppLanguageModel("google/gemini-3.5-flash-lite");

        expect(model).toBe(languageModel);
        expect(gateway).toHaveBeenCalledTimes(1);
        expect(gateway).toHaveBeenCalledWith("google/gemini-3.5-flash-lite");
        expect(DevToolsTelemetry).toHaveBeenCalledTimes(1);
        expect(registerTelemetryMock).toHaveBeenCalledTimes(1);
        expect(registerTelemetryMock).toHaveBeenCalledWith(
          telemetryIntegration
        );
      })
  );

  it.effect("leaves DevTools disabled when the flag is off", () =>
    Effect.gen(function* () {
      resetDevToolsEnvironment();

      const { createAppLanguageModel } = yield* importDevToolsConfig();

      expect(createAppLanguageModel("google/gemini-3.5-flash-lite")).toBe(
        languageModel
      );
      expect(DevToolsTelemetry).not.toHaveBeenCalled();
      expect(registerTelemetryMock).not.toHaveBeenCalled();
    })
  );

  it.effect("never registers DevTools in production", () =>
    Effect.gen(function* () {
      resetDevToolsEnvironment();
      process.env.AI_SDK_DEVTOOLS = "true";
      process.env.NODE_ENV = "production";

      const { registerAiSdkDevToolsTelemetry } = yield* importDevToolsConfig();

      registerAiSdkDevToolsTelemetry();

      expect(DevToolsTelemetry).not.toHaveBeenCalled();
      expect(registerTelemetryMock).not.toHaveBeenCalled();
    })
  );

  it.effect("allows explicit development deployments", () =>
    Effect.gen(function* () {
      resetDevToolsEnvironment();
      process.env.AI_SDK_DEVTOOLS = "true";
      process.env.NODE_ENV = "development";
      process.env.VERCEL_ENV = "development";

      const { registerAiSdkDevToolsTelemetry } = yield* importDevToolsConfig();

      registerAiSdkDevToolsTelemetry();

      expect(DevToolsTelemetry).toHaveBeenCalledTimes(1);
      expect(registerTelemetryMock).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("keeps Vercel preview and production deployments clean", () =>
    Effect.gen(function* () {
      resetDevToolsEnvironment();
      process.env.AI_SDK_DEVTOOLS = "true";
      process.env.NODE_ENV = "development";
      process.env.VERCEL_ENV = "preview";

      const { registerAiSdkDevToolsTelemetry } = yield* importDevToolsConfig();

      registerAiSdkDevToolsTelemetry();

      expect(DevToolsTelemetry).not.toHaveBeenCalled();
      expect(registerTelemetryMock).not.toHaveBeenCalled();
    })
  );
});
