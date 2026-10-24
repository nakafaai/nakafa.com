// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { runServerEffect } from "@/lib/server/fn";
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from "@/lib/weather/client";
import { serveWeather as serveWeatherEffect } from "@/lib/weather/route.server";

const getCurrentWeatherMock = vi.hoisted(() => vi.fn());
const isCorsRequestAllowedMock = vi.hoisted(() => vi.fn());
const scheduleCaptureMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/weather/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/weather/client")>()),
  /** Records the coordinates and answers the weather summary. */
  getCurrentWeather: getCurrentWeatherMock,
}));

vi.mock("@/lib/security/cors", () => ({
  /** Controls whether the browser origin may read the weather. */
  isCorsRequestAllowed: isCorsRequestAllowedMock,
  /** Answers a refused origin the way the route does. */
  createCorsForbiddenResponse: () =>
    new Response("Access denied.", { status: 403 }),
}));

vi.mock("@/lib/analytics/exception.server", () => ({
  /** Records every handled failure that the route reports. */
  scheduleServerExceptionCapture: scheduleCaptureMock,
}));

const summary = { temperature: 30, description: "clear" };

/** The provider failure that the weather read reports. */
class WeatherProviderDown extends Schema.TaggedError<WeatherProviderDown>()(
  "WeatherProviderDown",
  {}
) {}

/** Posts one weather request to the route, from a visitor at the Cloudflare location given. */
function weather(cf?: Record<string, unknown>) {
  const request = new Request("https://nakafa.com/api/weather", {
    method: "POST",
  });
  return runServerEffect(
    serveWeatherEffect({
      request: cf === undefined ? request : Object.assign(request, { cf }),
    })
  );
}

describe("weather route", () => {
  it("answers the weather of the visitor's location", async () => {
    isCorsRequestAllowedMock.mockReturnValue(Effect.succeed(true));
    getCurrentWeatherMock.mockReturnValue(Effect.succeed(summary));

    const response = await weather({ latitude: "1.5", longitude: "2.5" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
    expect(getCurrentWeatherMock).toHaveBeenCalledWith({
      latitude: "1.5",
      longitude: "2.5",
    });
  });

  it("uses the default location when the platform has no location for the request", async () => {
    isCorsRequestAllowedMock.mockReturnValue(Effect.succeed(true));
    getCurrentWeatherMock.mockReturnValue(Effect.succeed(summary));

    const response = await weather();

    expect(response.status).toBe(200);
    expect(getCurrentWeatherMock).toHaveBeenCalledWith({
      latitude: DEFAULT_LATITUDE,
      longitude: DEFAULT_LONGITUDE,
    });
  });

  it("uses the default location when the platform's location is malformed", async () => {
    isCorsRequestAllowedMock.mockReturnValue(Effect.succeed(true));
    getCurrentWeatherMock.mockReturnValue(Effect.succeed(summary));

    const response = await weather({ latitude: 1 });

    expect(response.status).toBe(200);
    expect(getCurrentWeatherMock).toHaveBeenCalledWith({
      latitude: DEFAULT_LATITUDE,
      longitude: DEFAULT_LONGITUDE,
    });
  });

  it("refuses a request from an origin that is not allowed", async () => {
    isCorsRequestAllowedMock.mockReturnValue(Effect.succeed(false));

    const response = await weather();

    expect(response.status).toBe(403);
    expect(getCurrentWeatherMock).not.toHaveBeenCalled();
  });

  it("reports a failed weather read and answers 500 without details", async () => {
    isCorsRequestAllowedMock.mockReturnValue(Effect.succeed(true));
    getCurrentWeatherMock.mockReturnValue(
      Effect.fail(new WeatherProviderDown({}))
    );
    scheduleCaptureMock.mockReturnValue(Effect.void);

    const response = await weather({ latitude: "1", longitude: "2" });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch weather data",
    });
    expect(scheduleCaptureMock).toHaveBeenCalledWith(expect.any(Error), {
      source: "weather-api",
    });
  });

  it("reports a non-error failure with its original value", async () => {
    isCorsRequestAllowedMock.mockReturnValue(Effect.succeed(true));
    getCurrentWeatherMock.mockReturnValue(Effect.fail("timeout"));
    scheduleCaptureMock.mockReturnValue(Effect.void);

    const response = await weather({ latitude: "1", longitude: "2" });

    expect(response.status).toBe(500);
    expect(scheduleCaptureMock).toHaveBeenCalledWith("timeout", {
      source: "weather-api",
    });
  });
});
