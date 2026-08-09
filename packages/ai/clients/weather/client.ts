import {
  type CurrentWeatherSummary,
  OpenWeatherCurrentResponseSchema,
} from "@repo/ai/clients/weather/schema";
import { requestWeatherJson } from "@repo/ai/clients/weather/transport";
import { weatherKeys } from "@repo/ai/keys";
import { timeOperation } from "@repo/utilities/logging/effect";
import { Effect, Schema } from "effect";

const WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";
const DEFAULT_CONDITION = "Clear";
const DEFAULT_ICON = "01d";

export const DEFAULT_LATITUDE = "-6.2088";
export const DEFAULT_LONGITUDE = "106.8456";

/** Fetches the current weather summary for given coordinates. */
export const getCurrentWeather = Effect.fn("weather.getCurrentWeather")(
  function* ({ latitude, longitude }: { latitude: string; longitude: string }) {
    const context = {
      service: "weather",
      latitude,
      longitude,
    };

    return yield* timeOperation(
      "fetch_current_weather",
      Effect.gen(function* () {
        const apiKey = weatherKeys().OPENWEATHER_API_KEY;

        yield* Effect.logInfo("Fetching current weather").pipe(
          Effect.annotateLogs(context)
        );

        const response = yield* requestWeatherJson({
          endpoint: "current-weather",
          searchParams: {
            appid: apiKey,
            lat: latitude,
            lon: longitude,
          },
          url: `${WEATHER_BASE_URL}/weather`,
        }).pipe(
          Effect.flatMap(Schema.decodeUnknown(OpenWeatherCurrentResponseSchema))
        );

        yield* Effect.logInfo("Current weather fetched successfully").pipe(
          Effect.annotateLogs(context)
        );

        const condition = response.weather.at(0);

        return {
          city: response.name,
          condition: condition?.description ?? DEFAULT_CONDITION,
          country: response.sys.country,
          icon: condition?.icon ?? DEFAULT_ICON,
          temperatureKelvin: response.main.temp,
        } satisfies CurrentWeatherSummary;
      }),
      context
    );
  }
);
