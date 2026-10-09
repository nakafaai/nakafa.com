import { FetchClient } from "@repo/utilities/http/client";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { CurrentWeatherSummarySchema } from "@/lib/weather/schema";

/**
 * The longest the browser waits for the app's weather route. It is the
 * browser's own budget, not the server's budget for the weather service, so it
 * lives here and keeps the server transport out of the browser's code.
 */
const WEATHER_ROUTE_TIMEOUT = "10 seconds";

/** Load the current weather summary through the app API route. */
const fetchWeather = Effect.fn("www.weather.fetch")(function* () {
  return yield* HttpClient.post("/api/weather").pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(
      HttpClientResponse.schemaBodyJson(CurrentWeatherSummarySchema)
    ),
    Effect.timeout(WEATHER_ROUTE_TIMEOUT)
  );
});

/** Return a cached React Query handle for the current weather summary. */
export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: () =>
      Effect.runPromise(fetchWeather().pipe(Effect.provide(FetchClient))),
  });
}
