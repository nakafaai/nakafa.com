import {
  WeatherDataSchema,
  WeatherResponseSchema,
} from "@repo/ai/clients/weather/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const weatherResponse = {
  city: {
    coord: {
      lat: -6.2088,
      lon: 106.8456,
    },
    country: "ID",
    id: 1_642_911,
    name: "Jakarta",
    sunrise: 1_779_309_600,
    sunset: 1_779_352_800,
    timezone: 25_200,
  },
  cnt: 1,
  cod: "200",
  list: [
    {
      clouds: {
        all: 75,
      },
      dt: 1_779_321_600,
      dt_txt: "2026-05-21 12:00:00",
      main: {
        feels_like: 305.2,
        humidity: 78,
        pressure: 1010,
        temp: 300.4,
        temp_max: 301,
        temp_min: 300,
      },
      pop: 0.42,
      sys: {
        pod: "d",
      },
      weather: [
        {
          description: "light rain",
          icon: "10d",
          id: 500,
          main: "Rain",
        },
      ],
      wind: {
        deg: 160,
        speed: 2.5,
      },
    },
  ],
  message: 0,
};

const airPollution = {
  coord: {
    lat: -6.2088,
    lon: 106.8456,
  },
  list: [],
};

describe("WeatherResponseSchema", () => {
  it("accepts forecast items without visibility", () => {
    const decoded = Schema.decodeUnknownSync(WeatherResponseSchema)(
      weatherResponse
    );

    expect(decoded.list[0]?.visibility).toBeUndefined();
  });

  it("accepts the complete app weather payload", () => {
    const decoded = Schema.decodeUnknownSync(WeatherDataSchema)({
      ...weatherResponse,
      air_pollution: airPollution,
      air_pollution_forecast: airPollution,
      geocoding: {
        city: "Jakarta",
        country: "ID",
        latitude: "-6.2088",
        longitude: "106.8456",
      },
    });

    expect(decoded.geocoding.city).toBe("Jakarta");
  });
});
