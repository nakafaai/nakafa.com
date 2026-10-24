import { getCountryName } from "@repo/design-system/lib/locale/country";
import { timeOperation } from "@repo/utilities/logging/effect";
import { Array as Arr, Config, Effect, Option, Redacted, Schema } from "effect";
import {
  type CurrentWeatherSummary,
  OpenWeatherCurrentResponseSchema,
} from "@/lib/weather/schema";
import { requestWeatherJson } from "@/lib/weather/transport";

export class WeatherConfigurationError extends Schema.TaggedError<WeatherConfigurationError>()(
  "WeatherConfigurationError",
  { message: Schema.String }
) {}

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
        const key = yield* Config.Redacted("OPENWEATHER_API_KEY").pipe(
          Effect.mapError(
            () =>
              new WeatherConfigurationError({
                message: "Weather is not configured.",
              })
          )
        );
        const apiKey = Redacted.value(key);
        if (!apiKey.trim()) {
          return yield* new WeatherConfigurationError({
            message: "Weather is not configured.",
          });
        }
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
          Effect.flatMap(
            Schema.decodeUnknownEffect(OpenWeatherCurrentResponseSchema)
          )
        );
        yield* Effect.logInfo("Current weather fetched successfully").pipe(
          Effect.annotateLogs(context)
        );
        const condition = Option.getOrUndefined(Arr.head(response.weather));
        const countryName = getCountryName(response.sys.country);
        return {
          city: response.name,
          condition: condition?.description ?? DEFAULT_CONDITION,
          country: response.sys.country,
          ...(countryName === undefined ? {} : { countryName }),
          icon: condition?.icon ?? DEFAULT_ICON,
          temperatureKelvin: response.main.temp,
        } satisfies CurrentWeatherSummary;
      }),
      context
    );
  }
);
