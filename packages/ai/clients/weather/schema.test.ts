import {
  CurrentWeatherSummarySchema,
  OpenWeatherCurrentResponseSchema,
} from "@repo/ai/clients/weather/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("OpenWeatherCurrentResponseSchema", () => {
  it("keeps only the provider fields needed by the weather summary", () => {
    const decoded = Schema.decodeUnknownSync(OpenWeatherCurrentResponseSchema)({
      base: "stations",
      cod: 200,
      main: {
        feels_like: 305.2,
        humidity: 78,
        temp: 300.4,
      },
      name: "Jakarta",
      sys: {
        country: "ID",
        sunrise: 1_779_309_600,
      },
      weather: [
        {
          description: "light rain",
          icon: "10d",
          id: 500,
          main: "Rain",
        },
      ],
    });

    expect(decoded).toEqual({
      main: {
        temp: 300.4,
      },
      name: "Jakarta",
      sys: {
        country: "ID",
      },
      weather: [
        {
          description: "light rain",
          icon: "10d",
        },
      ],
    });
  });
});

describe("CurrentWeatherSummarySchema", () => {
  it("accepts the narrow app weather payload", () => {
    const decoded = Schema.decodeUnknownSync(CurrentWeatherSummarySchema)({
      city: "Jakarta",
      condition: "light rain",
      country: "ID",
      icon: "10d",
      temperatureKelvin: 300.4,
    });

    expect(decoded.city).toBe("Jakarta");
  });
});
