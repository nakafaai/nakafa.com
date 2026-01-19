import type { getWeather } from "@repo/ai/clients/weather/client";
import { useQuery } from "@tanstack/react-query";
import ky from "ky";

type Weather = Awaited<ReturnType<typeof getWeather>>;

async function fetchWeather() {
  return await ky.post<Weather>("/api/weather").json();
}

export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: fetchWeather,
  });
}
