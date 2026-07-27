import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "@effect/platform";
import { WeatherDataSchema } from "@repo/ai/clients/weather/schema";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";

const WEATHER_REQUEST_TIMEOUT = "10 seconds";

/** Load the current weather summary through the app API route. */
const fetchWeather = Effect.fn("www.weather.fetch")(function* () {
  return yield* HttpClient.post("/api/weather").pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(WeatherDataSchema)),
    Effect.timeout(WEATHER_REQUEST_TIMEOUT)
  );
});

/** Return a cached React Query handle for the current weather summary. */
export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: () =>
      Effect.runPromise(
        fetchWeather().pipe(Effect.provide(FetchHttpClient.layer))
      ),
  });
}
