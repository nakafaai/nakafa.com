import type { getWeather } from "@repo/ai/clients/weather/client";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import ky from "ky";

type Weather = Effect.Effect.Success<ReturnType<typeof getWeather>>;

/** Load the current weather summary through the app API route. */
const fetchWeather = Effect.fn("www.weather.fetch")(function* () {
  return yield* Effect.tryPromise({
    try: () => ky.post<Weather>("/api/weather").json(),
    catch: (error) => error,
  });
});

/** Return a cached React Query handle for the current weather summary. */
export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: () => Effect.runPromise(fetchWeather()),
  });
}
