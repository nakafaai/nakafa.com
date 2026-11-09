import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, DateTime, Option } from "effect";
import {
  createSkyStore,
  gradeOf,
  hourAt,
  Phase,
  phaseAt,
  Weather,
  weatherOf,
} from "@/lib/island/sky";

describe("island sky", () => {
  it("reads the weather from the service's icon code, by day and by night", () => {
    expect(
      Arr.map(
        ["01d", "02n", "03d", "04n", "09d", "10n", "11d", "13n", "50d"],
        weatherOf
      )
    ).toEqual(
      Arr.map(
        [
          "clear",
          "clear",
          "cloudy",
          "cloudy",
          "rain",
          "rain",
          "storm",
          "snow",
          "fog",
        ] as const,
        Option.some
      )
    );
    expect(weatherOf("99d")).toEqual(Option.none());
  });

  it("reads the owner's local hour in their own zone", () => {
    const noonInJakarta = DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-11-08T05:30:00Z")
    );
    expect(
      hourAt(noonInJakarta, DateTime.zoneMakeNamedUnsafe("Asia/Jakarta"))
    ).toBe(12.5);
    expect(hourAt(noonInJakarta, DateTime.zoneMakeNamedUnsafe("UTC"))).toBe(
      5.5
    );
  });

  it("turns the hours into dawn, day, dusk and night", () => {
    expect(Arr.map([4.9, 5, 6.4, 6.5, 17.4, 17.5, 18.9, 19], phaseAt)).toEqual([
      "night",
      "dawn",
      "dawn",
      "day",
      "day",
      "dusk",
      "dusk",
      "night",
    ]);
  });

  it("grades every light of the day in every weather with a tint inside the visible range", () => {
    Arr.forEach(Phase.literals, (phase) =>
      Arr.forEach(Weather.literals, (weather) => {
        const { tint } = gradeOf(phase, weather);
        expect(
          Arr.every(tint, (channel) => channel > 0.2 && channel <= 1.1)
        ).toBe(true);
      })
    );
  });

  it("draws a clear day in the palette's own colours", () => {
    expect(gradeOf("day", "clear")).toEqual({
      fall: "none",
      flash: false,
      flies: false,
      fog: false,
      lit: false,
      sky: "sky",
      stars: false,
      tint: [1, 1, 1],
    });
  });

  it("lights the windows, the stars and the fireflies on a clear night", () => {
    const night = gradeOf("night", "clear");
    expect(night).toMatchObject({
      flies: true,
      lit: true,
      sky: "night",
      stars: true,
    });
    expect(night.tint[2]).toBeGreaterThan(night.tint[0]);
  });

  it("covers the day's sky with clouds and lets rain, snow, fog and lightning show", () => {
    expect(gradeOf("day", "rain")).toMatchObject({
      fall: "rain",
      lit: false,
      sky: "overcast",
    });
    expect(gradeOf("dusk", "snow")).toMatchObject({
      fall: "snow",
      lit: true,
      sky: "overcast",
    });
    expect(gradeOf("day", "storm")).toMatchObject({
      fall: "rain",
      flash: true,
      lit: true,
    });
    expect(gradeOf("dawn", "fog")).toMatchObject({ fall: "none", fog: true });
    expect(gradeOf("night", "cloudy")).toMatchObject({
      flies: true,
      sky: "night",
      stars: false,
    });
    expect(gradeOf("night", "rain").flies).toBe(false);
  });

  it("dims the light more the heavier the weather", () => {
    const [clear, cloudy, storm] = Arr.map(
      ["clear", "cloudy", "storm"] as const,
      (weather) => gradeOf("day", weather).tint[0]
    );
    expect(clear).toBeGreaterThan(cloudy);
    expect(cloudy).toBeGreaterThan(storm);
    expect(Weather.literals).toHaveLength(6);
  });

  it("keeps a frame's light and weather until its clock and its read change them", () => {
    const store = createSkyStore("dusk");
    expect(store.getState()).toMatchObject({ phase: "dusk", weather: "clear" });
    store.getState().setPhase("night");
    store.getState().setWeather("snow");
    expect(store.getState()).toMatchObject({ phase: "night", weather: "snow" });
  });
});
