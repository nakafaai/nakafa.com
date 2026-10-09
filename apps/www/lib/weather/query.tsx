import { FetchClient } from "@repo/utilities/http/client";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { CurrentWeatherSummarySchema } from "@/lib/weather/schema";
import { WEATHER_REQUEST_TIMEOUT } from "@/lib/weather/transport";

/** Load the current weather summary through the app API route. */
const fetchWeather = Effect.fn("www.weather.fetch")(function* () {
  return yield* HttpClient.post("/api/weather").pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(
      HttpClientResponse.schemaBodyJson(CurrentWeatherSummarySchema)
    ),
    Effect.timeout(WEATHER_REQUEST_TIMEOUT)
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
