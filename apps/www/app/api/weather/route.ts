import { getWeather } from "@repo/ai/lib/weather";
import {
  createServiceLogger,
  createTimer,
  logError,
  logHttpRequest,
} from "@repo/utilities/logging";
import { geolocation } from "@vercel/functions";
import { NextResponse } from "next/server";

const DEFAULT_LATITUDE = "-6.2088";
const DEFAULT_LONGITUDE = "106.8456";

const apiLogger = createServiceLogger("weather-api");

export async function POST(req: Request) {
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
