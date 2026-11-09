import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  ambienceOf,
  barOf,
  Cue,
  chance,
  cueOf,
  cueOfEdit,
  frequencyOf,
  STEPS_PER_BAR,
  stepSeconds,
  Voice,
} from "@/lib/island/music";
import { Phase, Weather } from "@/lib/island/sky";

describe("island music", () => {
  it("tunes A above middle C to 440 hertz and an octave to a doubling", () => {
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(81)).toBeCloseTo(880);
    expect(frequencyOf(57)).toBeCloseTo(220);
  });

  it("draws the same chance for the same bar and step, always between 0 and 1", () => {
    expect(chance(3, 5, 1)).toBe(chance(3, 5, 1));
    expect(chance(3, 5, 1)).not.toBe(chance(3, 5, 2));
    const draws = Arr.map(Arr.range(0, 200), (bar) => chance(bar, 2, 1));
    expect(Arr.every(draws, (draw) => draw >= 0 && draw < 1)).toBe(true);
  });

  it("plays slowest at night and fastest by day", () => {
    expect(stepSeconds("night")).toBeGreaterThan(stepSeconds("dawn"));
    expect(stepSeconds("dawn")).toBeGreaterThan(stepSeconds("dusk"));
    expect(stepSeconds("dusk")).toBeGreaterThan(stepSeconds("day"));
    expect(stepSeconds("day")).toBeCloseTo(60 / 92 / 2);
  });

  it("opens every bar with the chord's root low and keeps the melody on the bar's steps", () => {
    Arr.forEach(Phase.literals, (phase) =>
      Arr.forEach(Weather.literals, (weather) => {
        const [bass, ...melody] = barOf(phase, weather, 5);
        expect(bass).toMatchObject({
          length: STEPS_PER_BAR,
          step: 0,
          voice: "pad",
        });
        expect(
          Arr.every(
            melody,
            (note) =>
              note.step >= 0 &&
              note.step < STEPS_PER_BAR &&
              note.midi >= bass.midi &&
              note.velocity > 0 &&
              note.velocity < 0.25
          )
        ).toBe(true);
      })
    );
  });

  it("lets the weather pick the instrument, and plucks short notes when it is clear", () => {
    const voices = (weather: Weather) =>
      Arr.dedupe(
        Arr.flatMap(Arr.range(0, 15), (bar) =>
          Arr.map(Arr.drop(barOf("day", weather, bar), 1), (note) => note.voice)
        )
      );
    expect(voices("clear")).toEqual(["pluck"]);
    expect(voices("rain")).toEqual(["bell"]);
    expect(voices("snow")).toEqual(["chime"]);
    expect(voices("storm")).toEqual(["pad"]);
    const plucked = Arr.flatMap(Arr.range(0, 7), (bar) =>
      Arr.drop(barOf("day", "clear", bar), 1)
    );
    expect(Arr.every(plucked, (note) => note.length === 1)).toBe(true);
  });

  it("plays snow an octave above the clear day and fog an octave below", () => {
    const highest = (weather: Weather) =>
      Math.max(
        ...Arr.flatMap(Arr.range(0, 31), (bar) =>
          Arr.map(Arr.drop(barOf("day", weather, bar), 1), (note) => note.midi)
        )
      );
    expect(highest("snow")).toBeGreaterThan(highest("clear"));
    expect(highest("fog")).toBeLessThan(highest("clear"));
  });

  it("brings birds by day, crickets by night, and rain and wind with the weather", () => {
    expect(ambienceOf("day", "clear")).toEqual({
      birds: true,
      crickets: false,
      rain: 0,
      wind: 0.05,
    });
    expect(ambienceOf("night", "cloudy")).toMatchObject({
      birds: false,
      crickets: true,
    });
    expect(ambienceOf("dawn", "rain")).toMatchObject({
      birds: false,
      rain: 0.3,
    });
    expect(ambienceOf("dusk", "storm")).toMatchObject({
      crickets: false,
      rain: 0.5,
      wind: 0.3,
    });
    expect(ambienceOf("day", "snow").wind).toBe(0.12);
  });

  it("answers every press with a short cue of known instruments", () => {
    Arr.forEach(Cue.literals, (cue) => {
      const notes = cueOf(cue);
      expect(notes.length).toBeGreaterThan(1);
      expect(
        Arr.every(
          notes,
          (note) =>
            note.delay >= 0 &&
            note.delay < 0.5 &&
            Arr.contains(Voice.literals, note.voice)
        )
      ).toBe(true);
    });
    expect(cueOf("place")[1].midi).toBeGreaterThan(cueOf("place")[0].midi);
    expect(cueOf("remove")[1].midi).toBeLessThan(cueOf("remove")[0].midi);
  });

  it("plays the cue of what an accepted edit does", () => {
    expect(
      Arr.map(
        ["place", "move", "remove", "upgrade", "downgrade"] as const,
        cueOfEdit
      )
    ).toEqual(["place", "place", "remove", "upgrade", "remove"]);
  });
});
