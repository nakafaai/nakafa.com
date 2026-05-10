import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  getWeather,
} from "@repo/ai/clients/weather/client";
import {
  captureServerException,
  extractDistinctIdFromPostHogCookie,
} from "@repo/analytics/posthog/server";
import { CorsValidator } from "@repo/security/lib/cors-validator";
import { logError, logHttpRequest } from "@repo/utilities/logging/effect";
import { geolocation } from "@vercel/functions";
import { Cause, Effect } from "effect";
import { after, NextResponse } from "next/server";

const corsValidator = new CorsValidator();

export function POST(req: Request) {
  const startedAt = performance.now();
  const context = {
    service: "weather-api",
    endpoint: "/api/weather",
  };

  return Effect.runPromise(
    Effect.gen(function* () {
      if (!corsValidator.isRequestFromAllowedDomain(req)) {
        return corsValidator.createForbiddenResponse();
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
            ...context,
            latitude,
            longitude,
          })
        );
      }

      yield* Effect.logInfo("Processing weather request").pipe(
        Effect.annotateLogs({
          ...context,
          latitude,
          longitude,
        })
      );

      const weather = yield* getWeather({ latitude, longitude });
      const duration = Math.round(performance.now() - startedAt);

      yield* logHttpRequest(
        {
          method: "POST",
          url: "/api/weather",
          statusCode: 200,
          duration,
        },
        context
      );

      return NextResponse.json(weather);
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          const error = Cause.squash(cause);
          const err = error instanceof Error ? error : new Error(String(error));
          const duration = Math.round(performance.now() - startedAt);

          after(async () => {
            await captureServerException(
              err,
              extractDistinctIdFromPostHogCookie(req.headers.get("cookie")),
              {
                source: "weather-api",
              }
            );
          });

          yield* logError(err, context);
          yield* logHttpRequest(
            {
              method: "POST",
              url: "/api/weather",
              statusCode: 500,
              duration,
            },
            context
          );

          return NextResponse.json(
            { error: "Failed to fetch weather data" },
            { status: 500 }
          );
        })
      )
    )
  );
}
