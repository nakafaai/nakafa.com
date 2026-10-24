import { FetchClient } from "@repo/utilities/http/client";
import { logError, logHttpRequest } from "@repo/utilities/logging/effect";
import { geolocation } from "@vercel/functions";
import { Cause, Effect } from "effect";
import { scheduleServerExceptionCapture } from "@/lib/analytics/exception.server";
import {
  createCorsForbiddenResponse,
  isCorsRequestAllowed,
} from "@/lib/security/cors";
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  getCurrentWeather,
} from "@/lib/weather/client";

const logContext = {
  service: "weather-api",
  endpoint: "/api/weather",
};

/**
 * Answers the weather of the visitor's location, or of the default location
 * when the platform has no geolocation. A handled failure is reported and
 * answers 500 without its details.
 */
export const serveWeather = Effect.fn("www.weather.serve")(function* ({
  request,
}: {
  readonly request: Request;
}) {
  const startedAt = performance.now();

  return yield* Effect.gen(function* () {
    const isAllowedOrigin = yield* isCorsRequestAllowed(request);
    if (!isAllowedOrigin) {
      return createCorsForbiddenResponse();
    }

    const geo = geolocation(request);
    let latitude = geo.latitude;
    let longitude = geo.longitude;

    if (!(latitude && longitude)) {
      latitude = DEFAULT_LATITUDE;
      longitude = DEFAULT_LONGITUDE;

      yield* Effect.logInfo(
        "Geolocation unavailable, using default coordinates."
      ).pipe(
        Effect.annotateLogs({
          ...logContext,
          latitude,
          longitude,
        })
      );
    }

    yield* Effect.logInfo("Processing weather request").pipe(
      Effect.annotateLogs({
        ...logContext,
        latitude,
        longitude,
      })
    );

    const weather = yield* getCurrentWeather({ latitude, longitude });
    const duration = Math.round(performance.now() - startedAt);

    yield* logHttpRequest(
      {
        method: "POST",
        url: "/api/weather",
        statusCode: 200,
        duration,
      },
      logContext
    );

    return Response.json(weather);
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.gen(function* () {
        const error = Cause.squash(cause);
        const err = error instanceof Error ? error : new Error(String(error));
        const duration = Math.round(performance.now() - startedAt);

        yield* scheduleServerExceptionCapture(error, {
          source: "weather-api",
        });

        yield* logError(err, logContext);
        yield* logHttpRequest(
          {
            method: "POST",
            url: "/api/weather",
            statusCode: 500,
            duration,
          },
          logContext
        );

        return Response.json(
          { error: "Failed to fetch weather data" },
          { status: 500 }
        );
      })
    ),
    Effect.provide(FetchClient)
  );
});
