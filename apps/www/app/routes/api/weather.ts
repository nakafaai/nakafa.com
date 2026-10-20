import { createFileRoute } from "@tanstack/react-router";
import { serveWeather } from "@/lib/weather/route.server";

/** The current weather of the visitor's location. */
export const Route = createFileRoute("/api/weather")({
  server: { handlers: { POST: serveWeather } },
});
