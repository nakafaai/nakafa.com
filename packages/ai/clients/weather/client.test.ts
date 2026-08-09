import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { getCurrentWeather } from "@repo/ai/clients/weather/client";
import { Effect, Either, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const latitude = "-6.2088";
const longitude = "106.8456";

const currentWeatherResponse = {
  base: "stations",
  cod: 200,
  coord: {
    lat: -6.2088,
    lon: 106.8456,
  },
  main: {
    feels_like: 305.2,
    humidity: 78,
    pressure: 1010,
    temp: 300.4,
    temp_max: 301,
    temp_min: 300,
  },
  name: "Jakarta",
  sys: {
    country: "ID",
    sunrise: 1_779_309_600,
    sunset: 1_779_352_800,
  },
  weather: [
    {
      description: "light rain",
      icon: "10d",
      id: 500,
      main: "Rain",
    },
  ],
};

interface WeatherClientInput {
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response;
  observeRequest?: (request: HttpClientRequest.HttpClientRequest) => void;
}

/** Builds an Effect HTTP client with a deterministic OpenWeather response. */
function makeWeatherClient({
  makeResponse,
  observeRequest = () => undefined,
}: WeatherClientInput) {
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        observeRequest(request);
        return HttpClientResponse.fromWeb(request, makeResponse(request));
      })
    )
  );
}

/** Runs the public weather program with a deterministic HTTP layer. */
function runWeather(
  makeResponse: WeatherClientInput["makeResponse"],
  observeRequest?: WeatherClientInput["observeRequest"]
) {
  return Effect.runPromise(
    getCurrentWeather({ latitude, longitude }).pipe(
      Effect.provide(makeWeatherClient({ makeResponse, observeRequest })),
      Effect.either
    )
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCurrentWeather", () => {
  it("returns a narrow summary from one current-weather request", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
    const observeRequest =
      vi.fn<(request: HttpClientRequest.HttpClientRequest) => void>();

    const result = await runWeather(
      () => Response.json(currentWeatherResponse),
      observeRequest
    );

    expect(result).toEqual(
      Either.right({
        city: "Jakarta",
        condition: "light rain",
        country: "ID",
        icon: "10d",
        temperatureKelvin: 300.4,
      })
    );
    expect(observeRequest).toHaveBeenCalledTimes(1);
    expect(observeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "https://api.openweathermap.org/data/2.5/weather",
        urlParams: [
          ["appid", "weather-key"],
          ["lat", latitude],
          ["lon", longitude],
        ],
      })
    );
  });

  it("keeps an unavailable current-weather request in the typed error channel", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather(
      () => new Response("unauthorized", { status: 401 })
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }
    expect(result.left).toMatchObject({
      _tag: "WeatherClientRequestError",
      endpoint: "current-weather",
    });
  });

  it("keeps an invalid response in the schema error channel", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather(() => Response.json({ cod: 200 }));

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }
    expect(result.left).toMatchObject({ _tag: "ParseError" });
  });

  it("preserves the visible condition defaults when conditions are absent", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");

    const result = await runWeather(() =>
      Response.json({
        ...currentWeatherResponse,
        weather: [],
      })
    );

    expect(result).toEqual(
      Either.right(
        expect.objectContaining({
          condition: "Clear",
          icon: "01d",
        })
      )
    );
  });
});
