import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  getWeather,
} from "@repo/ai/clients/weather/client";
import { CorsValidator } from "@repo/security/lib/cors-validator";
import {
  createServiceLogger,
  createTimer,
  logError,
  logHttpRequest,
} from "@repo/utilities/logging";
import { geolocation } from "@vercel/functions";
import { NextResponse } from "next/server";

const corsValidator = new CorsValidator();

const apiLogger = createServiceLogger("weather-api");

export async function POST(req: Request) {
  // Only allow requests from allowed domain
  if (!corsValidator.isRequestFromAllowedDomain(req)) {
    return corsValidator.createForbiddenResponse();
  }

  const endTimer = createTimer(apiLogger, "weather_api_request");

  try {
    // Get geolocation from Vercel (works in production only)
    const geo = geolocation(req);
    let latitude = geo.latitude;
    let longitude = geo.longitude;

    // If geolocation is not available (local dev), use fallback coordinates
    if (!(latitude && longitude)) {
      // Use Jakarta, Indonesia as default coordinates for development
      latitude = DEFAULT_LATITUDE;
      longitude = DEFAULT_LONGITUDE;
      apiLogger.info(
        { env: process.env.NODE_ENV },
        "Geolocation unavailable, using default coordinates (Jakarta, Indonesia)"
      );
    }

    apiLogger.info({ latitude, longitude }, "Processing weather request");

    const weather = await getWeather({ latitude, longitude });
    const duration = endTimer();

    logHttpRequest(apiLogger, {
      method: "POST",
      url: "/api/weather",
      statusCode: 200,
      duration,
    });

    return NextResponse.json(weather);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(apiLogger, err, {
      context: "weather_api",
      endpoint: "/api/weather",
    });

    const duration = endTimer();
    logHttpRequest(apiLogger, {
      method: "POST",
      url: "/api/weather",
      statusCode: 500,
      duration,
    });

    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
