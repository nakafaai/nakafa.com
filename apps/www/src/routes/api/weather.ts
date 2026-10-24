import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";
import { serveWeather } from "@/lib/weather/route.server";

/** The current weather of the visitor's location. */
export const Route = createFileRoute("/api/weather")({
  server: {
    handlers: {
      ANY: methodNotAllowed("POST"),
      POST: ({ request }) => runServerEffect(serveWeather({ request })),
    },
  },
});
