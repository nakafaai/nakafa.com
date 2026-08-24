import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  getCurrentWeather,
} from "@repo/ai/clients/weather/client";
import { logError, logHttpRequest } from "@repo/utilities/logging/effect";
import { geolocation } from "@vercel/functions";
import { Cause, Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { NextResponse } from "next/server";
import { scheduleServerExceptionCapture } from "@/lib/analytics/server";
import {
  createCorsForbiddenResponse,
  isCorsRequestAllowed,
} from "@/lib/security/cors";

const logContext = {
  service: "weather-api",
  endpoint: "/api/weather",
};

export function POST(req: Request) {
  const startedAt = performance.now();

  return Effect.runPromise(
    Effect.gen(function* () {
      const isAllowedOrigin = yield* isCorsRequestAllowed(req);
      if (!isAllowedOrigin) {
        return createCorsForbiddenResponse();
      }

      const geo = geolocation(req);
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

      return NextResponse.json(weather);
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.gen(function* () {
          const error = Cause.squash(cause);
          const err = error instanceof Error ? error : new Error(String(error));
          const duration = Math.round(performance.now() - startedAt);

          yield* scheduleServerExceptionCapture(err, { source: "weather-api" });

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

          return NextResponse.json(
            { error: "Failed to fetch weather data" },
            { status: 500 }
          );
        })
      ),
      Effect.provide(FetchHttpClient.layer)
    )
  );
}
