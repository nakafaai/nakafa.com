import { HttpClient, HttpClientResponse } from "@effect/platform";
import { getWeather } from "@repo/ai/clients/weather/client";
import { Effect, Either, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const latitude = "-6.2088";
const longitude = "106.8456";
const coordinates = { lat: -6.2088, lon: 106.8456 };

const weatherResponse = {
  city: {
    coord: coordinates,
    country: "ID",
    id: 1,
    name: "Jakarta",
    sunrise: 1,
    sunset: 2,
    timezone: 25_200,
  },
  cnt: 1,
  cod: "200",
  list: [
    {
      clouds: { all: 10 },
      dt: 1,
      dt_txt: "2026-07-27 09:00:00",
      main: {
        feels_like: 301,
        humidity: 70,
        pressure: 1009,
        temp: 302,
        temp_max: 303,
        temp_min: 301,
      },
      pop: 0.1,
      sys: { pod: "d" },
      weather: [
        {
          description: "clear sky",
          icon: "01d",
          id: 800,
          main: "Clear",
        },
      ],
      wind: { deg: 90, speed: 2 },
    },
  ],
  message: 0,
};

const airPollutionResponse = {
  coord: coordinates,
  list: [],
};

const geocodeResponse = [
  {
    country: "ID",
    lat: coordinates.lat,
    lon: coordinates.lon,
    name: "Jakarta",
  },
];

type WeatherEndpoint =
  | "air-pollution"
  | "air-pollution-forecast"
  | "geocode"
  | "weather";

type ResponseOverrides = Partial<
  Record<WeatherEndpoint, () => globalThis.Response>
>;

/** Resolves the OpenWeather endpoint represented by one client request. */
function getEndpoint(url: string): WeatherEndpoint {
  if (url.endsWith("/geo/1.0/reverse")) {
    return "geocode";
  }
  if (url.endsWith("/data/2.5/forecast")) {
    return "weather";
  }
  if (url.endsWith("/air_pollution/forecast")) {
    return "air-pollution-forecast";
  }
  return "air-pollution";
}

/** Builds an Effect HTTP client with deterministic endpoint responses. */
function makeWeatherClient(overrides: ResponseOverrides = {}) {
  const defaults = {
    "air-pollution": () => Response.json(airPollutionResponse),
    "air-pollution-forecast": () => Response.json(airPollutionResponse),
    geocode: () => Response.json(geocodeResponse),
    weather: () => Response.json(weatherResponse),
  } satisfies Record<WeatherEndpoint, () => globalThis.Response>;

  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const endpoint = getEndpoint(request.url);
        const response = overrides[endpoint]?.() ?? defaults[endpoint]();
        return HttpClientResponse.fromWeb(request, response);
      })
    )
  );
}

/** Runs the public weather program with a deterministic HTTP layer. */
function runWeather(overrides?: ResponseOverrides) {
  return Effect.runPromise(
    getWeather({ latitude, longitude }).pipe(
      Effect.provide(makeWeatherClient(overrides)),
      Effect.either
    )
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getWeather", () => {
  it("returns the complete decoded weather payload", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather();

    expect(result).toEqual(
      Either.right({
        ...weatherResponse,
        air_pollution: airPollutionResponse,
        air_pollution_forecast: airPollutionResponse,
        geocoding: {
          city: "Jakarta",
          country: "ID",
          latitude,
          longitude,
        },
      })
    );
  });

  it("keeps an unavailable required forecast in the typed error channel", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather({
      weather: () => new Response("unauthorized", { status: 401 }),
    });

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }
    expect(result.left).toMatchObject({
      _tag: "WeatherClientRequestError",
      endpoint: "weather-forecast",
    });
  });

  it("keeps an invalid required forecast in the schema error channel", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather({
      weather: () => Response.json({ cod: "200" }),
    });

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }
    expect(result.left).toMatchObject({ _tag: "ParseError" });
  });

  it("uses logged defaults when optional requests fail", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
    const unavailable = () =>
      new Response("unavailable", {
        status: 401,
      });

    const result = await runWeather({
      "air-pollution": unavailable,
      "air-pollution-forecast": unavailable,
      geocode: unavailable,
    });

    expect(result).toEqual(
      Either.right(
        expect.objectContaining({
          air_pollution: {
            coord: coordinates,
            list: [],
          },
          air_pollution_forecast: {
            coord: coordinates,
            list: [],
          },
          geocoding: {
            city: "",
            country: "",
            latitude,
            longitude,
          },
        })
      )
    );
  });

  it("uses logged defaults when optional payloads are invalid", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
    const invalid = () => Response.json({ invalid: true });

    const result = await runWeather({
      "air-pollution": invalid,
      "air-pollution-forecast": invalid,
      geocode: invalid,
    });

    expect(result).toEqual(
      Either.right(
        expect.objectContaining({
          air_pollution: {
            coord: coordinates,
            list: [],
          },
          air_pollution_forecast: {
            coord: coordinates,
            list: [],
          },
          geocoding: {
            city: "",
            country: "",
            latitude,
            longitude,
          },
        })
      )
    );
  });

  it("uses the default location when geocoding has no match", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather({
      geocode: () => Response.json([]),
    });

    expect(result).toEqual(
      Either.right(
        expect.objectContaining({
          geocoding: {
            city: "",
            country: "",
            latitude,
            longitude,
          },
        })
      )
    );
  });
});
