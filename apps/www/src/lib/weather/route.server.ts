import { FetchClient } from "@repo/utilities/http/client";
import { logError, logHttpRequest } from "@repo/utilities/logging/effect";
import { Cause, Effect, Option, Schema } from "effect";
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

/** The request properties that Cloudflare sets from the visitor's address, when it knows the location. */
const CloudflareRequest = Schema.Struct({
  cf: Schema.optionalKey(
    Schema.Struct({
      latitude: Schema.optionalKey(Schema.String),
      longitude: Schema.optionalKey(Schema.String),
    })
  ),
});

/**
 * The visitor's coordinates as Cloudflare reports them; both are absent when the
 * platform has none. A report that does not decode is logged and treated as none,
 * so the default location answers and the cause stays in the logs.
 */
const readVisitorLocation = Effect.fn("www.weather.readVisitorLocation")(
  function* (request: Request) {
    const decoded = yield* Schema.decodeUnknownEffect(CloudflareRequest)(
      request
    ).pipe(Effect.option);
    if (Option.isNone(decoded)) {
      yield* Effect.logWarning(
        "The platform's visitor location is malformed, so the default location answers."
      ).pipe(Effect.annotateLogs(logContext));
      return { latitude: undefined, longitude: undefined };
    }
    return {
      latitude: decoded.value.cf?.latitude,
      longitude: decoded.value.cf?.longitude,
    };
  }
);

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

      const location = yield* readVisitorLocation(request);
      let latitude = location.latitude;
      let longitude = location.longitude;

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
