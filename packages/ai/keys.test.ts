import {
  devtoolsKeys,
  elevenLabsKeys,
  firecrawlKeys,
  gatewayKeys,
  weatherKeys,
} from "@repo/ai/keys";
import { afterEach, describe, expect, it } from "vitest";

const originalAiGatewayApiKey = process.env.AI_GATEWAY_API_KEY;
const originalAiSdkDevTools = process.env.AI_SDK_DEVTOOLS;
const originalElevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const originalFirecrawlApiKey = process.env.FIRECRAWL_API_KEY;
const originalNodeEnv = process.env.NODE_ENV;
const originalOpenWeatherApiKey = process.env.OPENWEATHER_API_KEY;
const originalVercelEnv = process.env.VERCEL_ENV;

function restoreEnvironmentValue(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function restoreOriginalEnvironment() {
  restoreEnvironmentValue("AI_GATEWAY_API_KEY", originalAiGatewayApiKey);
  restoreEnvironmentValue("AI_SDK_DEVTOOLS", originalAiSdkDevTools);
  restoreEnvironmentValue("ELEVENLABS_API_KEY", originalElevenLabsApiKey);
  restoreEnvironmentValue("FIRECRAWL_API_KEY", originalFirecrawlApiKey);
  restoreEnvironmentValue("NODE_ENV", originalNodeEnv);
  restoreEnvironmentValue("OPENWEATHER_API_KEY", originalOpenWeatherApiKey);
  restoreEnvironmentValue("VERCEL_ENV", originalVercelEnv);
}

describe("AI environment contracts", () => {
  afterEach(() => {
    restoreOriginalEnvironment();
  });

  it("reads required provider secrets", () => {
    process.env.AI_GATEWAY_API_KEY = "gateway-key";
    process.env.ELEVENLABS_API_KEY = "elevenlabs-key";
    process.env.FIRECRAWL_API_KEY = "firecrawl-key";
    process.env.OPENWEATHER_API_KEY = "openweather-key";

    expect(gatewayKeys().AI_GATEWAY_API_KEY).toBe("gateway-key");
    expect(elevenLabsKeys().ELEVENLABS_API_KEY).toBe("elevenlabs-key");
    expect(firecrawlKeys().FIRECRAWL_API_KEY).toBe("firecrawl-key");
    expect(weatherKeys().OPENWEATHER_API_KEY).toBe("openweather-key");
  });

  it("reads optional DevTools controls", () => {
    process.env.AI_SDK_DEVTOOLS = "true";
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "development";

    expect(devtoolsKeys()).toEqual({
      AI_SDK_DEVTOOLS: "true",
      NODE_ENV: "development",
      VERCEL_ENV: "development",
    });
  });
});
